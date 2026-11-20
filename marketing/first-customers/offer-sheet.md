# R5: The first-50 offer sheet (one page, private)

**Use:** one to one only. Send it after a walkthrough or share it on a call. It is never posted,
never put on a public page and never linked from reachkit.app, because it names what another
vendor charges (`price-anchors.md` A3) and carries the refund line (README rule 1). **Audience:** an owner who has run their free scan. **Message:** your pages,
live on your own site every week, set up with the founder. **Call to action:** book 15 minutes or
start from your report.

## Owner to do

- [ ] Fill `{booking}` (R7) and `{left}` before each send.
- [ ] Export as a PDF (or a private doc) if you send it as a file.
- [ ] `{left}` is the number the site shows (the banner, from `/offer/spots`). Until that ships: 50 minus every first paid checkout not refunded within 14 days, owner and test accounts excluded. Never round it down for pressure.
- [ ] After they pay, confirm the terms in a plain mail by hand (`setup-call.md` › After the call;
      trust-compliance F7).

---

## The sheet (copy below the line into the PDF)

### First 50 Customers: 30-Day Kickstart for Google and AI Answers

**When your buyers ask Google or ChatGPT about {category}, they should hear your name.**

ReachKit researches your market every Monday, then writes pages that answer what your buyers ask,
and publishes them on your own website. You don't write a word.

**What you get**

| | What it would cost elsewhere |
|---|---|
| Up to 7 pages a week, new or updated, written by AI from facts on your own site and published there | In one survey of 213 freelance writers (data from about 2021), the most common rate for a 1,500-word post was $250–399 |
| Where you sit in Google, and which of your pages Google's AI and ChatGPT link to, every week | One AI-answer tracker charges €29 to €489 a month before tax, and writes nothing |
| Up to 5 competitors watched every week | (included above) |
| Your whole site checked for problems, with the fix for each (an automated check) | In an SEO agency's survey of 250 US businesses, 43% paid $101–750 for an audit |
| An email every Monday: what went live and your totals so far | |
| Edit or stop any page before it goes live, or do nothing | |
| **First 50 only:** I set you up personally, on a 15-minute call if you want one | |
| **First 50 only:** a short video of your report, explained by me | |
| **First 50 only:** I check in with you after two weeks and after a month | |
| **First 50 only:** email me directly, any time | |

**€49 a month, VAT included. One plan. Cancel any time from Settings.**

**Set up in about 10 minutes, or we do it with you on a call.** Three short steps and you're
done. If it takes longer, we do it with you on a call, at no cost.

**Why 50:** I set up each of the first 50 customers myself. **{left} of 50 spots left until
31 Jan 2027.**

> **Before you pay**
>
> Read your report and first page before you pay. Payments aren't refunded unless the law
> requires it. Cancel any time from Settings, and download all your pages any time.

**Next step:** book 15 minutes: {booking}, or start from your report:
https://reachkit.app/scan/{domain}

Tim, founder · hello@reachkit.app

---

## Evidence (every line above, live on production on 2026-11-15; rechecked 2026-11-20)

| Line | Source |
|---|---|
| Researches every Monday; writes pages | `landing.story.2.when` "Every Monday" (`src/lib/presentation/copy/keys/landing.ts:20`); `landing.subline` (`report.ts:571`) |
| Up to 7 pages a week, new or updated | `offer.cadence.page` (`offer.ts:36`); SPEC §1 *The pace* (`docs/SPEC.md:94`) |
| Written from facts on your own site | `offer.found.line` (`offer.ts:44`); `setup.business.assurance` (`setup.ts:456`) |
| Google, Google's AI and ChatGPT tracking | `landing.plan.tracking.line` (`landing.ts:63`) |
| Up to 5 competitors weekly | `landing.plan.rivals` with `.line` (`landing.ts:58–59`); SPEC §5 (at most five) |
| Site checked, fix for each | `landing.plan.site.line` (`landing.ts:61`) |
| Monday email | `offer.cadence.movement` (`offer.ts:37`) |
| Edit or stop, or do nothing | `landing.plan.control.line` (`landing.ts:67`) |
| €49, VAT included, cancel any time | `price.amount` (`offer.ts:33`); `landing.plan.terms` (`landing.ts:69`); `pricing.plan.cancel` (`chrome.ts:85`) |
| Set up in about 10 minutes | `setup.step.time` "The three steps take about 10 minutes." (`setup.ts:396`); `SETUP_MINUTES = 10` (`src/lib/config/constants/mail.ts:12`); the call is the owner's promise (D2, lifted 2026-11-20) |
| Download all your pages | `settings.content.export` (`settings.ts:769`) |
| A first page you can read free | `landing.faq.trial.a` (`report.ts:674`); `report.offer.free-path` (`report.ts:837`) |
| Price anchors | `price-anchors.md` A1, A3, A5, worded so each is true as said (#2693). A3 identifies a vendor, so the sheet stays one to one |
| No refund unless the law requires it; the 24-hour wait | Terms §4 and §5 (`legal.terms.body`, `chrome.ts:197`) |
| 50 spots until 31 Jan 2027, the first-50 extras, the setup call | Owner rulings D2, D4 (README, 2026-11-20, #2981), not product features |

Not on the sheet, on purpose: a page a day (SPEC §1 *The pace*), any ranking or mention promise,
the price lock (D1; its line waits for Terms §4, #2993), the second-month credit (D3 on hold), WordPress publishing (off on production, SPEC §5 *DNS only at
launch*), any customer name or result (there are none yet).
