---
layout: post
title: "How bitbeam Plays SameGame: Thinking in Bits"
subtitle: A walk through a puzzle solver that clears a 600-tile board in a couple of seconds, and the measurements behind it.
cover-img: /assets/img/2026-08-29-how-bitbeam-plays-samegame-thinking-in-bits/samegame-board-cover-dark.png
thumbnail-img: /assets/img/2026-08-29-how-bitbeam-plays-samegame-thinking-in-bits/samegame-board.png
share-img: /assets/img/2026-08-29-how-bitbeam-plays-samegame-thinking-in-bits/samegame-board-share.png
tags: [algorithms, c++, performance, puzzles, engineering]
author: Wolfgang Teuber
---

SameGame is the kind of puzzle you can learn in about ten seconds. You get a grid of coloured tiles. Click any group of two or more touching tiles that share a colour and the group disappears. Everything above the gap falls into it, and when a column runs out of tiles entirely, the columns to its right slide over to close the space. Big groups pay far better than small ones, so the game rewards patience.

There are two different things you can play for, and they pull against each other. One is the highest score. The other is an empty board, which usually pays a bonus of its own. The highest-scoring game often leaves a few tiles behind, and the game that empties the board often gives up points to do it.

The trouble starts a minute or two in. Every click rearranges everything above it, so the group you were saving might not be there by the time you get to it. To know for certain whether a click was a good one, you would have to play out every game that follows from it, which nobody can afford to do. The alternative is to guess quickly, and the quality of that guess is what separates a good solver from a bad one.

