---
layout: post
title: "PennyWise: How Much of a Part-Payment Is Tax?"
subtitle: The rounding bug that turns up when a taxed bill is paid in installments, and the one idea that kills it, a running tax total you are only ever allowed to floor. Splitting a bill between diners is the same problem.
# cover-img: /assets/img/2026-09-10-pennywise-how-much-of-a-part-payment-is-tax/staircase-cover.png
# thumbnail-img: /assets/img/2026-09-10-pennywise-how-much-of-a-part-payment-is-tax/staircase.png
# share-img: /assets/img/2026-09-10-pennywise-how-much-of-a-part-payment-is-tax/staircase-share.png
tags: [algorithms, ruby, mathematics, money, engineering]
author: Wolfgang Teuber
---

There is a clown in the sewer with this name, and there is an old proverb about being wise with pennies and foolish with pounds. This post is about neither. It is about a genuinely annoying little problem that turns up the moment you let someone pay a taxed bill in more than one go, and a piece of arithmetic that makes it disappear.

Here is the problem in one line. A bill of **$10.70** includes **7% tax**. That is $10.00 of goods and $0.70 of tax. The customer pays it off in three installments: $5.00, then another $5.00, then the last $0.70. **How much of each installment was tax?**

You need the answer for real reasons. Tax gets remitted on a schedule, so the books have to know how much tax rode along with each payment as it arrived, not just the total at the end. Refund the second installment and you have to give back exactly the tax that was in it. Every installment prints a receipt, and the receipts have to sum to the invoice.

The obvious answer is wrong. Seven percent of $5.00 is $0.35, and $0.35 + $0.35 + a bit more is already past $0.70. That is not a rounding curiosity, it is the tax being computed on the wrong base. The right split turns out to be **$0.32, $0.33, $0.05**, and the reason the middle installment carries an extra penny is the whole story.

