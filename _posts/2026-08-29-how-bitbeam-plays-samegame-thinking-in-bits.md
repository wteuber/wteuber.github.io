---
layout: post
title: "How bitbeam Plays SameGame: Thinking in Bits"
subtitle: A puzzle solver that keeps the whole board in a handful of integers and throws away almost every move it looks at.
cover-img: /assets/img/2026-08-29-how-bitbeam-plays-samegame-thinking-in-bits/samegame-board-cover-dark.png
thumbnail-img: /assets/img/2026-08-29-how-bitbeam-plays-samegame-thinking-in-bits/samegame-board.png
share-img: /assets/img/2026-08-29-how-bitbeam-plays-samegame-thinking-in-bits/samegame-board-share.png
tags: [algorithms, c++, performance, puzzles, engineering]
author: Wolfgang Teuber
---

SameGame looks simple. You get a grid of coloured tiles. Click any group of two or more touching tiles of the same colour and the group vanishes. Whatever sat above it falls down, empty columns close up, and large groups score far better than small ones. Clear the board completely and you have played it perfectly.

The difficulty shows up within a minute or two. Every click rearranges the board, so the group you were saving for later might not exist by the time you get to it. There is no way to judge a move except by playing out everything that follows from it.

I wrote a solver for this called [bitbeam](https://github.com/wteuber/samegame-solver). It plays a 30×20 board in a couple of seconds. The three ideas that make that possible show up in plenty of software that has nothing to do with puzzle games, which is the reason this is worth writing up.

## Why you cannot just try every move

On a 30×20 board, a typical position offers a few dozen legal clicks, and a full game runs well past a hundred clicks deep. Multiply that out and you get a number with more than a hundred digits. The observable universe contains fewer atoms.

So checking every possibility is off the table permanently, on any hardware anyone is going to build. The useful question is not how to search everything. It is what to throw away, and how cheaply you can throw it away.

## Idea 1: Keep a shortlist

The technique is called beam search, and it is about as simple as search algorithms get.

Take the current position and play every legal click. Score all the resulting positions, keep the best 5,000, delete the rest. Now do the same thing starting from those 5,000. Repeat until the games are over.

The beam is the size of that shortlist. Widen it and the solver plays better and runs slower. Narrow it and it plays worse and runs faster. This is roughly how a strong human plays: look at the moves that seem promising, ignore the ones that obviously are not, and accept that you may be discarding the best line without ever finding out.

The hard part is the scoring. Ranking positions by points scored so far works badly, because the solver grabs cheap points early and paints itself into a corner. Ranking by points scored plus the points still sitting on the board works much better. And if the goal is to clear the board rather than just to score well, the scoring has to punish tiles left stranded with no matching neighbour, or the search will trade away a clean finish for one fat group.

## Idea 2: Shrink the board until it fits in a register

The obvious way to store the board is one number per tile in a grid. Removing a group then means a recursive flood fill to find the connected tiles, and applying gravity means a nested loop that shuffles tiles downward one at a time.

bitbeam stores each column as three 32-bit integers instead. Every tile gets three bits, one in each integer, which is enough to encode eight colours, and a fourth number records how tall the column is. The whole 30×20 board comes to a few hundred bytes, and a single column fits in one CPU register.

That last part is what makes it fast, because of one instruction. PEXT, short for parallel bit extract, takes a value and a mask of the bits you want to keep, and packs those bits down to the bottom in order. It does this in one instruction. That operation is not a metaphor for gravity. It is gravity.

Removing a group from a column, normally a loop over every tile that survives, becomes three instructions and a population count:

```cpp
Bits keep = occ(x) & ~groupMask[x];
p0[x] = pext(p0[x], keep);       // every surviving tile in this column
p1[x] = pext(p1[x], keep);       // lands where gravity puts it,
p2[x] = pext(p2[x], keep);       // in three instructions
colh[x] = popcount(keep);
```

Finding groups gets similar treatment. Instead of walking tile by tile, each column is broken into runs of a single colour, and neighbouring columns are compared by XOR-ing their bit patterns together. A set bit in the result means two runs touch and match. The loop then runs once per boundary between groups rather than once per tile, which took group linking on a 15×15 board from 3,450 nanoseconds to 605.

Measured against the equivalent routines in [sgbust](https://github.com/chausner/sgbust), an existing solver I used as a reference, the bit versions find groups 3 to 4 times faster and play a move roughly 5 times faster.

That comes with a caveat. I tried the same representation in a Ruby version of the solver and it ran 2.65 times slower than plain arrays, because Ruby allocates an object for every bit shift and has no popcount. The trick works when it maps onto instructions the processor actually has, and not otherwise.

## Idea 3: Do not build what you are about to delete

This was the biggest single speedup, and it has nothing to do with bits.

The natural way to write beam search is to produce every child position in full. Copy the board, remove the group, check whether the game is over, serialise the result, hash it, insert it into a set to catch duplicates. Then sort all of them and throw away 95 percent.

Nearly all of that work goes into positions that get deleted moments later.

bitbeam writes down six bytes per candidate instead: the score the move would produce, and the move itself. It finds the exact cut-off using those six-byte stubs, then replays only the moves that survived it. The search is the same and the output is the same, byte for byte. Runtime went from 3,718 milliseconds to 1,306.

Sorting cheap descriptions and expanding only the winners beats expanding everything and then sorting.

## Getting the same answer twice

Run a parallel search twice and you will usually get two different answers. Neither is wrong. They differ because the boundary between "good enough to keep" and "cut" landed in a slightly different place depending on which thread happened to finish first. That makes bugs hard to reproduce, and it makes the question "did my change help?" unanswerable.

Fixing it meant defining a tiebreak for every comparison in the search. Rank by score, then by a hash of the board. If two different move sequences reach the same position, compare the sequences. If two finished games score the same, prefer the shorter one, then the alphabetically smaller one.

The result is that the output is byte-identical whether the solver runs on 1, 2, 4, 8 or 16 threads, which the test suite checks on random boards. It costs nothing in speed. Sixteen threads still finish 5.7 times faster than one.

## Knowing when a board cannot be cleared

Clearing a SameGame board completely is NP-complete, and it stays hard at surprisingly small sizes. [Two colours and two columns is already enough](https://erikdemaine.org/papers/Clickomania_JIP/). Some boards cannot be cleared at all, and a search that does not know this will grind away at them until you give up waiting.

bitbeam carries a small set of refutations, which are rules that can prove a board is impossible but can never claim a board is fine. A colour with exactly one tile left can never be removed, so that board is dead. A single column is clearable if and only if its colour sequence matches a specific grammar, a result from the theory literature that fires constantly here because boards get narrow as columns collapse. A two-colour board whose bottom half is a chessboard pattern cannot be cleared regardless of what sits above it.

Every rule is checked against exhaustive search on thousands of small boards. A rule that wrongly refutes a solvable board is worse than no rule at all.

## Does it play better?

Against the genetic algorithm I had been using, on the same boards under the same conditions, with both asked to clear the board completely:

| Solver | Mean score | Boards cleared | Mean time |
|---|---:|---:|---:|
| Genetic algorithm | 1,993 | 6/6 | 775 ms |
| bitbeam | 3,295 | 6/6 | 205 ms |

Two thirds more points in a quarter of the time.

## What it looks like

This is easier to show than to describe. Below is a bot playing [the browser version of SameGame](/public/samegame){:target="_blank"} with bitbeam choosing the moves. Real clicks on a real page, seven boards cleared in a row:

![A bot playing SameGame in the browser, clearing board after board with moves found by bitbeam](/assets/img/2026-08-29-how-bitbeam-plays-samegame-thinking-in-bits/bitbeam-bot-playing-samegame.gif){:style="border-radius: 8px;"}

There is not much deliberation to watch. The search finishes before the clicking starts, so most of what you are seeing is a mouse working through a list, at a pace slow enough for a human to follow.

## Wrapping up

None of the three ideas here is novel. Beam search has been around for decades, PEXT has been in Intel processors since 2013, and not building things you are about to throw away is ordinary engineering advice. What mattered was applying them to the same problem and measuring after each step, including the step in Ruby that made things slower.

The determinism work paid off in a way I had not planned for. Once the output stopped varying between runs, evaluating every other change became straightforward, because any difference in the result had to have been caused by the change.

*The solver is [on GitHub](https://github.com/wteuber/samegame-solver), along with the [bot](https://github.com/wteuber/samegame-bot) that plays the game in a browser by reading pixels off the screen and moving the mouse. That is a story for another post.*