I wrote one called bitbeam. On a 30×20 board with three colours, 600 tiles in all, it finds a sequence of clicks that empties the whole thing in two to four seconds. A 15×10 board takes a fifth of a second or less. Three ideas account for most of that, and two things I had filed under nice-to-have turned out to matter more than I expected. If you would rather see it than read about it, there is [a recording of a bot clearing seven boards](#what-it-looks-like) at the bottom.

Every timing below comes from the machine I wrote it on: an Intel i9-9880H with 8 cores and 16 hardware threads, built with Apple clang and `-O3 -march=native`. Board sizes vary between sections because each measurement was taken where it was interesting, so every number says which board it belongs to.

## Why brute force is out

On a 30×20 board, a typical position offers a few dozen legal clicks, and a full game runs about fifty clicks deep. Multiply those together and you get a number with more than a hundred digits. There are fewer atoms in the observable universe.

That rules out checking every possibility, and not just on my laptop. No machine anyone is going to build will manage it either. So the design problem is one of discarding: which positions to throw away, and how little time you can spend deciding.

## Idea 1: keep a shortlist

The algorithm is called [beam search](https://en.wikipedia.org/wiki/Beam_search), and it is close to the simplest thing that works.

Start from the current position and play every legal click. Score all the positions you get. Keep the best 5,000 and delete the rest. Then do the same thing from each of those 5,000, keep the best 5,000 of the much larger crop that produces, and carry on until the games are over. Five thousand is the width bitbeam uses when the bot drives it. The benchmarks further down use wider settings, and each of them says which.

Beam search is a stripped-down version of best-first search. Best-first also ranks the positions it has generated and always extends the most promising one, but it holds on to every position it has ever seen in case it needs to come back to one. That collection grows for as long as the search runs, so how much memory it needs depends on the board and on how well the ranking happens to work. You find out how much you needed when the search either finishes or runs out. Beam search deletes everything below the cut at every step, so the collection stays exactly as long as you set it, and memory usage becomes a number you choose in advance instead of one the search discovers for you.

What you pay for that is greed. Beam search always finishes and reports a game, but there is no guarantee it is the best game, and on a board that can be cleared it can easily miss the clear. Widen the beam and the solver plays better and runs slower. Narrow it and it does the opposite. This is not far off how a strong human plays: look at the handful of moves that seem promising, ignore the rest, and accept that you will sometimes overlook something.

The hard part is deciding what "best" means when those positions get scored. Ranking them by points scored so far works badly, because a solver doing that takes the easy points early and leaves itself a board of scattered singles. Adding the points still available on the board works much better. For every group sitting there, work out what it would pay if you clicked it as it stands, and add all of that to the score so far. It is a rough estimate, since taking one group changes the others, but it stops the search from cashing in too early.

If the goal is an empty board rather than a high score, the ranking needs one more term. Tiles that belong to no clickable group are precisely the tiles standing between the position and a clear, so each one is charged a penalty. Without that, the search will trade a finished board for one more fat group every time.

## Idea 2: make gravity a single instruction

The obvious way to hold a board in memory is one number per tile in a two-dimensional grid. Finding a group then means a flood fill, walking from tile to neighbouring tile and collecting matches. Applying gravity means a pair of nested loops that shuffle tiles downward one at a time. Both are easy to write, and neither is fast.

bitbeam stores a column as three 32-bit integers. Every tile gets one bit in each of the three, so the three bits together spell out a colour from 0 to 7, which covers the eight colours the solver supports. A fourth number records how many tiles the column is holding. Because tiles always rest on the floor of their column, that height doubles as a map of which cells are occupied: the bottom `colh[x]` bits hold tiles, everything above them is empty, and an empty cell needs no colour of its own. Those four arrays are the whole board.

```cpp
using Bits = uint32_t;

struct Board {
  uint8_t w;                          // columns still standing
  uint8_t colh[MAXW];                 // how tall each column is
  Bits p0[MAXW], p1[MAXW], p2[MAXW];  // three colour bitplanes per column

  Bits occ(int x) const {             // which cells hold a tile: the low colh bits
    return static_cast<Bits>((uint64_t{1} << colh[x]) - 1);
  }

  int colorAt(int x, int y) const {   // read one tile back out
    return ((p0[x] >> y) & 1)
         | (((p1[x] >> y) & 1) << 1)
         | (((p2[x] >> y) & 1) << 2);
  }
};
```

A 30-column board comes to 90 integers and 30 heights, a few hundred bytes altogether, and each of those integers fits in a single CPU register. That is what lets a single CPU instruction do the next part of the job.

[PEXT](https://www.felixcloutier.com/x86/pext), short for parallel bit extract, takes a value and a mask marking which bits you care about, then packs the marked bits down to the bottom of the result in their original order. One instruction, however many bits are involved. Now look at what gravity does to a column once some of its tiles are deleted: the survivors keep their order and slide to the bottom. It is the same operation. So removing a group and letting the board settle is not a loop over tiles at all.

```cpp
// mask[x] is the clicked group's tiles in column x; lo and hi are the leftmost
// and rightmost columns it reaches. pext and popcnt are the CPU instructions.
for (int x = lo; x <= hi; ++x) {   // only the columns the group touches
  if (!mask[x]) continue;
  Bits keep = b.occ(x) & ~mask[x]; // the tiles that survive this click
  b.p0[x] = pext(b.p0[x], keep);   // each plane drops to the column floor,
  b.p1[x] = pext(b.p1[x], keep);   // original order preserved,
  b.p2[x] = pext(b.p2[x], keep);   // one instruction per plane
  b.colh[x] = popcnt(keep);        // new column height, from a bit count
}
```

Three PEXTs and a bit count, applied to the two or three columns the group actually spans, in place of nested loops over the whole board. The game's other rule, that an emptied column closes up and the columns to its right slide over, is handled separately, and it is both cheap and rare: four integers move per column shifted, and only when a column loses its last tile.

PEXT does come with conditions attached. It is an x86 instruction, available since Intel's Haswell chips in 2013, and on AMD processors before Zen 3 it was implemented in microcode and slow enough that ordinary shifting beat it. bitbeam ships a portable version that does the same job bit by bit for that reason, and the test suite runs 100,000 random cases through both to make sure they agree.

Finding groups gets similar treatment. Instead of walking tile by tile, the solver splits each column into runs of a single colour, then compares neighbouring columns by XOR-ing their bit patterns together. Any bit still set in the result marks a spot where two runs touch and match, which means they belong to the same group. The loop then runs once per boundary rather than once per tile. On a 15×15 board that took the linking step from 3,450 nanoseconds to 605.

For a reference point I used [sgbust](https://github.com/chausner/sgbust), another SameGame solver with the same overall shape: beam search, a hash set to catch positions it has already seen, one byte per cell for the board. It builds through vcpkg and parallelises with `std::execution::par`, which the standard library on my machine does not implement. There are ways around that. Linking Intel's TBB is the usual one, and dropping to `seq` is another. Either way the resulting number would say as much about our two allocators and build settings as about the algorithms, so I took a different route and transcribed its three core routines into bitbeam's benchmark. Both versions then run on the same 20×20 five-colour board, in the same process, interleaved, on one thread, best of four rounds.

| | bitbeam | sgbust | speedup |
|---|---:|---:|---:|
| Enumerate groups | 5,175 ns | 18,410 ns | 3.6× |
| Expand one child | 100 ns | 569 ns | 5.7× |
| Play a game to the end | 248 µs | 1,008 µs | 4.1× |

The pattern holds from 10×10 up to 20×20 and from three colours to seven: 3.2 to 4.0 times faster on group enumeration, 4.8 to 5.8 times per child position, 3.6 to 4.1 times on a complete game. Two things to keep in mind about it. sgbust links the mimalloc allocator and my transcription of it does not, which handicaps the parts of it that allocate heavily. And these are the small routines each solver runs millions of times, not the two programs end to end.

None of this makes bit-packing a good idea everywhere. I tried the same representation in a Ruby version of the solver and it came out 2.65 times slower than plain arrays. That is a limit of the implementation rather than the language. CRuby has no popcount method on `Integer` and no way to emit a PEXT, so the two instructions that do the work in C++ cannot be reached from Ruby at all, and no just-in-time compiler can conjure up an instruction the runtime never generates. What is left is an interpreted method call for every shift and every mask, running against array indexing that is already written in C. Nothing in the language rules out either primitive. They are simply not there today, and a technique that depends on them is worth having only where the processor and the runtime both cooperate.

## Idea 3: don't write down what you are about to delete

This produced the biggest end-to-end speedup of anything I tried, and it has nothing to do with bits.

The natural way to write beam search is to build every child position in full: copy the board, remove the group, check whether the game has ended, serialise the result, hash it, insert it into a set so duplicates get caught. Then you sort the whole crop and throw away 95 percent of it. Almost all of that bookkeeping goes into positions that are deleted a moment later.

Each candidate still has to be built and scored, because that is how the solver learns what it is worth. What it does not have to do is file it away. The first pass records six bytes per candidate and nothing else:

```cpp
w.objs.push_back(objective(cscore, w.child, w.cmg)); // 4 bytes: how good
w.mvs.push_back(static_cast<uint16_t>(g));           // 2 bytes: which move
```

No board is copied into storage, nothing is serialised, nothing is hashed, nothing goes into the duplicate set. Sorting those six-byte stubs gives the exact cut-off, and a second pass then replays only the moves above it and stores the results. Replaying a move costs a handful of PEXTs. The expensive steps, which are the serialising, the hashing and the duplicate check, now happen only for survivors, and a parent position gets unpacked once no matter how many of its children made it through. The search covers the same positions and produces the same answer, byte for byte. On a 15×15 board at a beam of 10,000, the run went from 3,718 milliseconds to 1,306.

## Getting the same answer twice

Run a parallel search twice and you will usually get two different answers, neither of them wrong. They differ because the line between "good enough to keep" and "cut" lands in a slightly different place depending on which thread got there first. That is a nuisance when something breaks, since a bug that shows up once may not show up again, and it makes the question every optimisation raises, did that help, impossible to answer.

The fix was to give every comparison in the search a tiebreak, so that nothing is ever settled by thread timing. The comparison that decides who makes the shortlist matters most.

```cpp
auto better = [](const uint8_t* a, const uint8_t* b) {
  float oa = getObj(a), ob = getObj(b);
  if (oa != ob) return oa > ob;   // best objective wins
  return getHash(a) < getHash(b); // tie: the board itself decides
};
```

The same idea runs through the rest of the search. When two different sequences of moves arrive at the same position with the same ranking, the solver keeps whichever sequence comes first alphabetically. When two finished games score the same, it prefers the shorter one, and falls back on alphabetical order again if the lengths match too.

The result is an output that is identical, byte for byte, on 1, 2, 4, 8 and 16 threads, which the test suite checks on random boards. It did not cost the parallel speedup: on a 15×15 board at a beam of 20,000, sixteen threads still finish 5.7 times faster than one, on eight physical cores, with the last stretch coming from hyperthreads. That is a statement about scaling rather than proof that the ordering rules are free. I never built a non-deterministic version to race against at the same thread count, so what I can say is that the guarantees left the scaling intact.

## Knowing when a board cannot be cleared

Deciding whether a SameGame board can be emptied at all is NP-complete, and it stays hard at sizes that look far too small to be difficult. [Two colours and two columns is already enough](https://erikdemaine.org/papers/Clickomania_MOVES2015/).

Plenty of boards cannot be cleared. A beam search hunting for a clear on one of those will not hang, since every click removes tiles and every game therefore ends, but it will spend its entire budget before it reports the failure. An exact prover, which keeps going until it has an answer either way, can run very much longer than that.

So bitbeam carries a set of refutations, meaning rules that can prove a board is impossible and that never claim a board is fine. The asymmetry is deliberate, because a rule that wrongly rejects a solvable board would cost the solver games it could have won.

- A colour with exactly one tile left can never be removed, since a click needs two of them. That board is dead.
- A single column can be cleared if and only if its sequence of colours is generated by the grammar `S → Λ | S S | c S c | c S c S c`, a result from [Biedl, Demaine, Demaine, Fleischer, Jacobsen and Munro](https://arxiv.org/abs/cs/0107031). It fires constantly, because columns keep collapsing and boards get narrow towards the end of a game.
- [Takes and Kosters](https://liacs.leidenuniv.nl/~takesfw/pdf/samegame.pdf) proved, in their Theorem 3, that a two-colour board at least five wide and five tall whose bottom half is a chessboard pattern cannot be cleared, whatever sits above it. The size condition earns its keep. On a narrow board a tile dropping onto the chessboard can pair with the tile it lands on, which punches a hole in the pattern, and the rule would be wrong.

Every rule is checked against exhaustive search on thousands of small boards before it is trusted. They are also less useful than they look. In the exact prover they cut the number of positions examined by 1.0 to 4.4 times on boards from 6×6 to 8×8, which is the case they were written for. In beam search on boards that can be cleared they cost about 8 percent and save almost nothing, which makes sense once you say it out loud: a refutation only pays off when the answer is no, and random boards are overwhelmingly solvable. They stay switched on because the boards where they help are the ones that otherwise never finish.

## Does it play any better?

Here it is against the genetic algorithm I had been using, on six random 15×10 three-colour boards, with every configuration asked to empty the board. The genetic algorithm is a current rewrite of [the 2011 solver](https://github.com/wteuber/samegame_autoplay/tree/master/software/solver/evolutionary) that used to drive the bot, running on Ruby 4.0.4. The first row is how the bot invokes it, at a population of 10 for 200 generations. Times are wall clock and include process startup.

| Solver | Mean score | Boards cleared | Mean time |
|---|---:|---:|---:|
| Genetic algorithm, one core, no JIT | 2,031 | 6/6 | 666 ms |
| Genetic algorithm, YJIT and 8 Ractors, population 64 | 2,613 | 6/6 | 3.3 s |
| Genetic algorithm, YJIT and 8 Ractors, population 256 | 2,852 | 6/6 | 13.4 s |
| bitbeam, beam 5,000, 16 threads | 3,676 | 6/6 | 136 ms |

The first row and the last one are the two the bot would actually choose between: bitbeam scores 81 percent higher and takes a fifth of the time. The rows in between are there because the obvious objection to that comparison is that Ruby is slow, and I do not think slowness is what the table shows.

The evaluation loop in the Ruby solver got twelve times faster when I rewrote it, on identical work, and the language had nothing to do with it. The 2011 version copied the board with `Marshal.dump` and `Marshal.load` for every candidate move, and a profile put 82 percent of its runtime inside those two calls and the garbage collection needed to clean up after them. Swapping the nested arrays for one flat array and reusing the scratch buffers took 40 evaluations of a 15×15 board from 1.75 seconds to 0.14, and the objects allocated from 1.6 million to 213. Turning on YJIT, Ruby's just-in-time compiler, takes that to 0.054 seconds, a further 2.7 times. It did nothing measurable for the 2011 code, because there was no Ruby bytecode left to compile: that version had already handed its real work to `Marshal`, which is C.

Ractors, Ruby's mechanism for running code on several cores at once, cut a population-64 run from 7.9 seconds to 3.3 across eight of them, with results identical to the serial version. Those two features are what the middle rows use, along with the bigger populations they make affordable. The extra score is real, and it is expensive: the last row spends about a hundred times bitbeam's runtime to land 22 percent below it.

So the gap is not the language. A genetic algorithm samples whole sequences of moves and breeds the ones that worked. Beam search looks at every legal move at every depth and keeps the best few thousand positions under an ordering it can justify. The second approach suits this puzzle better, and neither a JIT nor more cores changes that. What Ruby costs here is a constant factor, and a smaller one than its reputation suggests.

sgbust is missing from the table, and not because it lost. For the build reasons above I have no end-to-end figure for it that would be about its algorithm rather than its dependencies, so the routine-level comparison earlier stands in for it.

## What it looks like

This is easier to show than to describe. Below is a bot playing [the browser version of SameGame](/public/samegame){:target="_blank"} with bitbeam choosing the moves. Real clicks on a real page, seven 30×20 three-colour boards cleared one after another.

![A bot playing SameGame in the browser, clearing board after board with moves found by bitbeam](/assets/img/2026-08-29-how-bitbeam-plays-samegame-thinking-in-bits/bitbeam-bot-playing-samegame.gif){:style="border-radius: 8px; display: block; margin: 0 auto;"}

The recording runs in real time: 74 seconds for the seven boards, roughly ten seconds each. Two or three of those ten seconds are the pause you can see when a fresh board appears, while the bot reads the tiles off the screen and bitbeam works out the entire game before the first click lands. The rest is the bot working down a list of about fifty moves at six to seven clicks a second, which is what its tenth-of-a-second wait between clicks comes to once the mouse movement is counted. Quick enough that you cannot tell why a particular group was chosen, slow enough to watch the board come apart.

## Wrapping up

None of the ideas here is new. Beam search dates back to speech recognition work in the 1970s, PEXT has been in Intel processors since 2013, and not doing work you are about to throw away is ordinary engineering advice. What made the difference was applying them to one problem and measuring after every step, including the step in Ruby that made things slower and got reverted.

The determinism work paid off in a way I had not planned for. Once the output stopped changing between runs, judging every other change became easy, because any difference in the result had to have come from the change. The refutations went the other way. They are sound, they were satisfying to implement, and they are worth almost nothing on the boards you actually meet. Neither of them was on the list when I started.

*The bot in the recording above is a separate program. It reads the board by looking at pixels on the screen and plays by moving the actual mouse, which is a story for another post.*
