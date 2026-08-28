---
layout: post
title: The Delivery Never Came. The Survey Always Did.
subtitle: What a five-month broken order taught me about the gap between the systems that sell and the systems that serve.
cover-img: /assets/img/2026-08-28-the-delivery-never-came-the-survey-always-did/cover.png
thumbnail-img: /assets/img/2026-08-28-the-delivery-never-came-the-survey-always-did/share.png
share-img: /assets/img/2026-08-28-the-delivery-never-came-the-survey-always-did/share.png
tags: [customer experience, communication, operations, leadership, trust]
author: Wolfgang Teuber
---

On day 126 of waiting for timber I had already paid for, the retailer sent me an email. It opened like this:

> "Our records suggest you recently received a delivery from us, and we'd like to see how we did."

Nothing had been delivered. Four separate delivery dates had already come and gone in silence. And yet somewhere inside that company, a system was confident enough about my delivery to ask me to rate it.

That email has stayed with me longer than the missing timber did. Not because it was rude - it was perfectly polite - but because it was *sincere*. Nobody wrote it in bad faith. It was a well-built system doing exactly what it was designed to do, on schedule, with no idea that a different system in the same building had failed four times in a row.

I'm not going to name the retailer. The point isn't who they are. The point is that I'd bet good money the same failure is running quietly inside a dozen companies you bought from this year - and quite possibly inside yours.

## What actually happened

I ordered materials for a decking project from a large home-improvement chain. Here is the whole thing, in the only unit that matters: days.

![Timeline of missed delivery promises against feedback requests](/assets/img/2026-08-28-the-delivery-never-came-the-survey-always-did/promises-vs-surveys.png){:style="border-radius: 8px;"}

**Day 0.** I order. The confirmation names two delivery dates, four and five days out. I plan the work around them.

**Days 4 and 5.** Both dates pass. No delivery. No email. The carrier's tracking page quietly changes the date, then changes it again.

**Day 19.** After two weeks of nothing, I make contact. I am the one who starts the conversation - a detail worth holding on to, because it never stopped being true.

**Day 24.** A lorry arrives, unannounced, on a day nobody told me about. Half my order is on it. I find out about the other half by reading the delivery note the driver hands me: the rest is *cancelled, out of stock*. A decision about goods I had already paid for reached me as small print at my own front door.

**Day 32.** After three more emails - including one where a second agent asks me to supply my name and address, which were sitting in the thread he was replying to - the missing half is refunded.

**Day 118.** The item is back in stock. I order it again, and pay a second delivery charge.

**Days 123, 124, 128.** Three more delivery dates announced. Three more days of nothing. On one of them the depot phones to ask if a particular day suits me. I say yes. That day passes too.

**Day 130.** A lorry arrives unannounced again. Again with half the order. Again the rest simply isn't on it, and again no email says so.

**Day 132.** I write through their contact form. No reply, ever.

**Day 138.** I phone. The agent promises to call back. No call back.

**Day 146.** A new delivery date, put in writing. It passes. The carrier emails to say the van is "out for delivery" on a day when no van existed.

**Day 149.** The timber arrives. Five months after I ordered it.

Seven delivery dates promised in writing and missed. Two deliveries, both partial, both unannounced. Two contacts that got no reply at all. And in all of that: **zero** times the company told me first that something had gone wrong.

Six times, though, it asked me how I felt about it.

