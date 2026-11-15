# First customers: the Founding 50

The living plan for ReachKit's first 50 paying customers. The `growth-marketing` agent reads this
folder first for any acquisition, offer, outreach or launch work, and updates it in the same pull
request as the work it changes. Nothing here overrides `docs/SPEC.md`, `docs/PROCESS.md`, #2513 or
the owner's rulings on #2299 and #2513; where they disagree, they win and this folder is fixed.

| File | Holds |
|---|---|
| `README.md` | Goal, status, open owner decisions, readiness gates, change log |
| `icp-and-sources.md` | Who the first 50 are, how to score them, where to find them |
| `offer.md` | The Grand Slam offer: value equation, stack, name, scarcity, urgency, guarantee, partner offer (deferred, D6) |
| `playbook.md` | Tactics: how to build the offer, how to pitch it, the resources to make, the timeline |
| `scripts.md` | R4: outreach scripts (EN), follow-ups and the call agenda |
| `offer-sheet.md` | R5: the one-page offer sheet, one to one only |
| `walkthrough-video.md` | R6: the 5-minute report walkthrough template |
| `setup-call.md` | R8: the setup-call checklist, checked against `/setup` |
| `social-posts.md` | R10: six LinkedIn and X posts, one finding each, and the posting calendar |
| `check-ins.md` | R12: day-14 and day-30 check-ins and the referral ask |
| `price-anchors.md` | R14: sourced price anchors for the stack |
| `leads.csv` | The lead tracker's columns (the owner keeps the filled copy private, never in the repo). `entity_type`: `company` (Ltd, PLC, LLP or Scottish partnership, checked on Companies House), `sole_trader` or `partnership`, blank until checked. `opted_out_on`: the date they said no; never contact again |

Method: Alex Hormozi, *$100M Offers* (value equation, starving crowd, problems → solutions,
trim and stack, MAGIC naming, scarcity, urgency, bonuses, guarantees) and *$100M Leads*
(the Core Four, lead magnets, ACA warm outreach, the Rule of 100, lead getters). The CLOSER
sales frame is from his sales training.

## Goal

50 paying customers on €49 a month, each with a page live on their own domain, without buying
attention first. Interim targets: 10 by 6 Dec 2026, 25 by 20 Dec 2026, 50 by 31 Jan 2027.

## The three rules this plan works inside