I wrote a small Ruby library called PennyWise that does this split and guarantees the parts reconcile. It was built for installments, but the arithmetic does not actually know what a payment is. Feed it three shares of one restaurant bill from three diners instead of three payments from one customer and it splits the tax between people just as exactly. [Splitting a bill](#splitting-a-bill-is-the-same-problem) falls out as a byproduct, and I come back to it near the end.

If you would rather poke at the idea than read about it, there is [an interactive version](#see-the-problem-first) a few paragraphs down: put in your own numbers and watch the standard method drift while PennyWise stays exact.

## Why the naive split drifts

The tax on a partial payment is not "the payment times the rate". A gross amount `G` that already includes tax at rate `r` breaks down like this:

```
G = net + net * r = net * (1 + r)
net = G / (1 + r)
tax = G - net = G * r / (1 + r)
```

For the whole bill that gives `10.70 / 1.07 = 10.00` net and `0.70` tax, as it should. For a single $5.00 slice it gives `5.00 * 0.07 / 1.07 = 0.3271...`, so about 32.7 cents.

Now round that. Payment one: 33 cents. Payment two: 33 cents. Payment three, on $0.70: `0.70 * 0.07 / 1.07 = 0.0458...`, round to 5 cents. Total tax collected: **71 cents**. The bill was 70. You have invented a penny, and your ledger no longer balances.

Round differently, say always down, and you lose a penny instead. Change the payment sizes and the error changes with them. Over one bill it is a penny. Over a few hundred thousand invoices it is a support ticket, an accounting discrepancy, and an afternoon you will not get back.

The fix has three parts: stop using fractions of a cent as your unit, extract the tax once instead of per payment, and distribute the pennies with a rule that cannot drift.

## See the problem first

Before the fix, get a feel for the size of it. Put in a bill total, a tax rate, and the number of equal installments it is paid off in. Each installment is split two ways: the everyday accounting-software approach of rounding its tax on its own, and the method the rest of this post builds. Watch the **Standard rounding** total drift off the invoice, and the **PennyWise** total not.

{% include pennywise-tax-meter.html %}

On any one bill the standard method is rarely more than a few cents out. Multiply that by a year of invoices, or by every seller on a marketplace, and it is the reconciliation line nobody can account for. The next three sections are how PennyWise gets the right-hand column to reconcile every time.

## Part 1: count in atoms, not in dollars

The first move is the one every "don't store money in a float" article tells you to make. Pick the smallest unit the currency has, an **atom**, and do all the arithmetic in whole numbers of atoms.

- US dollars: the atom is one cent. `$10.70` is `1070`.
- Bitcoin: the atom is one satoshi, `0.00000001` BTC. One bitcoin is `100_000_000`.
- A currency with no minor unit: the atom is one whole unit.

```
to_atoms(amount, atom):
    q = amount / atom
    fail unless q is a whole number      # $10.705 is not a real payment
    return integer(q)
```

From here on there are no dollars in the code, only counts. `1070` atoms of bill, `500` atoms of first payment. Integers add up exactly, which is the entire point, and the only place a fraction is allowed to appear is inside the next two steps, where it is immediately floored back to an integer.

## Part 2: extract the tax once, for the whole bill

Before any payment is processed, compute the tax content of the entire bill, in atoms, one time:

```
total_tax_atoms(total_atoms, rate):
    # exact rational arithmetic, then a single floor
    return floor( total_atoms * rate / (1 + rate) )
```

`rate` here is an exact fraction, `7/100`, not the binary float `0.07` (which is really `0.070000000000000006...`). Do this step in whatever exact or rational type the language gives you, and let the single `floor` be the only thing that turns it back into an integer. For the example, `floor(1070 * (7/100) / (107/100))` is `floor(70.0)`, which is `70`.

That `70` is now a fixed target. Everything the rest of the library does is share those 70 tax atoms out across the payments so that they sum to exactly 70, no matter how the payments fall. The net atoms are just `total_atoms - total_tax_atoms`, here `1000`, and they get shared out the same way by subtraction.

## Part 3: the running total you may only floor

This is the idea the whole library is built on, and it is smaller than it sounds.

Define a function that answers one question: **by the time a customer has paid `p` atoms of this bill, how many whole tax atoms have they covered?**

```
tax_through(p, total_tax_atoms, total_atoms):
    return 0 if total_atoms == 0
    return floor( p * total_tax_atoms / total_atoms )
```

It is a straight-line ramp from `(0, 0)` to `(total_atoms, total_tax_atoms)`, snapped down to whole atoms at every point. `tax_through(0)` is `0`. `tax_through(total_atoms)` is `floor(total_tax_atoms)`, which is already a whole number, so it is exactly `total_tax_atoms`. The two endpoints are nailed down.

The tax inside a single payment is then just the **difference between two readings** of that function, one before the payment and one after:

```
split_payment(amount_atoms, previously_paid_atoms, total_tax_atoms, total_atoms):
    before = tax_through(previously_paid_atoms,                total_tax_atoms, total_atoms)
    after  = tax_through(previously_paid_atoms + amount_atoms, total_tax_atoms, total_atoms)
    tax = after - before
    net = amount_atoms - tax
    return { tax: tax, net: net }
```

Run the example through it. `total_tax_atoms = 70`, `total_atoms = 1070`.

| Payment | paid before | paid after | `tax_through` before | `tax_through` after | tax this payment |
|---|---:|---:|---:|---:|---:|
| $5.00 | 0 | 500 | `floor(0.00)` = 0 | `floor(32.71)` = 32 | **32** |
| $5.00 | 500 | 1000 | `floor(32.71)` = 32 | `floor(65.42)` = 65 | **33** |
| $0.70 | 1000 | 1070 | `floor(65.42)` = 65 | `floor(70.00)` = 70 | **5** |

Sum of tax: `32 + 33 + 5 = 70`. Exactly the bill. The extra penny landed in the second payment because that is where the straight line `p * 70 / 1070` happened to cross an integer between the two readings. It was not a decision. It was a coordinate.

### Why it always reconciles

The payments cut the interval `[0, total_atoms]` into consecutive pieces:

```
0 = p_0  <  p_1  <  p_2  <  ...  <  p_k = total_atoms
```

The tax assigned across all of them is

```
  ( tax_through(p_1) - tax_through(p_0) )
+ ( tax_through(p_2) - tax_through(p_1) )
+ ...
+ ( tax_through(p_k) - tax_through(p_{k-1}) )
```

Every interior term appears once with a plus and once with a minus. The sum **telescopes** to `tax_through(p_k) - tax_through(p_0)`, which is `total_tax_atoms - 0`. There is no rounding policy to argue about, no accumulator to reset, no "where does the remainder go" special case. The middle terms cancel on paper, so the total is exact by construction, for any bill, split any number of ways, in any order.

Two more properties fall out of the same picture for free:

- **No payment is ever assigned negative tax.** `tax_through` never decreases, because it is a non-negative slope floored, so `after >= before` always.
- **No payment is assigned more tax than its own size.** The slope `total_tax_atoms / total_atoms` is at most `1` (tax cannot exceed the bill), so over a stretch of `n` atoms the floored ramp can climb by at most `n`. That keeps `net` at zero or above.

And because `split_payment` only needs `previously_paid_atoms` plus the two bill-level constants, the state you have to persist between payments is **a single integer**. You can stop after payment two, store `1000`, come back next month, and payment three computes identically. No payment history table required.

## Floor, not round, and why that is the honest choice

It is tempting to round `tax_through` to the nearest atom instead of flooring. Don't. Flooring means a customer is never told they have paid tax they have not yet paid, at any point in the sequence. The ramp sits at or just below the true proportional line the whole way along, and only catches up to it exactly at the final payment. Rounding would let intermediate payments run slightly ahead of the true share and then claw it back later, which is harder to explain on a receipt.

The shape this produces, a diagonal line approximated by a staircase of unit steps placed as evenly as the integers allow, is the same shape you get when a computer draws a slanted line on a pixel grid. That is [Bresenham's line algorithm](https://en.wikipedia.org/wiki/Bresenham%27s_line_algorithm), from 1962. It is also what a good analogue photograph does with a gradient, and what audio dithering does with a fade. "Distribute N indivisible things across M slots as evenly as possible, with no drift" is a genuinely old problem with a genuinely settled answer, and splitting tax across payments is just another instance of it wearing a suit.

## Testing a claim like "always"

"The parts always sum to the whole" is a strong word, and the way to earn it is not to write three examples and call it a day. PennyWise is checked with **property-based testing**: the test harness generates thousands of random scenarios and asserts the invariant on every one.

```
repeat 1000 times:
    total_atoms = random integer in 1 .. 10_000_000
    rate        = random fraction in 0 .. 1/2
    # pick random cut points, sort them, use the gaps as payment sizes,
    # so the payments are guaranteed to sum to total_atoms
    cuts  = sorted( [0, total_atoms] + random points in 0 .. total_atoms )
    parts = consecutive differences of cuts, dropping zeros

    expected = total_tax_atoms(total_atoms, rate)
    paid, tax_sum, net_sum = 0, 0, 0
    for part in parts:
        s = split_payment(part, paid, expected, total_atoms)
        tax_sum += s.tax
        net_sum += s.net
        paid    += part

    assert tax_sum == expected
    assert net_sum == total_atoms - expected
    assert tax_sum + net_sum == total_atoms
```

Random totals, random rates, random numbers of parts at random sizes. The generator builds the parts from sorted cut points precisely so their sum is exactly the total by construction, and then the only thing left to break is the distribution. A random set of cut points is a random installment schedule and a random bill split at the same time, so this one test covers both readings of the problem. If the telescoping argument above were wrong, a thousand random draws would find it. They don't, because it isn't. Every language has a library for this style of test: `hypothesis`, `fast-check`, `QuickCheck` and the rest.

## The edges worth naming

- **Overpayment.** A payment that would push the paid total past the bill is rejected before it is split, rather than being silently trimmed.
- **Non-atomic amounts.** `$10.705` at a one-cent atom is not a payment anyone can actually make, so `to_atoms` refuses it instead of rounding it into something plausible.
- **Zero total.** `tax_through` returns `0` immediately, so a zero bill splits into a pile of zeros without dividing by anything.
- **Negative inputs.** Rejected at the door. There is no meaningful negative payment in this model.

## Splitting a bill is the same problem

Everything so far has been one customer clearing one balance over time. Now change the scene entirely: one restaurant bill, three friends, each throwing in a different amount at the same moment. How much tax does each of them owe?

It is the identical calculation. The three shares still partition `[0, total_atoms]`; the only difference is that there is no "paid so far" accumulating over weeks, so you walk the cumulative boundaries in one pass:

```
split_bill(shares_in_atoms, total_tax_atoms, total_atoms):
    result  = []
    running = 0
    for share in shares_in_atoms:
        before = tax_through(running,         total_tax_atoms, total_atoms)
        after  = tax_through(running + share, total_tax_atoms, total_atoms)
        tax    = after - before
        result.append({ tax: tax, net: share - tax })
        running += share
    return result
```

The telescoping argument does not care whether the segments are three payments from one person spread across a quarter or three shares from three people settled in the same second. It is a partition either way, the interior terms still cancel, and the tax the table is charged still sums to exactly what the bill says.

Order does not change the total; it only decides which share happens to catch a stray penny. If splitting `$10.70` three ways lands one diner with an extra cent, that is real and it is unavoidable, because 70 does not divide by 3. What you can choose is where it goes: sort the shares and let the largest one absorb it, or rotate the tiebreak between the regulars from one dinner to the next. PennyWise makes that a one-line decision instead of a bug.

## Wrapping up

None of the pieces here are novel. Integer money is standard advice. Extracting tax with `r / (1 + r)` is in every accounting textbook. The telescoping-sum trick is first-year analysis, and the staircase is sixty years old. What makes the library worth its name is that they combine into a function with a property you can state in one sentence and prove in two: **the parts sum to the whole, always, because the middle terms cancel.**

The version that rounds each installment on its own is shorter to write and looks right in the demo. It fails quietly, at scale, in a way that costs someone a reconciliation. The version that keeps a single running tax total and only ever floors it is barely longer, and it cannot fail that way, because there is no accumulator drifting and no remainder looking for a home. That is usually the better trade.

And because the proof is about partitions rather than about payments, the same function that splits the tax on an installment plan splits the tax on a dinner between friends, or an invoice between cost centres, or a payout between marketplace sellers. That was never the goal. It is just what you get when the guarantee comes from arithmetic instead of from a rounding policy.