> **"A company that can email you six times to ask how the delivery went can email you once to say it isn't coming." - [Click to post this on X!](https://twitter.com/intent/tweet?text=A+company+that+can+email+you+six+times+to+ask+how+the+delivery+went+can+email+you+once+to+say+it+isn%27t+coming.)**

## Lesson 1: Silence is a decision, and customers hear it as one

Timber runs late. Stock runs out. Lorries break. I have run enough delivery-dependent work to know that some percentage of promises will always break, and I would have forgiven every single one of these.

What I could not forgive was the silence around them.

Here is the asymmetry that made it so corrosive: **the retailer always knew before I did.** They knew on day 3 that the day 4 delivery wasn't loading. They knew when the stock ran out. They knew the van hadn't left. In every case, hours or days before I found out, someone in that organisation had the information that would have let me plan my week.

Not sending that message isn't neutral. It is a small, repeated decision to move the cost of your problem onto the customer - they can sit at home waiting, they can chase you, they can find out from a driver. Each individual instance is defensible. The pattern is what people remember, and the pattern reads as contempt even when nobody involved feels any.

If you take one thing from this post: **the message that a promise is broken is worth more than the promise was.** It costs almost nothing to send and it is the entire difference between "these things happen" and "these people don't care."

## Lesson 2: Your systems disagree with each other, in public

The day-126 survey is the part I keep turning over, because it wasn't a service failure. It was an *architecture* failure that happened to be visible from outside.

Somewhere in that company:

- The **marketing system** knew my email address, my order, and roughly when a delivery should have landed. It fired a satisfaction survey off a scheduled date.
- The **fulfilment system** knew the delivery hadn't happened.
- The **support system** knew there was an open complaint about exactly that.

Three systems, one customer, no shared view. And the one that reached me was the one with the least idea what was going on.

Customers don't see your org chart or your integration backlog. They see one company with one voice. When that voice contradicts itself - a survey for an undelivered order, an "out for delivery" alert for a van that doesn't exist, three different phone numbers in a single email - they don't conclude that your CRM and your WMS aren't talking. They conclude that you're not paying attention.

The practical test is uncomfortable and cheap to run: **can any outbound message be suppressed by a fact known elsewhere in your company?** If your "how did we do?" email cannot be stopped by an open complaint or an undelivered order, it isn't a customer communication. It's a mailshot wearing one as a costume.

## Lesson 3: Measuring satisfaction is not the same as delivering it

There's a second cost to that survey, and it lands on the company rather than me.

I never filled it in. Neither, I'd guess, did most people in my situation - the ones who are actually angry mostly don't answer, because answering feels like being asked to grade your own mugging. The customers who *do* reply to a delivery survey are disproportionately the ones whose delivery arrived.

So the feedback loop that was supposed to detect this failure was structurally incapable of seeing it. Worse, it was actively generating evidence that things were fine. Somewhere there is a dashboard with a home-delivery satisfaction score on it, and that score does not contain me, or my seven missed dates, or the five months.

**A metric that fails to capture your worst outcomes is not a neutral metric. It is a reassurance machine.** If you run a customer-experience programme, the important question isn't "what's our score?" It's "which failures can our measurement not see?" - and then going to find those people deliberately, because they will never come to you through the survey.

## Lesson 4: "Making it right" has to include the cost of being wrong

One more detail, because it's the part most companies get wrong while believing they've behaved well.

When my order was first placed, the goods were on promotion. When the retailer couldn't supply them and cancelled the line, they refunded exactly what I'd paid - the discounted price. Arithmetically flawless. Nobody did anything improper.

But by the time the item came back into stock and I could re-order, the promotion had ended. The identical goods now cost about €100 more, and I paid a second delivery charge of €50 to have them brought to the same door.

So the retailer's own failure to deliver made my purchase roughly €150 more expensive - and every individual step in that chain was correct. No policy was broken. No one had to approve it. It simply happened, silently, in the space between two departments.

**A refund only makes someone whole if the world hasn't moved on by the time they can re-buy.** When your failure forces a customer to transact twice, the difference between those two transactions is your cost, not theirs. Someone needs the authority to see that and just fix it - without the customer having to notice, argue, and ask.

## What I'd change on Monday morning

If I ran that operation, none of this would need a transformation programme. It needs four small things:

1. **Make the broken-promise message automatic and mandatory.** The moment a delivery date fails, the customer hears it from you - before the slot ends, not after. No approval, no queue.
2. **Give every outbound message a kill switch driven by order state.** An open complaint or an undelivered order suppresses every survey, review request and marketing email tied to it. One rule, enormous return.
3. **Route "no reply" as a failure, not a gap.** A contact form message with no response after 48 hours should page someone. Mine sat forever, and no system anywhere noticed.
4. **Give front-line staff the authority to absorb the cost of your own failure** - a lapsed discount, a second delivery fee - without escalation. The amount is trivial. The signal is not.

None of that is technically hard. All of it is organisationally hard, because each piece lives in a different team's backlog and none of it shows up in a quarterly target.

## The part that actually matters

I got my timber on day 149. The project is finished. The genuinely striking thing is that at no point in five months did anyone treat this as a conversation - it was a series of automated notifications going one way, and me chasing in the other.

One phone call on day 3 - "the timber isn't going to make it this week, here's what I can do" - would have cost that company about ninety seconds and bought them a customer for a decade. Instead they spent five months of automated effort, several agents' time, two delivery runs, a refund and a re-order, and ended up with this blog post.

That's the trade every organisation makes, usually without noticing. Communication feels expensive because it takes a person. Silence feels free because nobody has to do anything. It isn't. **You always pay for the message you didn't send - you just pay later, with interest, and you don't get to choose the currency.**

---

*Have you seen the same pattern from the inside - the survey that fired at exactly the wrong moment, the department that couldn't see what another one knew? I'd genuinely like to hear about it. My calendar is [open for a 30-minute conversation](https://meet.wteuber.com/), and this is exactly the sort of thing I like talking about.*
