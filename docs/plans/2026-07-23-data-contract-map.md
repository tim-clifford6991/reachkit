# Per-field data-contract map (agent-verified, 2026-07-23)

> The cohesion artifact for the final system: every field of Pipeline A (`report_payload`) and Pipeline B (intel layers) — writer → mounted reader → verdict. Closes the per-FIELD "fetch 50, show 8" blind spot (REQUIREMENTS §12 contract-fit, previously UNENFORCED). Feeds: M3b scope (L2), Phase-E collapse map, and the future per-field G9 ratchet.

## Routing reality (the linchpin)

| Route | Renders | Reads |
|---|---|---|
| `/app/dashboard` | DashboardHero + WhatToRankFor + DashboardIntelBlocks | `report_payload` + `supply` intel |
| `/app/audience/competitors` | CompetitorsView | `supply` intel |
| `/app/audience/customers` | CustomersView | `demand` intel |
| `/app/plan` | PlanTimelineView | `synthesis` intel + action board |
| `/app/supply` · `/app/demand` · `/app/synthesis` | **redirects** to the above | — |
| `/scan/[id]` | ResultsScreen (free-redacted) | `report_payload` |

**`supply-view.tsx` / `demand-view.tsx` / `synthesis-view.tsx` are NOT mounted by any route** — only their types/helpers are imported. Dead render surfaces since the M1/M3a reshape.

## ✅ AS-BUILT (2026-07-24): orphan-gating landed — the metered orphans below are CUT

The surgical L2 move (Option a) shipped. On the mounted intel endpoints (`route.ts` + `stream/route.ts`):
- **`gatherKeywordGap` removed from the `supply` Promise.all** → returns `keywords: null`. Saved **6× metered `ranked_keywords`** per cold supply load (dashboard + competitors). Synthesis still re-gathers keyword-gap internally for the rendered plan, so nothing that ships loses data.
- **`synthSummary` removed** from `gatherSynthesis` → `summary: ""`. Saved **1 dedicated Haiku call** per cold synthesis load; its text rendered on no mounted view.
- **`FunnelResult.keyActions` removed** (`synthesizeKeyActions`) — dead everywhere (not in the `Supply` type, zero readers). Saved **1 Haiku call** per cold funnel gather (every supply load).
- **Dead `SupplyView` component deleted** (`supply-view.tsx` is now types-only); **`competitive-framing.ts` + test deleted** (zero prod refs).

**Verified safe:** tsc/unit(1976)/eval(v5-parity)/int(115)/arch/design all green; the per-page `cluster` label (rendered by competitors-view) was confirmed to come from the SAME `clusterPageTopics` Haiku call, so clusters was NOT cut.

**Still deferred to Phase E (documented reasons):** `demand.buyerInsights` + `demand.searchDemand` (orphaned on the demand *surface* but re-consumed server-side by `gatherSynthesis` for the plan — dropping needs the O-7 reviews cut / a forked cache key, which the simplicity rule forbids as a special-case); the dead `DemandView`/`SynthesisView` components (same-named-type ambiguity with `lib/scan/demand/*` — a type-home consolidation, not a delete); and the `buildExecutiveSummary`/`ExecutiveSummary` cluster in core `report.ts` (provably dead + zero-cost — never called, no spend, no render — so deleting it is tidiness, deferred to keep this cost-fix diff low-risk).

## ⚠ ORIGINAL HEADLINE (pre-2026-07-24): new orphans CREATED by M1/M3a (metered cost, zero mounted render)

The `/api/app/intel` gatherers still run unconditionally on every cold load; the reshape removed their renders:

| Gather | Cost per cold load | Was rendered by | Now rendered by |
|---|---|---|---|
| **`gatherKeywordGap`** → `supply.keywords.gaps` | **6× `cachedRankedKeywords(d,50)`** (subject+5 rivals) | dashboard KeywordGapTable (M1 cut) + competitors KeywordEdgeList (M3a cut) | **NOBODY mounted** |
| **`mineCompetitorReviews`** → `demand.buyerInsights` | Tavily extract + LLM per rival ≤5 | customers PainBars (M3a cut) | **NOBODY mounted** |
| **`cachedKeywordIdeas` + Haiku clustering** → `demand.searchDemand` | keyword_ideas + LLM | customers DemandThemes (M3a cut) | **NOBODY mounted** |
| **`synthSummary`** → `synthesis.summary` | dedicated Haiku call | synthesis-view only (unmounted) | **NOBODY mounted** |

Mitigation nuance: cached synthesis re-consumes gaps/themes/pains into the PLAN — the data isn't 100% wasted, but the **mounted intel endpoints gather-and-discard on every cold load**. Fix (M3b/L2): (a) gate these sub-gathers out of the `supply`/`demand` endpoint Promise.alls (synthesis can gather its own inputs), or (b) pull the Phase-E one-gather collapse forward for these four. Option (a) is the surgical L2 move.

