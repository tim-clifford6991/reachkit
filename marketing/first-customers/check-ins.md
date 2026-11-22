# R12: Day-14 and day-30 check-ins and the referral ask

**Audience:** one of the first 50 customers, 14 and 30 days after paying. **Message:** "Here's what went live
on your site, and I'm here." **Call to action:** day 14, reply with one thing to change; day 30,
introduce one owner who should see their own report. Sent by the owner, one to one (WhatsApp,
LinkedIn or email, whichever they used to reach you).

Reviewed by customer-success on #2693; its changes are applied here (#2698).

## Owner to do

- [ ] Before each message, open `/app/review` (owner only) and the customer's live pages, and fill
      the braces with what they show. If a number isn't there, use the "nothing measured yet"
      variant. Never estimate, and never quote a number `/app/review` doesn't show.
- [ ] Send day 14 on the first weekday after a Monday email, on or after day 14, so your numbers
      match the email they last read.
- [ ] Ask for a quote only with their written yes to use it, and say where it will appear. A quote
      or their site on a public page also needs the consent the SPEC asks for (SPEC §1 *Our own
      report only*: a customer's report is shown only once they consent).
- [ ] You send every message. Nothing is sent by an agent.

## Where to read their numbers (owner only, never in a public post)

You cannot open a customer's own `/app` (Overview, Google, AI or Competitors tabs): only
`/app/costs` and `/app/review` let the owner in (`src/app/(account)/app/review/page.tsx:18`). So read
only these:

| Number | Where | Evidence |
|---|---|---|
| Pages live, with links | `/app/review` › Pages | `review.tab.pages` (`src/lib/presentation/copy/keys/review.ts:14`) |
| Pages planned this week | `/app/review` › Week | `review.tab.week` (`review.ts:13`) |
| Each page's reading | `/app/review` › Pages label: *Too early*, *Climbing*, *Working*, *Not moving* or *not measured* | `review.label.*` (`review.ts:42–46`) |
| The page itself | Open `{label}.{domain}/…` | — |

`/app/review` has no "found by Google", "in results" or "first page" count, so these messages never
say one. *Too early* is the honest state in week 2; it never reads as failure.

---

## Day 14: check-in

**Goal:** catch a problem early; make them feel looked after. No ask for money or referrals.

> Hi {name}, two weeks in, so a quick check from me.
>
> So far {n} pages are live on {label}.{domain}, and {m} more are planned this week. The one I'd
> read first: "{page title}" ({link}).
>
> {Where every label is *Too early* or *not measured*: "Pages go live in week 1. Google takes
> weeks to months; each Monday email shows how your pages are doing."}
>
> One question: is there anything in the pages that doesn't sound like you? Tell me and I'll show
> you where to change it.

The sentence in braces is the landing's own words, quoted as they are (`landing.faq.results.short`,
`src/lib/presentation/copy/keys/report.ts:677`).

**If they reply with a change:** show them where it lives, on a short call or in a message. Voice,
"Never say", Your business and competitors are in Settings, which they set with your guidance (you
can't open their Settings). A page they dislike: "Stop this page", in the email or in *This week*.
Stopping a page also keeps that topic away for four weeks (`TOPIC_REST_DAYS` = 28,
`src/lib/config/constants/opportunities.ts:158`). Never promise a topic is gone for good.

**If no page is live yet:** don't send this. Call them and fix the connection together first
(the setup promise, D2).

## Day 30: check-in and referral ask

**Goal:** a referral (a lead getter, Hormozi) and, if they offer it, a quote.

> Hi {name}, a month of ReachKit today. {n} pages are live on your site now. {Only where
> `/app/review` labels them so: "{w} of them are already Working in Google."} {Otherwise: "Pages go
> live in week 1. Google takes weeks to months; each Monday email shows how your pages are doing."}
>
> Thanks for being one of the first. A quick favour: who else do you know who owns a business
> website and never has time for marketing? Could you send them this link, or introduce us:
> https://reachkit.app/?ref=referral {Only while spots are left (until 31 Jan 2027): "I'll
> set them up personally too, the same way."} {After that: "They can run the free scan on their
> own site and see what you saw."}

**If they say something good**, ask once:

> That's great to hear. Could I quote you on that, with your first name and business? I'd use it
> {where: e.g. "in a LinkedIn post"}. Totally fine to say no.

Write their exact words and their yes in the private lead tracker. A quote never goes on
reachkit.app without the owner's ruling and the customer's consent.

**If they're unhappy:** no referral ask. Ask what would make it worth €49 to them, note it, and
answer the reason, not with a discount:

| Their reason | Your answer |
|---|---|
| "Not seeing results" | The landing line above, and the pages planned for next week |
| Something technical | `/app/issues` or the connection, fixed together |
| Business closed or changing | Let them go with the cancel line below |

No coupon and no pause: one plan, and the second-month credit (D3) is on hold. If they want to stop:

> Cancel any time in Settings; you're not charged again. Your export of every page stays
> available. You keep access to the end of the month you've paid for, and pages we host stay up
> for 30 days after that, with an email before they come down.

Evidence: `landing.faq.stop.short` (`report.ts:678`); Terms §4 and §6 (`legal.terms.body`,
`src/lib/presentation/copy/keys/chrome.ts:197`); `HOSTED_RETENTION_DAYS` = 30
(`src/lib/config/constants/costs.ts:306`), with the notice from
`src/lib/account/billing/hosting-notices.ts`. Payments aren't refunded unless the law requires it
(Terms §4; README rule 1).

## The referral itself

| Step | What |
|---|---|
| They want to refer someone | Thank them. An introduction (a message to both of you) or the link `https://reachkit.app/?ref=referral` works best. If they give you a name instead, ask: "Can I say you sent me?" |
| You write to the person | Warm opener (`scripts.md` §1), first line: "{customer} said you might like this." Link with `?ref=referral` |
| The person runs a scan | Same path as everyone: walkthrough, offer, call |
| They pay | Tell the customer who referred them: "{name} joined, thank you." No reward exists: one plan, no credits or add-ons (SPEC §1 *One plan*; D6 defers any partner or affiliate scheme) |

## What to measure

| Measure | How, today |
|---|---|
| Day 14 sent on time | Private tracker |
| Still paying at day 30 | `paid` event exists; renewal is in Stripe |
| Pages live by day 30 | `/app/review` › Pages; `draft_published` events for their site |
| Referred people who scanned and paid | `?ref=referral` is stored with the scan (#2692; `docs/RUNBOOK.md` §8 queries), and by hand: `heard_from` = "referral: {customer}" in the tracker |

The three analytics events are `scan_started`, `paid` and `draft_published`
(`src/lib/analytics/index.ts:35`). A fourth event is an owner ruling; none is asked for here.
