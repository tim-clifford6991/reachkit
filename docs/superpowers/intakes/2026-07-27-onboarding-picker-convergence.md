# Intake — converge the competitor picker on ONE cohort source

**Date:** 2026-07-27
**Owner sign-off:** approved ("run the coordinated real fix").

## Verbatim requirement

> This is where I get concerned that we have interweaving processes… making the system more complex, as we run into such issues a lot and often. Run the coordinated real fix.

## The class (root cause)

Competitor discovery is forked; the onboarding picker reads **different sources by entry path**, so fixes land on the wrong branch:
- **First-app / checkout:** deep scan runs *before* the picker → `competitors` table populated → picker uses **`seedFromScan`**.
- **Add-product `/app/add`:** free scan only (deep runs *after* the pick) → table empty → picker uses the cold **`discoverClosestCompetitors`/`cc:`** path.

Two sources → two competitor lists, two sizing mechanisms, two pool behaviors. R-3.18 (sizing reuse) and R-3.19 (pool width) both patched **`seedFromScan`**, which the `/app/add` flow never reaches — so trustmrr's re-add still showed 5. **Patching a fork treats the case; removing it treats the class.**

## Decision — converge on `cc:` (the source the intel layer already uses)

The candidates route uses **one** source: `cachedClosestCompetitors` (`cc:<host>`). `seedFromScan` and its helpers (`cohortSizing`, `cohortSizingFromPayload`, `ccCacheIsWarm`, `SeededCandidate`) are retired.

**Why `cc:` and not the scan table:** `cc:` works for *both* entry paths (the free `/app/add` scan has no scan competitors), carries native traffic + size tiers + category, is closeness-ranked (better for benchmarking), and is the **same cohort the intel funnels already benchmark against** (`cohortFor`) — so "pick 5 to benchmark" finally aligns with what's benchmarked.

**Safety (from the discovery-web map):** `discoverScanCompetitors` stays load-bearing via `facts.competitors` (score, gap, free report, monitors, community/keyword seeds, cold-start). Only the `competitors` table rows where `source != 'user_selected'` become orphaned — sole functional reader was `seedFromScan`. Nothing else in the product reads them (verified: account export/delete + tests only).

**Cost:** ~neutral. `cc:<host>` is fetched anyway at select-time by `cohortFor` inside `gatherSynthesis`; converging just moves that single 14-day-cached fetch earlier (picker time), then select cache-hits. Deep-scan discovery cost is unchanged. Attribution phase shifts `select` → `candidates`; net session spend unchanged.

## Supersedes (honest churn)

- **R-3.18** (`seedFromScan` reuses `report_payload.market` for size tiers) — retired; `cc:` has native sizing. Guard `sizing-reuse.test.ts` removed.
- **R-3.19** (scan persist pool = 12) — reverted to 5. It widened `facts.competitors` (→ gap rows/monitors), an unintended scan-scope broadening; the picker's width now comes from `cc:`, not the scan table. `SCAN_COMPETITOR_POOL` removed; `rankCompetitors` default (5) restored at the scan sites.

## Pool width

`discoverClosestCompetitors` keeps its ≥3-closeness gate (the prompt excludes 1–2 "loosely related" by design — padding below 3 = noise). To give a real choice we widen the **candidate pool** feeding the ranker (more Tavily breadth) so more genuine ≥3 rivals surface, and keep the pre-checked default at top-5 so extras are unchecked. A genuinely niche product still honestly shows few.

## Permutation matrix

| Entry × state | After |
|---|---|
| First-app checkout (deep scan ran, table populated) | Picker uses `cc:` (was `seedFromScan`) — same list as `/app/add` now |
| Add-product `/app/add` (free scan, table empty) | Picker uses `cc:` (unchanged path) — now with the wider pool |
| Warm `cc:` (any path) | Instant cache read (unchanged) |
| Cold `cc:` | Live compute under `costedIntelStep(…, "candidates")` (unchanged) |
| Not paid / unauth | `assertPaid`/401 (unchanged) |
| Re-pick (`initialSelected`) | Reads the same `cc:` list; saved picks pre-checked (unchanged) |

## Acceptance criteria (first)

- Candidates route resolves via `cachedClosestCompetitors` on ALL paths; `seedFromScan` + helpers gone; grep shows no reader of `competitors` `source != 'user_selected'` except account export/delete.
- No new external call; no G9/capability-ledger test breaks (`cachedClosestCompetitors`→candidates consumer intact).
- R-3.19 reverted (scan discovery cap = 5; `SCAN_COMPETITOR_POOL` gone); R-3.18 guard removed.
- `pnpm test`/`typecheck`/`arch` green.
- Live: re-scan trustmrr via BOTH a checkout-style and `/app/add` flow → identical competitor list + sizing; picker shows >5 where the market has >5 close rivals, top-5 pre-checked.

## Out of scope (coordinated follow-ups)

- **Onboarding UX unification** (blocking overlay vs in-app `/app/add`) — the onboarding agent's *active* domain (`fdaa85a` made it blocking). Recommendation recorded; NOT implemented here to avoid racing their work.
- **Full 3-into-1**: retire the market pass's separate `discoverCompetitorsSmart` (`cohort.ts`) so the market cohort also comes from `cc:`. Bigger, changes `report_payload.market.cohort`; separate verified step.
- **Capability ledger**: register the picker cohort source so a future re-fork fails the build (the name-collision check can't catch semantic forks alone — noted).
