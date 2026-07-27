# Intake — competitor picker reuses the deep scan's sizing (no re-fetch)

**Date:** 2026-07-27
**Owner sign-off:** requested in-session (cost-bearing surface + onboarding).

## Verbatim requirement

> During onboarding the competitor picker shows a flat "Found during your scan" list with no size bands (Your size / A bit bigger / Much bigger / Biggest). The deep scan already fetched competitor sizing — was that a cost leak? Make the single onboarding experience show the size bands, and fix the duplicate spend.

## Restatement (with deltas)

The picker (`competitor-setup.tsx`) already renders size bands **when the candidates API returns `sizeTier`**. The API's scan-seeded fallback (`seedFromScan` in `app/api/competitors/candidates/route.ts`) reads the `competitors` table — which stores **names only, no traffic** — so it returns `etv:0`, no `sizeTier`, and the degraded "Found during your scan" rows.

Meanwhile the deep scan's **market pass** already fetched each cohort rival's ETV (`dataforseo_labs/.../domain_rank_overview`) and persisted it at `report_payload.market.cohort.competitors[].seo.etv`, with the subject's own ETV at `report_payload.market.cohort.self.seo.etv`. **The exact data the size bands need is already paid for and sitting unused.**

**Delta:** `seedFromScan` will load the latest deepened scan's `report_payload.market.cohort`, build a `domain → etv` map + `subjectEtv`, and for each seeded candidate whose domain matches, attach `etv` + `computeSizeTier(etv, subjectEtv)` (the existing shared function). No new external call. The picker component is unchanged — its `hasTiers` gate flips true automatically.

**Not the leak, and NOT the fix:** the sizing computed *in* the deep scan is legitimately used (Market-Position grade + market section) — it is not a leak. The prior proposal ("warm `cc:<host>` during the deep scan") is **rejected**: it would add a *third* fetch. This is a pure **reuse** change.

## Clarifying questions asked & recorded

- **Q: Use `report_payload.market` or the `distribution_profiles` cache as the ETV source?** → `report_payload.market` — it's persisted with the scan (no TTL), guaranteed present on a deepened scan, and already domain+etv shaped. `distribution_profiles` (7d TTL) is a fallback only if needed later.
- **Q: Should this also eliminate the picker's cold-path `bulk_traffic_estimation` fetch?** → Out of scope here. This change makes the *scan-seeded* path rich; the cold-path (when no scan seed exists) still runs its own discovery. Eliminating the cold-path duplicate for overlapping domains is a follow-up (it needs the cold path to consult `report_payload.market`/`distribution_profiles` first).

## Permutation matrix

Surface = the public candidates API path. Cells = tier × scan-data-state.

| Data state | Behavior after fix |
|---|---|
| Deepened scan, `report_payload.market.cohort` present, seeded domains overlap cohort | Overlapping rows get real `etv` + `sizeTier` → **size bands render**; non-overlapping seeded rows stay tier-less (unchanged) |
| Deepened scan, market present, NO overlap (seeded ≠ cohort) | Unchanged (no tiers) — honest: we only have sizing for the cohort we profiled |
| Free scan only / not yet deepened (no `report_payload.market`) | Unchanged degraded seed (no tiers) — no data to reuse, no fabrication |
| `market` present but a competitor's `seo.etv` null/0 | That row stays tier-less (never a fabricated tier) |
| Warm `cc:<host>` cache (tier 1) | Unaffected — already rich; seed path not reached |
| Cold cache + no scan seed (tier 3 cold discovery) | Unaffected — still runs discovery |
| Auth: unauth → 401; not paid → 402 | Unchanged (gate before seed) |

Excluded cells: anon/owner (route is `assertPaid`-gated, viewer-agnostic beyond that); entry-surface (single API).

## Acceptance criteria (written first)

- `seedFromScan` returns `sizeTier` + real `etv` for seeded candidates whose domain appears in `report_payload.market.cohort.competitors` with a positive `seo.etv`, using `computeSizeTier(etv, self.seo.etv)`.
- A seeded candidate NOT in the cohort (or with null etv) has NO `sizeTier` (no fabrication).
- No new DataForSEO/Tavily/LLM call is added to the candidates path (grep: seed path makes zero adapter calls).
- `subjectEtv` in the response reflects `cohort.self.seo.etv` when available.
- Guard test: unit test over a synthetic `report_payload.market` proving tier attach + the no-overlap/no-etv no-fabrication cases. Mutation-proven (drop the reuse → tiers disappear).
- Verified live: re-open trustmrr's picker → acquire/flippa = "Much bigger", empireflippers = "A bit bigger", digitalexits = "Your size".

## Class statement

Class: **the picker not reusing what the deep scan already paid for.** The same class (fetch-again-instead-of-read) is why the cold-path `bulk_traffic_estimation` duplicates the market pass's `domain_rank_overview`. This intake fixes the scan-seeded instance; the cold-path instance is the named follow-up.

## Rendered-surface ledger

The reused ETV terminates in a rendered surface (the size Badge + tier filter chips in `competitor-setup.tsx`) — satisfies "never pay for data you don't render" (this makes already-paid data finally render).
