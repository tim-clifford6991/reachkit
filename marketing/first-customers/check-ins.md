# R12: Day-14 and day-30 check-ins and the referral ask

**Audience:** a founding customer, 14 and 30 days after paying. **Message:** "Here's what went live
on your site, and I'm here." **Call to action:** day 14, reply with one thing to change; day 30, name
one owner who should see their own report. Sent by the owner, one to one (WhatsApp, LinkedIn or
email, whichever they used to reach you).

## Owner to do

- [ ] customer-success reviews these drafts before the first day-14 message (wave 1 customers reach
      day 14 around mid-December).
- [ ] Before each message, open their Overview and Monday mail and fill the braces with their real
      numbers. If a number isn't there yet, use the "nothing measured yet" variant. Never estimate.
- [ ] Ask for a quote only with their written yes to use it, and say where it will appear. A quote
      or their site on a public page also needs the consent the SPEC asks for (SPEC §1 *Our own
      report only*: a customer's report is shown only once they consent).
- [ ] You send every message. Nothing is sent by an agent.

## Where to read their numbers (signed in as the owner, never in a public post)

| Number | Where | Evidence |
|---|---|---|
| Pages live, pages planned this week | Overview (`/app`), or their last Monday mail | SPEC §8 *The Monday mail's numbers are Overview's* |
| Their pages in Google: found, in results, first page | Google tab (`/app/search`) | SPEC §4 *Google tab* |
| Pages linked by AI | AI tab (`/app/ai-answers`) | SPEC §4 *The four weekly numbers* |
| Competitors | Competitors tab (`/app/rivals`) | SPEC §4 *Competitors tab* |
| A page they stopped or edited | This week (`/app/calendar`) | SPEC §7 |

The Monday mail and the tabs read the same stored numbers, so quote one and it matches the other.

---

## Day 14: check-in

**Goal:** catch a problem early; make them feel looked after. No ask for money or referrals.

> Hi {name}, two weeks in, so a quick check from me.
>
> So far {n} pages are live on {label}.{domain}, and {m} more are planned this week. The one I'd
> read first: "{page title}" ({link}).
>
> {Only if the Google tab shows it: "Google has already found {x} of them."} {Or, before anything
> is measured: "Google usually takes weeks to months to rank new pages; your Monday email shows
> each step as it happens."}
>
> One question: is there anything in the pages that doesn't sound like you, or a topic you'd
> rather we didn't write about? Tell me and I'll set it so it sticks.

**If they reply with a change:** fix it with them in Settings (voice, "Never say", Your business,
competitors) the same day and tell them it's done. A page they dislike can be stopped before it goes
live ("Stop this page" in the email or the app).

**If no page is live yet:** don't send this. Call them (D2 service promise) and fix the connection
first.

## Day 30: check-in and referral ask

**Goal:** a referral (a lead getter, Hormozi) and, if they offer it, a quote.

> Hi {name}, a month of ReachKit today. {n} pages are live on your site now, {short real fact from
> Overview: e.g. "{x} of them are on Google's first page for their search" or "AI has linked to
> {y} of them"}. {Or, if nothing has moved yet: "Rankings take time; the pages are all there and
> Google has found {x}."}
>
> Thanks for being one of the first. A quick favour: who else do you know who owns a business
> website and never has time for marketing? I'll set them up personally too, the same way.
> Send them https://reachkit.app/?ref=referral or just give me their name.

**If they say something good**, ask once:

> That's great to hear. Could I quote you on that, with your first name and business? I'd use it
> {where: e.g. "in a LinkedIn post"}. Totally fine to say no.

Write their exact words and their yes in the private lead tracker. A quote never goes on
reachkit.app without the owner's ruling and the customer's consent.

**If they're unhappy:** no referral ask. Ask what would make it worth €49 to them, and note it. If
they want to stop: "Cancel any time from Settings, and you're not charged again. Your export of every
page stays available." (`landing.faq.stop.short`, `report.ts:679`). No refund is offered (README
rule 1).

## The referral itself

| Step | What |
|---|---|
| They name someone | Thank them. Ask: "Can I say you sent me?" |
| You message the person | Warm opener (`scripts.md` §1), first line: "{customer} said you might like this." Link with `?ref=referral` |
| The person runs a scan | Same path as everyone: walkthrough, offer, call |
| They pay | Tell the customer who referred them: "{name} joined, thank you." No reward exists: one plan, no credits or add-ons (SPEC §1 *One plan*; D6 defers any partner or affiliate scheme) |

## What to measure

| Measure | How, today |
|---|---|
| Day 14 sent on time | Private tracker |
| Still paying at day 30 | `paid` event exists; renewal is in Stripe |
| Pages live by day 30 | `draft_published` events for their site |
| Referrals named, and referred people who scanned and paid | By hand: `heard_from` = "referral: {customer}" in the tracker. `?ref=referral` is not stored yet (D7 engineering issue) |

The three analytics events are `scan_started`, `paid` and `draft_published`
(`src/lib/analytics/index.ts:35`). A fourth event is an owner ruling; none is asked for here.
