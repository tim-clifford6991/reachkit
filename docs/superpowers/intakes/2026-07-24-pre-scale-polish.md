# Intake — pre-scale polish ratchet (owner walkthrough, 2026-07-24)

**Verbatim framing (owner):** "This is an iteration / ratchet of the current state. We should NOT do a major change here, just improvements." Everything below is a ratchet of an existing surface — no rearchitecture. Wrap all items into ONE final iteration before scaling live.

## Owner's load-bearing rule (new requirement → R-x.x + invariant + guard)

**Never use free-scan data older than 1 week on a deepen.** If the underlying free scan is >7 days old, ignore/recompute its layer rather than reuse it. Applies to plausible.io AND all apps. A user can free-scan, come back weeks later, upgrade — and must not be served a stale free layer.

## Verified findings (checked against prod DB / live app before recording)

| # | Item | Type | Status | Evidence |
|---|---|---|---|---|
| A | **Stale free layer on deepen** — reuse the free scan's search/identity layer even when weeks old | data-contract | CONFIRMED + deeper | plausible deepen reused a 2-day-old free layer; `market.category` null (pre-market-card) |
| B | **Score MOVED on upgrade (invariant #1 breach)** — free total 10 → deep total 19, same v5 + same pillar breakdown; search presence 1→4 recomputed silently | correctness | CONFIRMED | `score_snapshots` app 1e31ed5d: 07-22 total 10 {92/95/0}, 07-24 total 19 {92/95/0} |
| C | **"+9 since last scan" is a false-improvement** — it's the B re-measurement artifact, not a real gain; "how was the last scan tracked?" = it diffs today's deep score vs the 7-22 free snapshot | honesty | CONFIRMED | `dashboard-hero.tsx:57` `history[last]-history[last-1]` |
| D | **sv calibration false-low** — plausible ranks 1,425 keywords, footprint complete, yet search presence = 4 → headline 19 ("barely discoverable" for a known SaaS) | calibration | CONFIRMED | `searchVisibility` score 4, brandPct 67, keywordsRanked 1425, fetchDegraded null |
| E | **Onboarding competitor step (2/3): only 6 candidates, all "your size"** — none bigger/much-bigger/biggest; no size spread to pick from | data-quality | reported | live app; competitors_rows=10 stored |
| F | **Onboarding progress: stage label stuck on "analyzing winning content"** while % climbs 30→50→70→100, then jumps to "dashboard assembled" | UX/streaming | reported | live app |
| G | **Post-onboarding redirect → /app/settings**; should be /app/dashboard | UX | reported | live app |
| H | **"88 you vs competitors"** — unexplained number, not tracked at the top | honesty | to-verify | `dashboard-view.tsx:91` benchmark |
| I | **Referrer attribution misleading** — dontpayfull.com shown as main directory source, but the source URL is a **privacy-policy page** (dontpayfull.com/privacy-policy → plausible.io/privacy); 600k monthly organic attributed to a privacy-policy backlink is implausible | data-honesty | to-verify | live app |
| J | **Thin referrer coverage for some rivals** (piwik.pro, ruleranalytics.com, cookieyes.com): no qualified referrers for reviews/directories/communities/medium — may be honest-empty, confirm it reads as "no data" not "zero" | honesty | to-verify | live app |
| K | **Customers "Who your buyer is" is wordy prose** ("privacy-focused website owners and developers who reject data-selling…") — consolidate into a data-driven component, not a heavy header (R-1.7/R-1.8) | UI | reported | live app |
| L | **Demand channels bundled, not differentiated by intent** | UI | reported | live app |
| M | **Click opens a right-side panel** — prefer inline expand within the table | UI | reported | live app |
| N | **Plan actions lack grounding context** — each action should reference what keywords it targets / who it duplicates / what it's doing, from the extracted data | content | reported | live app |

## Triage → execution order (ratchet, milestone-checkpointed)

**M1 — Honesty/correctness core (highest value, guardable):** A + B + C (one fix: stale-layer freshness gate + recompute-on-stale + honest delta) · D (calibration — assess, at least stop the false-low reading) · H + I (number/attribution provenance).

**M2 — Onboarding flow:** E (size spread) · F (live stage labels) · G (redirect to dashboard).

**M3 — UI data-driven polish (R-1.7/R-1.8):** K (buyer component) · L (channels by intent) · M (inline expand) · N (action grounding context).

Each milestone: verify against the live plausible.io scan, corpus-guard where it's a data contract, stop for owner validation. No major changes — improvements only.

## Acceptance
- A/B/C: a deepen of a >7-day free scan recomputes (never reuses) the free layer; the score does not spuriously move / the "since last scan" delta never reports a re-measurement as a gain. Guard: invariant + test.
- The rest: verified on the live re-scan + (where a data contract) a corpus/rubric expectation.
