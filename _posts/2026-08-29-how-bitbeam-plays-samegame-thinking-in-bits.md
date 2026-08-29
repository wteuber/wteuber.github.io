---
layout: post
title: "How bitbeam Plays SameGame: Thinking in Bits"
subtitle: A puzzle solver that squeezes the board into a handful of integers, keeps only its best few thousand guesses, and knows when to admit a board is impossible.
tags: [algorithms, c++, performance, puzzles, engineering]
author: Wolfgang Teuber
---

SameGame is the kind of puzzle that looks trivial for about ninety seconds. A grid of coloured tiles. Click any group of two or more touching tiles of the same colour and they vanish. Everything above falls down, empty columns close up, and bigger groups pay much better than small ones. Clear the whole board and you have played it perfectly.

Ninety seconds in, you notice the catch: **every click changes every option you had left.** The group you were saving for later just fell apart. There is no way to check your work except to play it out.

I wrote a solver for it called [bitbeam](https://github.com/wteuber/samegame-solver). It plays a 30×20 board in a couple of seconds, and it's a nice illustration of three ideas that show up far outside puzzle games.

## First, why you cannot just try everything

On the 30×20 board my bot plays, a position typically offers a few dozen legal clicks, and a game runs well over a hundred clicks deep. Multiply that out and you get a number with more than a hundred digits — comfortably more than the number of atoms in the observable universe.

So exhaustive search is off the table, forever, on any hardware. This isn't a matter of waiting for faster computers. The interesting question becomes: *what do you throw away, and how cheaply can you throw it away?*

## Idea 1: Keep a shortlist, not a tree

The strategy is called **beam search**, and it is almost embarrassingly simple.

Play every legal click from your current position. Score all the results. Keep the best 5,000 and delete everything else. Now do the same from those 5,000. Repeat until the board is done.

That's it. The "beam" is the width of the shortlist. Widen it and you play better and slower; narrow it and you play worse and faster. It's how a good human plays, honestly — you look at what's promising, you don't look at what obviously isn't, and you accept that you might be discarding the winning line.

The nuance is in the scoring. Ranking positions by *points so far* turns out to be terrible: the solver grabs cheap points early and strands itself. Ranking by points so far **plus** the points still sitting on the board is much better. And if you actually want to *clear* the board, you have to explicitly punish tiles that are stranded alone with no matching neighbour — otherwise the search happily trades away a clean finish for one fatter group.

## Idea 2: Make the board so small the CPU barely notices it

Here's where it gets fun.

The obvious way to store the board is a grid of numbers — one per tile. The usual way to remove a group is a recursive flood fill; the usual way to apply gravity is a nested loop that shuffles tiles downward.

bitbeam does none of that. It stores each **column** as three 32-bit integers. Three bits per tile, so eight possible colours, one bit in each integer — plus a single number for how tall the column is. A 30×20 board fits in a few hundred bytes and, more importantly, an entire column fits in a CPU register.

Why bother? Because of one instruction.

> **`PEXT`** takes a row of bits and a mask of "keep these", and squeezes the kept bits down to the bottom, in order, in a single instruction.
>
> That is *exactly* gravity. Not an analogy for gravity — the same operation.

So removing a group, which is normally a loop over every surviving tile in the column, becomes three instructions and a bit count:

```cpp
Bits keep = occ(x) & ~groupMask[x];
p0[x] = pext(p0[x], keep);       // every surviving tile in this column
p1[x] = pext(p1[x], keep);       // lands where gravity puts it,
p2[x] = pext(p2[x], keep);       // in three instructions
colh[x] = popcount(keep);
```

Finding groups gets the same treatment. Instead of walking tile by tile, each column is split into runs of one colour, and neighbouring columns are joined by XOR-ing their bit patterns together — one set bit in the result means "these two runs touch and match". The loop then runs once per *boundary between groups* rather than once per tile. That change alone took group-linking on a 15×15 board from 3,450 ns to 605 ns.

Measured against the routines from [sgbust](https://github.com/chausner/sgbust), the excellent solver I used as a reference point, the bit-based versions run **3–4× faster on finding groups and roughly 5× faster per move played.**

One honest footnote: I tried the same trick in a Ruby version of this solver and it came out **2.65× slower** than plain arrays. In Ruby every bit-shift allocates an object and there's no popcount. The idea isn't universally good — it's good when it maps onto instructions your CPU actually has.

## Idea 3: Don't build what you're about to delete

This one is the biggest single win, and it has nothing to do with bits.

The natural way to write beam search is: generate every child position, fully — copy the board, remove the group, check whether it's finished, serialise it, hash it, insert it into the set — then sort them all and throw 95% away.

That's a lot of construction work performed on things destined for the bin.

bitbeam instead records **six bytes per candidate**: what it would score, and which move produces it. It finds the exact cutoff on those six-byte stubs, and only *then* replays the moves that survived. Same search, same result, bit for bit — **3,718 ms down to 1,306 ms.**

The general lesson: *decide first, materialise second.* Sorting cheap descriptions and expanding only the winners beats expanding everything and sorting the results.

## The part nobody asks for but everybody wants: same answer every time

Run a parallel search twice and you'll usually get two different answers. Not wrong ones — just different, because the cutoff between "good enough to keep" and "cut" landed differently depending on which thread happened to finish first. That makes bugs nearly impossible to reproduce, and makes "did my change help?" unanswerable.

Getting rid of that meant breaking every tie deliberately: rank by score, then by board hash; if two routes reach the same position, compare the move sequences; if two finished games score the same, prefer the shorter one, then the alphabetically smaller one.

The payoff is that **the output is byte-identical on 1, 2, 4, 8 and 16 threads**, which the test suite checks on random boards. And it costs nothing — 16 threads still run 5.7× faster than one.

If you take one thing from this post as a non-programmer, take that one. *Fast* and *reproducible* are usually presented as a trade-off. Most of the time they're not; they're just extra work nobody budgeted for.

## Knowing when to quit

Clearing a SameGame board completely is NP-complete — proven, and proven at absurdly small sizes: [two colours and two columns is already hard](https://erikdemaine.org/papers/Clickomania_JIP/). Some boards simply cannot be cleared, and a search that doesn't know this will grind away at them until you lose patience.

So bitbeam carries a few **refutations** — cheap rules that can only ever say "this board is impossible", never "this board is fine":

- A colour with exactly one tile left can never be removed. Done.
- For a single column, there's a beautiful result from the theory literature: it's clearable if and only if its colour sequence fits a specific grammar. Since columns collapse as you play, boards get narrow near the end and this fires constantly.
- A two-colour board whose lower half is a chessboard is unsolvable no matter what sits on top of it.

Every one of these is checked against exhaustive search on thousands of small boards. A rule that ever refutes a *solvable* board is worse than no rule at all.

There's also one rule I deliberately left out, and I like it as a cautionary tale. It's often suggested that merging two colours into one is a safe simplification — surely any winning sequence still works if colours become interchangeable? It doesn't. A click removes the *maximal* matching group, and after merging, that group can be bigger than you intended, which breaks the sequence. Plausible, elegant, wrong. Into the tests it went, and out it came.

## Does it actually play better?

Against the genetic algorithm I'd been using — same boards, same conditions, both asked to clear the board completely:

| Solver | Mean score | Boards cleared | Mean time |
|---|---:|---:|---:|
| Genetic algorithm | 1,993 | 6/6 | 775 ms |
| bitbeam | **3,295** | 6/6 | **205 ms** |

Two-thirds more points, in a quarter of the time.

## The actual takeaway

None of the three ideas here is exotic:

1. **Keep a shortlist.** You can't search everything, so get good at discarding.
2. **Match your data to your machine.** The right representation turns a loop into an instruction — but only if you check, because the same idea was 2.65× *slower* in another language.
3. **Decide before you build.** Most of the work in a naive search is spent constructing things that are immediately deleted.

And one that isn't about speed at all: the moment the output became reproducible, every other improvement got easier to make, because I could finally tell whether a change had helped.

*The solver is [on GitHub](https://github.com/wteuber/samegame-solver), along with the [bot](https://github.com/wteuber/samegame-bot) that plays the game in a real browser by reading pixels off the screen and moving the actual mouse — but that's a story for another post.*
