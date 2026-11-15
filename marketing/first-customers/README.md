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
| `check-ins.md` | R12: day-14 and day-30 check-ins and the referral ask |
| `price-anchors.md` | R14: sourced price anchors for the stack |
| `leads.csv` | The lead tracker's columns (the owner keeps the filled copy private, never in the repo) |

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
3. **Cold email is restricted in Germany (UWG §7) and partly in the UK (PECR).** Germany is reached
   through the owner's network and LinkedIn; cold email goes only to UK and US companies.
   trust-compliance confirms before any cold send.

The pace wording is "up to 7 pages a week, new or updated" until SPEC §1 *The pace* takes the
owner's 11-10 "publish daily" ruling (#2513).

## Readiness gates (from the growth plan, 2026-11-11)

| # | Gate | Status |
|---|---|---|
| G1 | A stranger walk on a customer's domain: one subdomain connect and one WordPress. WordPress publishing is off on production (`WORDPRESS_CONNECT`), so the second walk is a WordPress-run site on a subdomain until it is on (owner to confirm; `setup-call.md`) | open |
| G2 | 7 of 7 pages a day for 7 days in a row (#2498) | open |
| G3 | Legal sign-offs: #1614 and the DPA lawyer review | open |
| G4 | Daily spend ceiling ruled for outreach and launch days (about 80 full-cost scans a day today) | closed 11-15 by D5: ceiling unchanged, outreach staggered |
| G5 | Pace wording in SPEC §1 matches the 11-10 ruling | open |

Warm outreach to people the owner knows may start before G3; strangers are not asked to pay
until G1–G3 are closed.

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

## Channel links (D7)

Every link we hand out carries its channel. Use exactly these tags, lower case.

| Channel | Link |
|---|---|
| LinkedIn (messages and posts) | `https://reachkit.app/?ref=linkedin` |
| X | `https://reachkit.app/?ref=x` |
| WhatsApp and SMS | `https://reachkit.app/?ref=whatsapp` |
| Email, warm (people the owner knows) | `https://reachkit.app/?ref=email` |
| Email, cold (UK and US only) | `https://reachkit.app/?ref=coldemail` |
| Reddit | `https://reachkit.app/?ref=reddit` |
| Indie Hackers, BetaList and founder communities | `https://reachkit.app/?ref=community` |
| Events, BNI, IHK, coworking (QR code) | `https://reachkit.app/?ref=event` |
| A customer's referral | `https://reachkit.app/?ref=referral` |

**Dependency, not built:** the landing ignores `ref` today (`LandingSearchParams` reads only
`problem` and `value`, `src/app/(public)/_landing/ScanForm.tsx:31`), and the three analytics events
(`scan_started`, `paid`, `draft_published`) carry no channel. Storing the ref with the scan or the
payment needs its own engineering issue, shaped by product-manager. Until it ships, ask every payer
where they heard of us and write it in `heard_from` in the private tracker.

## Progress

| Date | Contacts | Replies | Scans run | Calls | Paying | Live in 48 h |
|---|---|---|---|---|---|---|
| 2026-11-15 | 0 | 0 | 0 | 0 | 0 | — |

## Change log

- 2026-11-15: week-0 resources drafted (#2689): R4 `scripts.md`, R5 `offer-sheet.md`, R6
  `walkthrough-video.md`, R8 `setup-call.md`, R12 `check-ins.md`, R14 `price-anchors.md`. Owner ruled
  D6 (no partner or affiliate channel in the first 50; partner offer, R11 and web-designer steps
  deferred to Phase 2) and D7 (tagged links per channel; channel-link table added; storing the ref
  is a separate engineering issue). Found: WordPress publishing is off on production
  (`WORDPRESS_CONNECT`), so WordPress sites connect by subdomain and G1's second walk is a
  WordPress-run site on a subdomain. The stack's three price anchors were replaced by sourced ones.

- 2026-11-15: owner ruled D1–D5 (D5 keeps the ceiling, so outreach is staggered and Product Hunt waits).
- 2026-11-15: folder created from the growth plan (2026-11-11) and the Founding 50 research.
