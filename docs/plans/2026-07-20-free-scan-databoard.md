# Free Scan → Data Board: comprehensive plan

> **Status:** Comprehensive plan, approved in principle by Tim (2026-07-20 — wireframe + UI approved; the three design calls resolved below). Wireframe: https://claude.ai/code/artifact/47e3c03c-b3f8-49c3-a1bc-58279eb49ba0
> **Objective (Tim):** the free scan becomes a **data board** — six sections, almost no prose, every element a number with a real source. Category/niche defined from **data, not LLM guesswork**; category is **large by nature**; directories/aggregators handled as a **built-in dimension, not an edge case**.
> **Method:** corpus-first (write the expectation, watch it fail, implement), one shared classifier (RC1), grounded-in-real-data throughout, live-verified per archetype. No new external calls — everything rides the existing one `ranked_keywords` + one `search_volume` batch.

---

## 1. Design decisions (resolved with Tim)

**D1 — Category vs Niche: LLM labels, data everything else.** The LLM proposes only two *labels* + candidate head phrases (e.g. reachkit → category "SEO tooling", niche "SEO competitor tracking"). Membership, sizing, rank/gap, and the broad/niche split all come from `ranked_keywords` + DataForSEO volumes. Any label phrase that isn't grounded is dropped.

**D2 — Category must be LARGE (the umbrella), never fabricated.** A small category number is a *symptom of a too-narrow definition*, not an honest result. Category = the broad industry umbrella; its size is real DataForSEO head-term volume. If a grounded category comes out below the floor, **ladder up** (drop the most specific qualifier token, re-price the broader term) until it clears the floor or is exhausted. Niche may be small. Enforced by a machine-checked floor on real-industry fixtures.

**D3 — Aggregation is a first-class footprint dimension.** Every site's footprint splits into **brand / category / niche / aggregated-entity / noise**. `aggregated-entity` = third-party company/product/person names the site ranks for (directory listings). A normal SaaS ≈ 0%; a directory ≈ 90%. This replaces the binary "is it a directory?" edge case and structurally fixes the "89% other companies' names — not buyers looking for you" mis-framing (it becomes "your directory/aggregation engine").

---

## 2. The data model (the hard half)

All inputs already exist per free scan (no new cost): real `ranked_keywords` (position, volume, URL), the lite-synth LLM labels, one `search_volume` batch (request-billed — extra phrases are free).

### 2.1 Footprint classification (extend the ONE shared `classifyFootprint`)
Each ranked keyword → exactly one dimension:
- **BRAND** — subject's own name/variants (`brandTokensFor` + Part-C-recovered listing name).
- **AGGREGATED** — a distinct third-party entity name. Signals (any 2 → aggregated): (a) matches an entity/mega-brand shape via the shared detector and is NOT the subject's brand; (b) lands on a **per-entity URL path** — detect a repeated path template across many rankings (`/startup/<x>`, `/software/<x>`, `/p/<x>`, `/company/<x>`, `/founder/<x>`); (c) a single distinctive token not in the subject's category vocab. The URL-template signal is the strong directory tell and is new.
- **CATEGORY** — terms in the subject's broad industry (see 2.2).
- **NICHE** — terms in the subject's specific sub-space (⊂ category).
- **NOISE** — genuinely unrelated (rare after the above; e.g. accidental homonyms).

`aggregatedPct` joins `brandPct`/`categoryPct` as a rendered dimension. Guard: the classification corpus gains an `aggregated` expectation per fixture (trustmrr high, savvycal/reachkit ~0). This is the directory-as-first-class fix, corpus-locked.

### 2.2 Category (broad) — laddered to "large"
1. LLM proposes `category` label + 3–6 candidate head phrases; niche label + 3–6 candidates.
2. Price all candidates in the one `search_volume` batch.
3. **Ground + contain:** keep a category phrase only if it's real-volume AND the niche is a child of it (shares a stemmed non-generic token with niche terms / real rankings) — internal consistency prevents the "business intelligence platforms for an MRR tool" class.
4. **Ladder to large:** `categoryDemand = Σ` grounded category head volumes. If `< CATEGORY_FLOOR`, drop the most specific qualifier token from the head term and re-price the broader form (`"seo analytics tools"→"seo tools"→"seo"`); accept the broadest grounded term whose volume clears the floor. (Laddering candidates are priced in the SAME batch — enumerate a couple of broader forms up front so no second call is needed.)
5. Category card size = that large, grounded number.

### 2.3 Niche (specific)
The subject's specific space: grounded category terms that are NOT the broad head (the long-tail / audience-qualified subset) + the real category rankings. Size can be small. Niche ⊆ category by construction (step 2.2.3).

