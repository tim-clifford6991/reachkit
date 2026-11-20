# First customers: the first 50

The living plan for ReachKit's first 50 paying customers. The `growth-marketing` agent reads this
folder first for any acquisition, offer, outreach or launch work, and updates it in the same pull
request as the work it changes. Nothing here overrides `docs/SPEC.md`, `docs/PROCESS.md`, #2513 or
the owner's rulings on #2299 and #2513; where they disagree, they win and this folder is fixed.

| File | Holds |
|---|---|
| `README.md` | Goal, status, open owner decisions, readiness gates, change log |
| `icp-and-sources.md` | Who the first 50 are, how to score them, where to find them |
| `offer.md` | The Grand Slam offer: value equation, stack, name, scarcity, urgency, the setup promise, partner offer (deferred, D6) |
| `playbook.md` | Tactics: how to build the offer, how to pitch it, the resources to make, the timeline |
| `scripts.md` | R4: outreach scripts (EN), follow-ups and the call agenda |
| `offer-sheet.md` | R5: the one-page offer sheet, one to one only |
| `walkthrough-video.md` | R6: the 5-minute report walkthrough template |
| `setup-call.md` | R8: the setup-call checklist, checked against `/setup` |
| `social-posts.md` | R10: six LinkedIn and X posts, one finding each, and the posting calendar |
| `check-ins.md` | R12: day-14 and day-30 check-ins and the referral ask |
| `price-anchors.md` | R14: sourced price anchors for the stack |
| `leads.csv` | The lead tracker's columns (the owner keeps the filled copy private, never in the repo). `entity_type`: `company`, `sole_trader` or `partnership`, blank until known. `opted_out_on`: the date they said no; never contact again |

Method: Alex Hormozi, *$100M Offers* (value equation, starving crowd, problems → solutions,
trim and stack, MAGIC naming, scarcity, urgency, bonuses, guarantees) and *$100M Leads*
(the Core Four, lead magnets, ACA warm outreach, the Rule of 100, lead getters). The CLOSER
sales frame is from his sales training.

## Goal

50 paying customers on €49 a month, each with a page live on their own domain, without buying
attention first, by the end of 31 Jan 2027 UTC. Interim targets: 10 paying after the first week
of outreach, 25 after the third.

## The three rules this plan works inside