## Pipeline A — `report_payload` verdicts

**RENDERED (healthy):** `whatYouOffer.positioningMirror` · `whatToDoThisWeek` (fetch-all → show 3+2 locked, by design) · `score` · `marketPosition` (paid) · `searchVisibility` core (score/drivers/footprint/split/wins/cards/leader/phrases/opportunities/marketTiers-legacy) · `market.gap.keywordGap` (4 rows paid) · CSV export reads cohort/pockets/plan.

**ORPHAN (written, never rendered — M3b cut list):**
- `competitiveLandscape` · `creatorsToReach` · `channelOpportunities` · `strengthsAndWeaknesses` — costed paid sections whose ONLY consumers are redaction + diagnostics. (Known; M3b.)
- `whoItsFor.summary` (built, zero readers) · `whereTheyAre.surfaces` (free always `[]`; diagnostics-only) · `competitorGap` sub-fields beyond `.competitor` names (them/you/dimension/positioning feed prompts + dead `competitive-framing.ts`).
- **`buildExecutiveSummary` / `ExecutiveSummary`** — exported, ZERO callers. Dead code.
- `market.recentBuzz` · `market.gap.channelGaps` (redaction-only).

**Per-field over-persist (cheap, same paid call — future ratchet, not launch):** `categoryRanked` 15→show ≤3 · `categoryGap` 6→show 0 rows (superseded) · `aggregatedExamples` explicit no-consumer · `categoryWonKeywords` internal-only · `categoryOpportunities` 6→show 4 free.

## Pipeline B — surviving vs orphaned (per mounted views)

**RENDERED:** funnel.subject (+lens.sources) · competitors[].backlinks.topQualityReferrers · channelsMissing · channelStrength · content.entities[].pages · demand.category/icp/community.pockets · synthesis.contentPlan/distributionPlan.

**ORPHAN (only the unmounted views read them):** funnel.category · competitors[].{closeness,reason} · backlinks.{byCategory,qualityShare,sampled} · discoveryChannels · lens.activities · content.entities[].contentTypeMix · content.clusters (LLM taxonomy!) · community.painQueries (internal).

## Phase-E collapse map (concept → ONE home)

| Pipeline-B concept | Pipeline-A home | Action |
|---|---|---|
| funnel/cohort | `market.cohort` + `marketPosition` + `competitorGap` | MERGE — same rivals profiled twice |
| keywords.gaps | `market.gap.keywordGap` (+ sv.categoryGap subject-side) | COLLAPSE to ONE (same `cachedRankedKeywords`) |
| content entities/clusters | NONE (nearest: orphaned `channelOpportunities.keywordClusters`) | promote or DELETE clusters branch |
| searchDemand | `sv.categoryDemand/phrases/opportunities` (+ `market.demand`) | COLLAPSE — sv is the rendered home |
| community pockets | `market.demand.pockets` | MERGE — **`discoverDemand` literally runs in BOTH pipelines** (two cache keys) |
| buyerInsights | NONE | DELETE (with M3b reviews cut) or promote |
| synthesis plan | `market.plan.items` + `whatToDoThisWeek` | MERGE plan generation |

## Top waste, ranked
1. `supply.keywords.gaps` — 6 metered calls, 0 mounted renders (M1/M3a-created).
2. `demand.buyerInsights` — Tavily+LLM, 0 mounted renders (M3a-created; dies naturally with the O-7 reviews cut).
3. `demand.searchDemand` — keyword_ideas+Haiku, 0 mounted renders (M3a-created).
4. Double `discoverDemand` (both pipelines) — Phase-E merge target #1.
5. `synthesis.summary` — dedicated Haiku call, unmounted reader only.
6–7. Pipeline-A orphan quartet (landscape/creators/channelOpps/strengths) — M3b.
8. content clusters + discoveryChannels + lens.activities — LLM work only the unmounted supply-view showed.
9. sv over-persist leaves (cheap; future per-field ratchet).
10. `whoItsFor.summary` + dead `buildExecutiveSummary` + `competitive-framing.ts` — zero-cost cruft, delete with M3b.

## Consequence for the launch plan
- **L2/M3b scope GROWS (and gets more valuable):** producers cut (as planned) **+ gate the four orphaned Pipeline-B gathers out of the mounted endpoints** (+ delete the unmounted supply/demand/synthesis views + dead helpers `buildExecutiveSummary`/`competitive-framing.ts`). This makes every cold paid tab load dramatically cheaper — recurring savings, not one-off.
- **Phase E post-launch shrinks** — the collapse map above is its exact work order; the worst per-load waste is already gone after L2.