1. **No money-back guarantee on any public page; nothing refunded by itself** (SPEC, owner
   2026-11-06, #2452 and #2448). Guarantees here are service or credit promises, made one to one,
   and each needs the owner's yes.
2. **Every free scan is a public card on `/scans`** (SPEC §2). We never scan a prospect's site for
   them. We show what AI says about their market by asking an AI by hand, and they run the scan.
3. **Who may get a sales message, and how** (trust-compliance F1 and F2 on #2693; draft wording for
   the lawyer). Germany and Austria, and UK sole traders and partnerships: no sales message by
   email, LinkedIn, WhatsApp or SMS unless the person asked first. Meet them in person, write by
   post, or answer people who reply to a public post. A LinkedIn connection request goes with no
   note, or a note with no offer. Cold messages go only to US businesses and to UK companies, LLPs
   and Scottish partnerships (checked on Companies House, `entity_type` in the tracker). Messages to
   genuine personal friends who own German businesses wait for the owner's ruling D9. A LinkedIn
   message counts as electronic mail in Germany (OLG Hamm 18 U 154/22) and, for direct messages,
   in the UK (ICO); a LinkedIn connection is not consent (AG Düsseldorf 23 C 120/25).

The pace wording is "up to 7 pages a week, new or updated" until SPEC §1 *The pace* takes the
owner's 11-10 "publish daily" ruling (#2513).

## Cold email: cleared with conditions, lawyer confirm pending

trust-compliance cleared cold email on #2693 for US businesses and UK companies, LLPs and Scottish
partnerships, with conditions. **It stays unused until the owner rules D9, D10 and D11 below.**
Before any cold send, all of these hold:

| # | Condition | Where |
|---|---|---|
| C1 | The footer (sender, postal address, "this is a sales email", the source of the address, the opt-out, the privacy link) is in every cold mail | `scripts.md` §2 (F3) |
| C2 | A UK recipient is checked on Companies House first; only `entity_type` = `company` (Ltd, PLC, LLP or Scottish partnership) gets a cold mail | private tracker (F2) |
| C3 | An opt-out is honoured at once, written in `opted_out_on`, and the address goes on a do-not-contact list the owner keeps privately, which outlives a deleted lead row | private tracker (F3) |
| C4 | Sent by hand from the owner's own existing mailbox under his real name. Never through Resend (its use policy bans cold outreach) and never "From" an @reachkit.app address sent from another mailbox (DMARC is `p=quarantine`) | owner (F8, D10) |
| C5 | The privacy page has the section "People we write to" that the footer links to. Not live today (`curl -s https://reachkit.app/privacy \| grep -c "People we write to"` returned 0 on 2026-11-15); the change is a product issue for product-manager (trust-compliance report §6) | `legal.privacy.body` (F4) |
| C6 | The owner's one-page balancing test (LIA), a record of processing entry for outreach, and a 12-month retention after last contact | owner |
| C7 | The lawyer has read F1–F5, F7 and F11 | owner (D11) |

## Aggregate figures across stored scans (F9)

Allowed in a post only when every condition holds; none has been posted. Before the first one, the
privacy notice carries the sentence on scan statistics (same product issue as C5) and the owner has
read DataForSEO's terms §7.1.

1. Name no site, business or person, including rivals named in AI answers.
2. Every figure covers at least 20 sites, and no slice (town, category) goes below 20.
3. State the population: "Of {N} sites scanned with ReachKit between {d1} and {d2}".
4. Exclude the owner's, test and fixture scans and removed domains.
5. Keep the query, the date and N with the post (in this folder, next to the post).
6. Never call the sample "businesses" in general.

## Readiness gates (from the growth plan, 2026-11-11)

| # | Gate | Status |
|---|---|---|
| G1 | A stranger walk on a customer's domain, subdomain connects only (D8). WordPress-run sites are not walked, pitched or set up in wave 1 | open |
| G2 | 7 of 7 pages a day for 7 days in a row (#2498) | open |
| G3 | Legal sign-offs: #1614 and the DPA lawyer review | open |
| G4 | Daily spend ceiling ruled for outreach and launch days (about 80 full-cost scans a day today) | closed 11-15 by D5: ceiling unchanged, outreach staggered |
| G5 | Pace wording in SPEC §1 matches the 11-10 ruling | open |
| G6 | Cold email conditions C1–C7 met (section above) | open: cleared with conditions, lawyer confirm pending |
| G7 | Before wave 3 (DE): a 0¢ panel replay of baeckerei-hinkel shows a ready first topic before the 48 h promise (D2) is made to a German local business (customer-success change 9, #2693) | open |

Warm outreach to people the owner knows may start before G3, inside rule 3; strangers are not asked
to pay until G1–G3 are closed, and no cold mail goes out until G6 is closed.

## Open owner decisions

| # | Decision | Recommended | Status |
|---|---|---|---|
| D1 | Founding price lock: €49 a month for as long as they stay | Yes | **ruled 11-15: yes** |
| D2 | Guarantee: service ("live in 48 h or I do it with you") plus anti-guarantee ("the free report is the proof") | Yes | **ruled 11-15: yes, one to one only** |
| D3 | Credit guarantee: no page live in 7 days → second month free (Stripe coupon by hand) | Hold | **ruled 11-15: hold until G1 and G2 prove 48 h delivery** |
| D4 | Founding waves: 15 places closing 6 Dec, 15 closing 20 Dec, 20 closing 31 Jan | Yes | **ruled 11-15: yes** |
| D5 | Raise the daily scan ceiling on outreach days (G4) | Size with commercialization | **ruled 11-15: keep 1,000¢; launch in small steps, no day planned past ~80 scans; Product Hunt waits** |
| D6 | Partner (web designer) terms: setup help only, or a credit | Setup help only until commercialization rules | **ruled 11-15: no partner or affiliate channel in the first 50; deferred to Phase 2 or later. Simple direct sales and first revenue** |
| D7 | A "how did you hear about us" field or a fourth analytics event | Ask by hand for the first 50 | **ruled 11-15: tagged links per channel (`?ref=`), table below; storing the ref is a separate engineering issue** |
| D8 | WordPress sites in wave 1 | Skip | **ruled 11-15: skipped for wave 1. G1 tests subdomain connects only; WordPress-run sites are not pitched or set up in wave 1, and score 0 on "can set it up" for wave 1** |
| D9 | Accept the residual risk of one-to-one messages to genuine personal friends who own German businesses (trust-compliance F1, rated low) | Your call; until then, friends in Germany hear about it in person or when they ask | open |
| D10 | Which mailbox sends cold mail (F8). A new mailbox or sending domain costs money | A mailbox you already have, under your own name, by hand | open |
| D11 | A lawyer reads F1–F5, F7 and F11 before any cold send; the lawyer's cost is yours | Yes, before G6 | open |

## Channel links (D7)

Every link we hand out carries its channel. Use exactly these tags, lower case.

| Channel | Link |
|---|---|
| LinkedIn (messages and posts) | `https://reachkit.app/?ref=linkedin` |
| X | `https://reachkit.app/?ref=x` |
| WhatsApp and SMS | `https://reachkit.app/?ref=whatsapp` |
| Email, warm (people the owner knows) | `https://reachkit.app/?ref=email` |
| Email, cold (US businesses and UK companies only, after G6) | `https://reachkit.app/?ref=coldemail` |
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

| Date | Contacts | Replies | Scans run | Calls | Paying | Live in 48 h |
|---|---|---|---|---|---|---|
| 2026-11-15 | 0 | 0 | 0 | 0 | 0 | — |

## Change log

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