1. **No money-back guarantee on any public page; nothing refunded by itself** (SPEC, owner
   2026-11-06, #2452 and #2448). The setup promise, "Set up in about 10 minutes, or we do it with
   you on a call", may stand in public (owner 2026-11-20, #2981). The refund line and any credit
   stay one to one, and each needs the owner's yes.
2. **Every free scan is a public card on `/scans`** (SPEC §2). We never scan a prospect's site for
   them. We show what AI says about their market by asking an AI by hand, and they run the scan.
3. **English first** (owner, 2026-11-15, D10). The first 50 are English-speaking businesses in
   English-speaking countries. The German push is dropped from the first 50. No cold email for
   now (D11): the researched leads are reached by a LinkedIn connection plus a message, and by
   public posts. Anyone who says no is never contacted again (`opted_out_on` in the tracker).

4. **Customer words** (owner, 2026-11-20, #2981). Say "first 50 customers", "{left} of 50 spots
   left until 31 Jan 2027" and "Set up in about 10 minutes, or we do it with you on a call". One
   pool, one end date: no batches, sizes or interim dates. "Founder" (the person) is fine; the
   adjective for the offer, a promise of certainty and a delivery deadline in hours are not used
   (the exact words are on #2994). The price-lock line waits for Terms §4 (#2993).

The pace wording is "up to 7 pages a week, new or updated" until SPEC §1 *The pace* takes the
owner's 11-10 "publish daily" ruling (#2513).

## Aggregate figures across stored scans

A figure across many scans is allowed in a post only when it is true as stated, so every condition
below holds. None has been posted.

1. Name no site, business or person, including rivals named in AI answers.
2. Every figure covers at least 20 sites, and no slice (town, category) goes below 20.
3. State the population: "Of {N} sites scanned with ReachKit between {d1} and {d2}".
4. Exclude the owner's, test and fixture scans and removed domains.
5. Keep the query, the date and N with the post (in this folder, next to the post).
6. Never call the sample "businesses" in general.

## Readiness gates (from the growth plan, 2026-11-11)

| # | Gate | Status |
|---|---|---|
| G1 | A stranger walk on a customer's domain, subdomain connects only (D8). WordPress-run sites are not walked, pitched or set up for any of the 50 | open |
| G2 | 7 of 7 pages a day for 7 days in a row (#2498) | open |
| G3 | Legal sign-offs: #1614 and the DPA lawyer review | **dropped as a gate 11-15 (D9): no lawyer and no compliance gate before revenue** |
| G4 | Daily spend ceiling ruled for outreach and launch days (about 80 full-cost scans a day today) | closed 11-15 by D5: ceiling unchanged, outreach staggered |
| G5 | Pace wording in SPEC §1 matches the 11-10 ruling | open |

Warm outreach may start now. Strangers are not asked to pay until G1 and G2 are closed.

## Open owner decisions

| # | Decision | Recommended | Status |
|---|---|---|---|
| D1 | Price lock for the first 50: €49 a month while they stay | Yes | **ruled 11-15: yes. Not said to customers until Terms §4 carries it (#2993, held by owner ruling 57, 2026-11-20)** |
| D2 | The setup promise, plus "read your report and first page before you pay" | Yes | **ruled 11-15; lifted 2026-11-20 (#2981): the promise is "Set up in about 10 minutes, or we do it with you on a call", public, never worded as a certainty. The refund line stays one to one** |
| D3 | Credit: no page live in 7 days → second month free (Stripe coupon by hand) | Hold | **ruled 11-15: hold; gate re-worded 2026-11-20 (#2994, owner ruling 57): hold until G1 and G2 prove a first page live within a week of setup** |
| D4 | Scarcity and end date | Yes | **replaced 2026-11-20 (owner, by selector; #2299, #2994): one pool of 50 spots, open until the end of 31 Jan 2027 UTC or until taken. No sizes or interim close dates anywhere, the owner's outreach scripts included** |
| D5 | Raise the daily scan ceiling on outreach days (G4) | Size with commercialization | **ruled 11-15: keep 1,000¢; launch in small steps, no day planned past ~80 scans; Product Hunt waits** |
| D6 | Partner (web designer) terms: setup help only, or a credit | Setup help only until commercialization rules | **ruled 11-15: no partner or affiliate channel in the first 50; deferred to Phase 2 or later. Simple direct sales and first revenue** |
| D7 | A "how did you hear about us" field or a fourth analytics event | Ask by hand for the first 50 | **ruled 11-15: tagged links per channel (`?ref=`), table below; storing the ref is a separate engineering issue** |
| D8 | WordPress sites in the first 50 | Skip | **ruled 11-15: skipped at first; widened the same day to all 50 (#2698). G1 tests subdomain connects only; WordPress-run sites are not pitched or set up, and score 0 on "can set it up"** |
| D9 | Lawyer and compliance work before revenue | — | **ruled 11-15 (#2698): none for now. The plan is not gated on trust-compliance; no lawyer. What keeps a claim true still applies (price anchors, urgency, the refund wording, the price lock mailed after payment)** |
| D10 | Market | — | **ruled 11-15 (#2698): English-speaking countries and businesses first. The German push is dropped from the first 50; January's outreach stays, in English** |
| D11 | Cold email | — | **ruled 11-15 (#2698): none for now. The 111 researched leads are reached by LinkedIn (connection plus message) and public posts** |

## Channel links (D7)

Every link we hand out carries its channel. Use exactly these tags, lower case.

| Channel | Link |
|---|---|
| LinkedIn (messages and posts) | `https://reachkit.app/?ref=linkedin` |
| X | `https://reachkit.app/?ref=x` |
| WhatsApp and SMS | `https://reachkit.app/?ref=whatsapp` |
| Email, warm (people the owner knows) | `https://reachkit.app/?ref=email` |
| Reddit | `https://reachkit.app/?ref=reddit` |
| Indie Hackers, BetaList and founder communities | `https://reachkit.app/?ref=community` |
| Events, BNI, IHK, coworking (QR code) | `https://reachkit.app/?ref=event` |
| A customer's referral | `https://reachkit.app/?ref=referral` |

The tag is stored (#2692, live on production 2026-11-15): a free scan started from `/?ref={tag}`
keeps an allow-listed tag in `scans.ref` (`src/lib/analytics/ref.ts`), and a payment counts under
the tag of the scan its site was bought from. The owner reads both counts with the two queries in
`docs/RUNBOOK.md` §8, *Where the free scans and payments came from*. A purchase from `/pricing`, or
a scan started from any other page, reads `(none)`, so still ask every payer where they heard of us
and write it in `heard_from` in the private tracker. The three analytics events (`scan_started`,
`paid`, `draft_published`) carry no channel and stay that way.

## Progress

| Date | Contacts | Replies | Scans run | Calls | Paying | Set up in about 10 minutes, or a call |
|---|---|---|---|---|---|---|
| 2026-11-15 | 0 | 0 | 0 | 0 | 0 | — |

## Change log

- 2026-11-20 (#2994; owner rulings on #2981, D4 replaced on #2299, ruling 57 on #2722): the
  outreach material speaks of the first 50 customers, spots left and a 10-minute setup. D4 is one
  pool of 50 spots until the end of 31 Jan 2027 UTC; the batch sizes and interim dates are gone
  from every file, the playbook timeline and the scripts included, and the gate between them is
  now a pause rule. D2 is lifted: the setup promise is public, and the 48-hour promise is gone. D3
  stays held, its gate re-worded to "first page live within a week of setup". The price-lock line
  is held for Terms §4 (#2993), so no customer line promises it. The Progress table measures "Set
  up in about 10 minutes, or a call"; `leads.csv` swaps its 48-hour column for `set_up_by` and
  `first_live_on`. The plan is now "the first 50". Rule 4 (customer words) added. Overlaps #2988,
  which rewrites rule 1, D2 and D4 with the same words.

- 2026-11-15: owner rulings on #2698 recorded as D9–D11 and a wider D8. No lawyer and no compliance
  gate before revenue (G3 dropped as a gate); English first, the German push dropped from the
  Founding 50; no cold email for now, the researched leads go by LinkedIn and public posts;
  WordPress-run sites skipped for all 50. Removed: the trust-compliance channel rule, the
  cold-email conditions and footer, the Companies House and mailbox steps, gates G6 and G7, the
  cold-email channel link and the DE prerequisites. Kept: `entity_type` and `opted_out_on`, the
  true-claim fixes (anchors, urgency, refund wording, the price lock mailed after payment), and the
  seo-master and customer-success changes. The aggregate rules keep only what makes a figure true.

- 2026-11-15: the three specialist reviews on #2693 applied (#2698).
  - seo-master: the approved answer to "Will Google penalise AI pages?" (call, written, DE draft,
    *Never say*) in `scripts.md` §7, the playbook and the social replies; the byline and AI-note
    bullet held until #1127.
  - customer-success: check-ins read only `/app/review`, quote the landing's results line, no
    "sticks" promise (a stopped topic rests four weeks), a fuller cancel line, the referral's
    personal setup only while a wave is open; the setup call fits 15 minutes, names the real mails
    and Checkout fields, and follows up only where the product's reminders and mails haven't. The
    baeckerei-hinkel replay became wave-3 gate G7.
  - trust-compliance: rule 3 replaced by the channel rule (F1, F2); cold email cleared with
    conditions, lawyer confirm pending (C1–C7, gate G6), unused until D9–D11; the cold footer (F3);
    `entity_type` and `opted_out_on` in `leads.csv` (also added to the owner's private copy:
    `company` only for UK rows from a Companies House listing); anchors reworded and the
    equivalence line dropped (F5); true wave urgency (F6); promise and refund wording, and the
    price lock confirmed by a mail by hand (F7); aggregate rules (F9); referrals introduced by the
    customer (F10).
  - The channel tag is now stored with the scan (#2692), so the dependency note is replaced. The
    cold email links `?ref=coldemail`, the tag on the allow-list and in the channel table.

- 2026-11-15: owner ruled D8 on #2694: WordPress sites are skipped for wave 1. G1 tests subdomain
  connects only; WordPress-run sites are not pitched or set up in wave 1 and score 0 on "can set it
  up" for wave 1 (`icp-and-sources.md`). `setup-call.md`, the playbook's G1 step and the WordPress
  objection in `playbook.md` and `scripts.md` follow.

- 2026-11-15: R10 drafted (#2694): `social-posts.md`, six LinkedIn and X posts from our own
  site's report (scanned 9 Nov 2026: 16 of 100, 0 of 12 AI answers, 5 missing questions) and our
  own live pages, posted Mon, Wed and Fri from 30 Nov to 11 Dec. No aggregate scan figures until
  trust-compliance clears them on #2693. The owner re-checks each number against the live report
  on the morning of the post.

- 2026-11-15: week-0 resources drafted (#2689): R4 `scripts.md`, R5 `offer-sheet.md`, R6
  `walkthrough-video.md`, R8 `setup-call.md`, R12 `check-ins.md`, R14 `price-anchors.md`. Owner ruled
  D6 (no partner or affiliate channel in the first 50; partner offer, R11 and web-designer steps
  deferred to Phase 2) and D7 (tagged links per channel; channel-link table added; storing the ref
  is a separate engineering issue). Found: WordPress publishing is off on production
  (`WORDPRESS_CONNECT`), so WordPress sites connect by subdomain and G1's second walk is a
  WordPress-run site on a subdomain. The stack's three price anchors were replaced by sourced ones.

- 2026-11-15: owner ruled D1–D5 (D5 keeps the ceiling, so outreach is staggered and Product Hunt waits).
- 2026-11-15: folder created from the growth plan (2026-11-11) and the Founding 50 research.
