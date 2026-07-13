# WS2 — Customers page redesign (analytical, evidence-linked, drill-down)

**Date:** 2026-07-13 · **Status:** design approved (browser mockups), pre-plan · **Workstream:** 2 of 6

## Context

The paid Customers page (`app/(app)/app/audience/customers/page.tsx` → `components/app/intel/customers-view.tsx`) re-presents the `demand` intel layer (ICP/JTBD, demand themes, community pockets, buyer insights). User feedback (2026-07-12/13): the current page is too sparse and prose-heavy; "where they hang out" is only ~3 threads and should be a real, longer, interactive analysis; "top buyer pains" needs a richer component than a flat quote list; and — **most critically** — *every data point must be clickable, referenced, and drill-down-able for details.*

The redesign was chosen via interactive mockups: **Composition 2 top** (Who-your-buyer + Demand-themes side by side) + **Composition 3 "Where they hang out"** given full width (an **intent × recency map** as the summary over the **complete grouped feed**), then **frequency bars** for pains. Selected components: **A1** (grouped feed + filters), **A2** (intent×recency map), **B1** (pain frequency bars).

## Goals

1. Rebuild the page to the approved layout — denser, analytical, scannable.
2. **Keywords under each demand theme** (data already stored).
3. **"Where they hang out"** = an intent×recency **map** + the **complete filterable feed** of buyer threads (all threads, not 3), with **dates + recency** and **real engagement counts where available**.
4. **"Top buyer pains"** = **frequency bars** ranked by review mentions, each expandable to quote + source.
5. **Universal drill-down + evidence** (the "most critical" requirement): every keyword, theme, thread, and pain is a clickable, sourced entry that opens a **detail drawer** with its evidence and context.

## Decisions (forks resolved by Tim, 2026-07-13)

- **Fork A — thread activity: INCLUDE, honestly.** Fetch **real** engagement (score / comment count) from the surfaces' own **free public APIs** — Reddit (`<permalink>.json`) and Hacker News (Algolia API) — for threads on those surfaces. Surfaces with no public API show **no count** (never a fabricated one). This adds no vendor spend.
- **Fork B — per-pain provenance: DO THE REWORK.** The review extractor must keep, per pain, the specific source URL (and ideally the verbatim quote) it came from — so each pain deep-links to where it was said, not just a host. This is subsumed by the universal-evidence requirement.

## Data reality (honesty constraints — "degrade, never invent")

Verified against `lib/scan/demand/*`:
- **Keywords per theme:** `DemandTheme.sampleKeywords` (≤6) + `searchDemand.topKeywords` (≤25 `KeywordIdea{keyword,volume,intent}`) are already stored — a render change only.
- **Thread dates + recency:** `DemandPocket.topThreads[].publishedAt` exists; `pockets.ts recencyWeight` already ranks by recency. Present.
- **Thread engagement counts:** NOT currently stored — added via the public APIs above, null when unavailable.
- **Per-pain source:** currently LOST — `mineCompetitorReviews` flattens all review text and the LLM returns bare `pains: string[]` with only a page-level `sources: string[]`. The `reviewResults` upstream DO carry `{url,title,content}` per result, so provenance is recoverable by changing the distill to cite the source per item.

## Design

### Layout (rebuild of `CustomersBody`)

One full-width content column:
1. **Row 1 — two columns:** `Who your buyer is` (compact `ICP → primary job` line + use-case chips; drop the prose sentence) | `Demand themes` (each theme = name + volume + intent badge, with **its keywords as chips beneath**).
2. **Row 2 — Where they hang out (full width):** an **intent × recency map** (dot = thread, x = recency, y = LLM intent, colour = surface, ringed = high-intent) as the at-a-glance summary; beneath it the **complete grouped feed** — every buyer thread, each row = surface chip + title (links to thread) + intent badge + date + **engagement count when available** — with **filter chips** (All / 🔥 high-intent / last-30-days) and a live count.
3. **Row 3 — Top buyer pains (full width):** **frequency bars** ranked by review-mention count; each bar row expands to the verbatim quote + a deep-link to its specific source.

### Universal drill-down + evidence (the load-bearing requirement)

Every data point is clickable and opens a **detail drawer** (a right-side panel / dialog) showing the evidence + context behind it. No dead text.
- **Keyword** → volume, intent, the theme it belongs to, a SERP link.
- **Theme** → its full keyword list (volumes + intent), total volume, the threads tied to that theme.
- **Thread** → title, surface, date, intent, engagement (if any), and a direct link to the thread.
- **Pain** → the verbatim quote(s), mention count, and a deep-link to the specific review/thread it was extracted from.
- **Persona / buyer-language / loved-feature** → their source(s).
The drawer is one reusable component driven by a small tagged union of "evidence subjects" so every entry opens the same surface. Where a real deep-link exists it is shown; where only a page-level source exists, that is shown (labelled honestly) — never a fabricated citation.

## Data-model changes (server)