### 2.4 Per-card rank / gap / opportunity (pure data)
- "You rank top 3 for" = card keywords where the subject's real position ≤ 3.
- "You don't rank for" = card keywords with position > 3 or unranked, by volume.
- Opportunity section = the **niche** gap terms by volume (growth potential). 100% real positions + DataForSEO volumes, zero LLM.

### 2.5 Invariant #1 safety
`sv.score` = classified-row category strength, computed as today. The category/niche *presentation* fields (labels, laddered demand, card splits) do **not** feed the score. Adding the AGGREGATED dimension DOES move the category/brand/off-topic percentages, which feed `sv.score` — so this is a deliberate, honest score change (a directory's score should reflect that ~90% of traffic is aggregation, not its category). v5 **free==paid parity** must stay green (the classifier runs identically both tiers); the absolute score legitimately shifts for directories — same nature as the fox-news correction. Documented as a Change-Protocol score-model update.

---

## 3. Render spec — the six sections (from the approved wireframe)

Rebuild the search-visibility region of `components/report/captured/results-screen.tsx` + the `to-results-props.ts` mapping. Data-driven, minimal prose, tokens only, intrinsic-grid responsive.

1. **Overview** — donut (unified score, unchanged) + two driver bars (on-page, search presence — unchanged) + one hero stat: **category size** ("N searches/mo in your market — you're in a real category"). Hero number = the large grounded categoryDemand (D2).
2. **Your Category (broad)** — pill + label + size + "rank top 3" chips (green #N) + "don't rank" chips. Zero-state when no top-3 (a real hook, e.g. savvycal ranks for 0 scheduling terms).
3. **Your Niche (specific)** — identical card, tighter scope + label.
4. **Opportunity** — niche gap rows (phrase · volume · not-ranking), by volume.
5. **Top Fixes** — 2 computed fixes (opportunity-linked + weakest HTML signal, real score-model delta) + 2 blurred locked + "🔒 N more".
6. **Upgrade** — static (daily fix calendar · weekly tracking · distribution).
Plus the **aggregation strip** (D3) when `aggregatedPct` is material: "N% of your traffic is the names of companies you list — your directory engine" (reframe, not scold).

Corpus-first: every rendered number added to the report-corpus rubric (teaser-count/source-parity family) with trustmrr, savvycal, reachkit, x.com, spacex, getapp fixtures. Mobile gate (390/360) is CI-blocking — the two-card row uses `repeat(auto-fit, minmax(min(100%,240px),1fr))`.

---

## 4. Phased implementation (corpus-first, one PR per phase, live-verified between)

- **P1 — Aggregation dimension (data).** Add AGGREGATED to `classifyFootprint` (URL-template + entity-shape signals); split off-topic → aggregated + noise; add `aggregatedPct`. Corpus: trustmrr/getapp high aggregated, savvycal/reachkit ~0. Live-verify the split on all archetypes. (Score moves for directories — v5 parity green.)
- **P2 — Category laddering + niche split (data).** LLM emits category+niche labels & candidates; grounding + contain + ladder-to-floor; produce the two grounded keyword sets + sizes. Corpus: category-floor assertion on reachkit/savvycal/x.com (must be large); niche ⊆ category; trustmrr category laddered to a large grounded umbrella. No new call (all priced in the one batch).
- **P3 — The six-section render + aggregation strip (UI).** Rebuild the section per §3; DS mirror reconciled; report-corpus rubric extended; mobile gate. Live headless-render all archetypes.
- **P4 — Top Fixes 2+2 + upgrade polish.** Wire the 2-shown/2-locked fixes to the opportunity + signal deltas.
Each phase: corpus expectation first → implement → mutation-prove → full gates → live-verify the relevant archetypes on prod before the next.

## 5. Verification (the standing bar)
Fresh prod scans + headless render of **reachkit.app · savvycal.com · trustmrr.com · x.com · spacex.com · getapp.com** after each phase. Acceptance: category is large & grounded (never fabricated); niche is specific; aggregation reframed for directories; every number reconciles to a real source; ≤ ~20¢, 20–30s; mobile clean; v5 parity green.

## 6. Risks / open items
- **Category laddering could over-broaden** (e.g. ladder "scheduling" → "software"). Guard: stop at the first grounded term above the floor; never ladder past a term that still shares a niche token. Corpus-pin each archetype's expected category altitude.
- **LLM label quality** — the one remaining LLM dependency. Mitigation: labels are cosmetic; all numbers are data; a bad label can't fabricate a market (grounding + contain drop it).
- **CATEGORY_FLOOR value** — needs calibration against the corpus (start ~10k/mo, tune so real industries pass and genuine micro-niches aren't forced to lie). Pinned as a documented constant.
- **Aggregation false-positives** on a normal SaaS with a few partner mentions — require ≥2 signals + a material share before surfacing the strip.
