# Intake — widen the competitor candidate pool so the picker offers a real choice

**Date:** 2026-07-27
**Owner sign-off:** approved in-session ("we'll fund it").

## Verbatim requirement

> The picker shows 5 of 5 competitors, all pre-selected — no real choice. Is that intended or fixed on a rescan?

## Restatement (with deltas)

The scan persists only the **top 5** discovered competitors — `rankCompetitors`'s default `cap ?? 5`, set equal to `MAX_SELECTED = 5`. The picker's scan-seed path shows exactly those 5 and auto-suggests all 5 (`suggested = ranked.slice(0, 5)`), so with 5 candidates every one is pre-checked → no choice. A rescan re-applies the same cap. Not a rescan issue; a cap.

The picker copy ("We ranked the closest matches. Pick up to 5") and **both** picker code paths (seed path caps at 15; cold discovery returns 15 for "a varied size spectrum") intend a ranked list *larger* than 5 to choose from. The cap-of-5 was the *selection* max mistaken for the *candidate-pool* size.

**Delta:** raise the scan-discovery persist cap to a candidate-pool size (`SCAN_COMPETITOR_POOL = 12`) at the three scan-discovery `rankCompetitors` sites (`find-competitors.ts` web + app modes, `scan-competitors.ts` re-rank). The picker then shows a ranked list of up to ~12, pre-checks the top 5, and the user swaps the rest.

## Clarifying questions asked & recorded

- **Q: Does widening the persisted pool increase deep-scan cost?** → **No.** The market pass builds its cohort via `discoverCompetitorsSmart(domain, product, { topN: 5 })` (`cohort.ts:70-72`) — an independent discovery bounded to 5 that does NOT read the `competitors` table. Widening the table adds zero external calls (the extra names were already extracted during collect discovery; `rankCompetitors` merely sliced them away).
- **Q: Does the selected cohort / cost cap change?** → **No.** Selection stays `MAX_SELECTED = 5` (picker `MAX`, `getSelectedCompetitors`), so invariant #2's "≤5 rivals" cost bound is untouched. Only the candidate pool widens.
- **Q: Will all 12 candidates carry size bands?** → **No, and that's honest.** The market pass profiles ~5 (its auto-discovered cohort), so only candidates whose domain overlaps that cohort get an ETV → a `sizeTier` (R-3.18 reuse). The rest render as ranked candidates *without* a band — never fabricated. Sizing all 12 would require profiling 12 (real cost) and is out of scope; the ask was choice, not bands.

## Permutation matrix

| Data state | Behavior after fix |
|---|---|
| Scan discovered >5 real competitors | Picker shows up to 12 ranked; top 5 pre-checked → real choice |
| Scan discovered ≤5 (genuinely thin market) | Shows what it found (honest — no padding) |
| Web mode (SERP+Tavily+LLM names) | Wider pool from `find-competitors` web + `scan-competitors` re-rank |
| App mode (ios/android, iTunes) | Wider pool from `find-competitors` app path |
| Deep-scan market pass (cohort) | Unchanged — auto-discovers top-5 independently, ignores the table |
| User pick | Unchanged — still ≤5 selected |
| Weekly refresh (`cap:20`) / loops (`cap:10`) | Unchanged — they pass explicit caps |

## Acceptance criteria (written first)

- The three scan-discovery `rankCompetitors` calls pass `cap: SCAN_COMPETITOR_POOL` (12); `rankCompetitors`'s default stays 5 for any other caller.
- No new DataForSEO/Tavily/LLM call in the scan (grep: the pool cap only slices already-gathered candidates).
- The deep scan's market cohort stays bounded to `topN=5` (unchanged) → no extra profiling cost.
- Selection stays `MAX_SELECTED=5`.
- Guard test: `rankCompetitors` with 12 real inputs + `cap: SCAN_COMPETITOR_POOL` returns 12 (was 5); default call still returns 5. Mutation-proven.
- Verified live: re-scan trustmrr (or a competitor-rich site) → the picker offers >5 ranked candidates, top 5 pre-checked, size bands on the profiled overlap.

## Class statement

Class: **a candidate-pool size hardcoded to the selection maximum.** Same family as the sizing seed being thinner than the picker expects — the scan-seed path under-serves a picker built for more. Fix widens the pool at the source (the scan), not per-surface.

## Rendered-surface ledger

The extra persisted names terminate in the picker's ranked list (rendered rows). No write-only data. Sizing (R-3.18) still only renders for the profiled subset — no new fetch.