- `DemandPocket.topThreads[]` gains `activity?: { score: number; comments: number } | null` (real counts from Reddit/HN APIs; null when unavailable).
- `BuyerInsights` changes `pains: string[]` → `pains: PainInsight[]` where `PainInsight = { text: string; quote?: string; sourceUrl?: string; mentions?: number }`. `lovedFeatures/personas/buyerLanguage` MAY gain the same `{text, sourceUrl?}` shape (at minimum `pains`, which the UI ranks). Keep `sources: string[]` (page-level fallback). **All consumers null-coalesce** — older `demand_intel` rows and `report_payload` blobs carry the old flat `string[]`; a normaliser accepts both shapes on read.
- New pure helper to normalise legacy `string[]` pains ↔ new `PainInsight[]` so the UI and the emptiness predicates (`buyerInsightsEmpty`, `fallbackBuyerInsights`) work on both.

## New/changed modules (indicative — plan finalises)

- **New adapter** `lib/scan/adapters/thread-activity.ts` — `fetchThreadActivity(url): Promise<{score,comments}|null>`: Reddit `<permalink>.json` + HN Algolia; per-host dispatch; `fetchWithTimeout` + a proper `User-Agent`; returns null on any failure/unsupported host (never throws).
- **New enrichment step** in `gatherDemand` (or `discoverDemand`) — after clustering, fetch activity for the shown `topThreads` (bounded concurrency, de-duped by URL) and attach `activity`. Cached with the 7-day `demand_intel` payload, so it's fetched once per gather (no per-load cost). Free (no vendor spend) but log a bounded budget of requests.
- **`mineCompetitorReviews` rework** (`reviews.ts`) — feed the LLM per-URL-labelled review excerpts and require it to return each pain with the `sourceUrl` it came from (and a short verbatim `quote`); assemble `PainInsight[]`. Keep the `isEmpty` poison guard.
- **Client types** (`components/app/intel/demand-view.tsx` `Demand`/`Theme`/`Pocket`, consumed by `customers-view.tsx`) — mirror the new `activity` + `PainInsight` fields (optional).
- **New components**: `IntentRecencyMap` (canvas/SVG dot plot), `BuyerThreadFeed` (grouped + filter chips), `PainBars`, and one reusable `EvidenceDrawer`. Compose from `@/components/app/intel/kit` + `@/components/ui/dialog` where possible; add atomic pieces only when no composition works (and mirror them per the coverage ratchet).
- `customers-view.tsx` — rebuild `CustomersBody` around the three rows + wire every entry to the `EvidenceDrawer`.
- Claude Design: mirror changed/added live components into `.design-sync/ds-src/` + `INVENTORY.md`; `pnpm check:design` 0-STALE + re-bless (Change Protocol).

## Cost & invariants

- The demand gather already runs under `costedIntelStep` (invariant #2) via `/api/app/intel?layer=demand`; the activity fetches are free (Reddit/HN public APIs, no vendor cost) but MUST stay inside the gather (cached) and be bounded (top-N threads, timeout, concurrency cap) — no unbounded fan-out.
- Don't-cache-empties (invariant #3): the review rework must preserve the `isEmpty`/`buyerInsightsEmpty` poison guards on the new shape.
- Brand-ambiguity (invariant #6): buyer insights stay from the category-validated cohort's reviews + the product's own community threads.
- Bundle: the customers page is pinned in `KNOWN_OVERAGES_KB` (280 KB) — the new map/feed/drawer must not grow it past the pin (canvas over a chart lib; `dynamic()` the drawer if needed). No new baseline entry.
- Tokens only (`--c-*`); additive/null-coalesced fields; live-test with `REACHKIT_USE_FIXTURES=false` by RENDERING the page.

## Testing / verification

- Unit (pure): the legacy↔new `PainInsight` normaliser (accepts `string[]` and `PainInsight[]`); the activity host-dispatch + null-degrade; the theme→keyword render mapping; the emptiness predicates on the new shape.
- Adapter: `fetchThreadActivity` returns null for unsupported hosts / non-200 / malformed JSON and never throws (mock fetch).
- Live (fixtures=false): scan nudgi.ai (or a rival with reviews), open `/app/audience/customers`, confirm: keywords under themes; the map + full feed with real Reddit counts where present and *no* count elsewhere; pains as ranked bars each opening a quote + specific source; every keyword/theme/thread/pain opens the drawer with real evidence; `/app/diagnostics` shows no new vendor spend from activity (free) and the demand gather still attributed + capped.

## Success criteria

The page reads as an analytical buyer-intel surface: keywords visible under themes; "where they hang out" is the full thread set with an intent×recency map and real engagement where available; pains are ranked bars with expandable evidence; and **every data point is clickable and opens its real source/detail** — nothing shown without a way to drill into where it came from. All gates green; cost attributed + capped; honest degradation everywhere a source is missing.

## Out of scope

- A Reddit/HN write integration or auth'd API (public read-only only).
- Real engagement for surfaces without a public API (Quora, arbitrary blogs) — omitted, not faked.
- Changing the demand *gather* pipeline's discovery/clustering logic beyond the activity + provenance additions.
