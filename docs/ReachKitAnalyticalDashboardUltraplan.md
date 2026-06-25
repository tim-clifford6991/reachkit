# ReachKit — Analytical Dashboard Ultraplan (v2, refined)

**Objective:** Move ReachKit from a prose-led, four-question report into an **analytical, chart-led dashboard** where the Discoverability Score is the brand asset and numbers/charts dominate over "word descriptions" — borrowing the Ahrefs/Semrush *scannability, score-as-brand, progressive-disclosure* grammar while rejecting agency-scale density.

**Decisions locked (this revision):**
1. **Signal model → expand to a real 18-signal engine** (not rebrand to 6). The 18 become an explicit, persisted registry.
2. **Charts → adopt Recharts** (lazy-loaded), standardised across the dashboard.
3. **Mode → refine the plan first** (no implementation yet). This doc is the deliverable.

Synthesized from four parallel assessments (current-state audit, UX design, architecture masterplan, extraction-layer audit). **Plan, not yet built.**

---

## 0. The pivotal reality (read first)

The live-code audit overturns assumptions in the requirement docs — and, crucially, shows **18 real signals are within reach** because the data mostly already exists:

| Assumption | Reality in code | Consequence |
|---|---|---|
| Score = 18 signals | Score = deterministic 3-pillar blend of **6 proxy components** (`score-full.ts`); "18 signals" is **marketing copy** | Build the real 18 (decision locked). Mostly *exposing data we already have*, not inventing 18 measurements. |
| Score may be LLM-generated | **Already deterministic** (`verifiedScore()` is pure math; LLM = narrative only) | §6.4 determinism already satisfied — **no scoring refactor risk**. |
| Rich SEO signals must be built | `SeoPosture` (organicKeywords, etv, authority, referringDomains, topPages, rankedKeywords), `Cadence`, `CommunityPresence`, `MarketplacePresence`, `ShareOfVoice`, `keywordGap` **all already compute on paid scans** — but the **score never reads them** (it uses review-theme + outcome-count proxies) | Most signals are **"wire existing data into the score,"** not new extractors. |
| HTML is richly parsed | The 200KB subject HTML is **stored** (`raw_documents.site_fetch`) but only **3 fields parsed** (title, meta-desc/og fallback, one H1) | A richer parser unlocks ~8 SEO/content hygiene signals **with zero new API cost**. |
| Per-signal contribution persisted | **Not persisted** (only `score_total` + 3-int `score_breakdown`) | `scan_signals` table is the **#1 precondition**. |
| `score_version` exists | **Missing** | Re-pointing proxies → real data **will move scores**; `score_version` + history annotation are mandatory (§trust risk). |

**Reuse (don't rebuild):** deterministic score, two-stage extraction, `evidence_ids`, `score_snapshots` history, delta computation, verify→outcome→snapshot loop, all layer-3 profile/gap engines, the custom-SVG chart kit, TanStack Table, Base UI Popover.

---

## 1. The 18-Signal Registry (the core new design)

The score becomes a config registry (`lib/scan/signals.ts`) of 18 named signals across the three pillars. Each signal: `key · pillar · label · what it measures · extractor · scoring_fn → 0–1 · weight · why · how_to_fix · platforms`. **Source tags:** `PARSE` = cheap, parse the already-stored HTML (no new API) · `WIRE` = compute already exists in layer-3, just connect to scoring · `EXISTS` = already a score input today · `NEW` = genuinely new integration (expensive/later).

### SEO pillar (weight 0.45) — 8 signals
| key | measures | source | platform |
|---|---|---|---|
| `title_tag` | title present + length 30–60 chars | EXISTS→PARSE (length) | both |
| `meta_description` | present + length 120–160 | EXISTS→PARSE | both |
| `schema_jsonld` | JSON-LD / schema.org types present | **PARSE** | web |
| `canonical_url` | `link[rel=canonical]` present | **PARSE** | web |
| `heading_structure` | exactly one H1 + H2/H3 hierarchy | **PARSE** | web |
| `organic_keywords` | real organic footprint (`SeoPosture.organicKeywords`/etv) — **replaces the review-theme proxy** | **WIRE** (paid) | web |
| `keyword_rankings` | real ranked positions (`rankLookup`/`rankedKeywords`) | **WIRE** (paid) | web |
| `referring_domains` | backlink authority (`SeoPosture.authority`/referringDomains) | **NEW** (Backlinks sub, off by default) → flagged "not measured" until enabled | web |

### Content pillar (weight 0.30) — 5 signals
| key | measures | source | platform |
|---|---|---|---|
| `content_depth` | substantive on-page copy (word count via existing `htmlToText`) | **PARSE** | web |
| `content_cadence` | publishing freshness (`Cadence.active`/postsPerMonth) | **WIRE** | web |
| `owned_channels` | breadth of content channels (`ContentChannel` kinds) | **WIRE** | web |
| `social_share_tags` | OG + Twitter-card completeness (shareability) | **PARSE** | web |
| `media_richness` | image count + `alt` coverage (app: screenshot count) | **PARSE** (web) / **NEW** (app) | both |

### Outreach pillar (weight 0.25) — 5 signals
| key | measures | source | platform |
|---|---|---|---|
| `marketplace_presence` | directory/marketplace listings (`MarketplacePresence`) — **replaces the `directoriesLive` outcome proxy** | **WIRE** | web |
| `community_presence` | HN/Reddit mentions + recency (`CommunityPresence.active`) | **WIRE** | web |
| `share_of_voice` | community mention share vs rivals (`ShareOfVoice`) | **WIRE** (paid) | web |
| `comparison_pages` | "alternatives/vs" pages live | EXISTS (upgrade) | both |
| `press_mentions` | recent news mentions (Tavily `topic:news` — plumbing exists, not wired) | **NEW-ish** (wire Tavily news) | both |

**App-platform note (§6.5):** the deep profile/gap engine is **domain-only**, so on App Store/Play the SEO/Outreach `WIRE` signals don't apply. App mode uses an **adaptive subset** (title/desc/media + ASO-specific signals that are genuinely **NEW** extractors: keyword field, screenshot count, IAP/localization). The registry stores per-platform `weight` so each subset still normalises to 0–100 and bands stay comparable. **App parity is a later wave** — web carries the rich signal set first.

### Build waves (front-load the cheap wins)
- **Wave A — HTML hygiene (8 signals, zero new API):** one richer parser over the stored `site_fetch` HTML → `title_tag, meta_description, schema_jsonld, canonical_url, heading_structure, content_depth, social_share_tags, media_richness`. Biggest bang per effort.
- **Wave B — wire existing layer-3 (7 signals, mostly wiring, paid scans):** `organic_keywords, keyword_rankings, content_cadence, owned_channels, marketplace_presence, community_presence, share_of_voice`. Re-points the proxies to real measured data.
- **Wave C — new/expensive (3 signals, later/optional):** `referring_domains` (Backlinks sub), `press_mentions` (Tavily news), app ASO signals. Each renders "not measured" until enabled — never a fake zero.

---

## 2. Current-state scorecard (condensed)

| Area | Requirement | State | Evidence |
|---|---|---|---|
| Score number | Deterministic | ✅ EXISTS | `score-full.ts:217` |
| 18-signal registry + per-signal persistence | config + `scan_signals` | ❌ MISSING (6 proxies, nothing persisted) | `score-full.ts:36-59,296` |
| `score_version` | on scans+snapshots | ❌ MISSING | — |
| Score visual | radial **gauge** + 5 correct bands | ⚠️ ring+radar, **wrong bands** (Excellent/Good… @80/60/40) | `discoverability-score.tsx:73-79` |
| Score Δ | vs previous scan, on hero | ⚠️ computed, framed "since you started", not on hero | `weekly-plan.ts:165` |
| Score-history chart | line + action markers + band zones | ❌ MISSING (sparkline only) | `sparkline.tsx` |
| Signal breakdown | pass/warn/fail + weight bars | ❌ MISSING | — |
| Search Gap | sortable table, opportunity cells, volume bars | ⚠️ `KeywordGapList` (no sort/color/bars) | `keyword-gap-list.tsx` |
| Action steps | impact-ordered, Δ pill, copy-draft | ⚠️ effort-bucketed, Δ as text, no copy | `action-plan-section.tsx` |
| Verification | scoped to `signal_keys[]`, predicted-vs-actual Δ | ⚠️ app-wide recompute; actual Δ never shown | `verify.ts:200-275` |
| Positioning Mirror | two-column diff | ⚠️ 3 prose paragraphs | `what-you-offer-section.tsx` |
| Evidence footer / Product switcher / metering / freshness | per docs | ❌ MISSING | — |

**Word-density:** four-question core skews prose (esp. Q1); M4 market sections already skew chart. Narratives are deterministic templates → restructuring into visuals is bounded.

---

## 3. Words → charts transformation

| Current prose/text | Replacement visual | Action |
|---|---|---|
| `score.verdict` prose | **band label** on gauge | demote |
| `Content 52 · Outreach 31 · SEO 64` text | **3 segmented pillar bars** + verdict tag | promote to gauge card |
| Positioning Mirror paragraphs | **two-column "listing says vs buyers value" diff** + gap callout | replace |
| "Who it's for" summary para | keep chips; summary → header tooltip | demote |
| `narrateKeywordGap` para | **Search-gap table** (opportunity color cells + volume bars) | demote to one-line |
| `narrateTopPages`/`narrateShareOfVoice` | existing table / donut+bars carry it | delete prose |
| Action "+12 pts" text | **green Δ pill**, size-scaled, impact-ordered | promote+reorder |
| Sparkline | **`ScoreHistoryChart`** (Recharts, band zones + action markers) | replace |
| `ProgressLine` prose | history chart says it visually; keep streak | demote |
| (none) | **18-signal pass·warn·fail breakdown** + weight bars | new |
| (none) | **evidence footer** (URL · ts · 18 signals · raw extraction) | new |

**Report anatomy:** Hero (gauge+band+Δ+URL+Re-scan) → 3 pillar bars → **top-3 fixes cards** → Q1 Positioning diff → Q2 Search-gap table → Q3 impact-ordered actions → Q4 signal breakdown → evidence footer. **`[MUST NOT]` open on a table.**
**Dashboard glanceable zone (3-col):** Gauge+Δ · **ScoreHistoryChart** · Next-action. Then queue, compact stats, collapsed sections. Growth: product switcher.

---

## 4. Chart library (decision: Recharts)

Adopt **`recharts`**, lazy-loaded behind `dynamic({ ssr:false })` (the existing `DiscoverabilityScore` lazy pattern), tree-shaken to `LineChart/AreaChart/XAxis/YAxis/Tooltip/ReferenceLine/ReferenceArea/Legend`. Budget a ~90KB async chunk on authenticated routes only; keep the custom `Sparkline` for inline table cells. `ScoreHistoryChart` (band `ReferenceArea` zones, action-completion `ReferenceLine` markers, toggleable pillar series, `score_version` annotation, designed empty states) is the first Recharts component; the search-gap and signal-breakdown visuals can stay custom-SVG/HTML where lighter. *(Note: this overrides the dependency-light default; accepted for richer interactive charting.)*

---

## 5. Data-layer & signal-engine preconditions (the expanded Phase 0)

**Migrations**
- **A — `scan_signals`:** `(id, scan_id→scans cascade, signal_key, pillar check(content/outreach/seo), raw_value numeric, normalised numeric, weight numeric, contribution numeric, state check(pass/warn/fail), platform, created_at)`; unique `(scan_id, signal_key)`; RLS service-write/owner-read.
- **A2 — versioning/markers:** `scans.score_version int default 1`, `scans.rank_data_fetched_at timestamptz`; `score_snapshots`: `score_version`, `source check(full_scan|weekly_refresh|action_verify)`, `scan_id`, `action_id` (non-null → history marker).
- **B — actions:** `actions.signal_keys text[] default '{}'`.
- **Backfill rule (§6.4):** never retro-compute historical `scan_signals` or retro-move scores; UI degrades ("signal detail available for scans after <date>").

**Code (new/changed)**
- `lib/scan/extract-html.ts` *(new)* — the **richer deterministic parser** over stored `site_fetch` HTML (node-html-parser): JSON-LD, OG/Twitter, canonical, headings, word count, alt/img, links, lengths → a typed `HtmlSignals` struct. Powers Wave A. **No new API.**
- `lib/scan/signals.ts` *(new)* — the 18-signal `SIGNAL_REGISTRY` + `scoreComponentToSignalKeys()` mapper + per-platform weights.
- `lib/scan/score-bands.ts` *(new)* — single source for the 5 correct bands + `bandFor()`; extract the duplicated `scoreLabel`/`ringColour` out of `discoverability-score.tsx`; fix vocabulary/thresholds (Invisible/Hard-to-find/Fair/Findable/Highly-discoverable @ 0-29/30-49/50-69/70-84/85-100).
- `score-full.ts` refactor — compute the score **from the 18 registry signals** (Wave A+B re-point proxies → real data: `keywords_ranking→organicKeywords`, `marketplace_presence→MarketplacePresence`, `content_*→Cadence/channels`); emit per-signal rows.
- `persistScanSignals(scanId, signals, mode)` — called from `runFullScan`, `snapshotScore` (`verify.ts`), and `runWeeklyRefresh`.
- `CURRENT_SCORE_VERSION` bumped to **2** when the model switches from proxies → real signals (this is the score-moving change); written on every persisted score.
- `signal_keys[]` seeded into `ActionCard` via the mapper in `persistActions`.

---

## 6. Phased build sequence

- **P0 — Signal engine foundation:** migrations A/A2/B; `extract-html.ts` (Wave A parser); `signals.ts` registry (18 defs, app subset flagged later); `score-bands.ts`; refactor `score-full.ts` to score from the registry (Wave A+B re-pointing); `persistScanSignals`; `score_version=2`; `signal_keys`. *Unblocks all signal UI.* **Heaviest backend phase.** Verify: `vitest` (extend score tests for new signals + determinism), fixture scan writes 18 `scan_signals`, scores recompute sanely.
- **P1 — Score as brand:** `DiscoverabilityScore` → correct band label + **Δ badge** (vs previous snapshot; baseline first) + demote radar/promote pillar bars; **"How this is calculated"** → `SignalBreakdownPanel` (18 rows, pass/warn/fail, weight/contribution bars, why/how-to-fix; degrades w/o data).
- **P2 — Report anatomy:** `ReportHeroBand` → pillar bars → `TopFixesPreview` (impact-ordered) → Q1 `PositioningMirrorSection` (two-column diff) → Q2 `KeywordGapTable` (Recharts/TanStack: opportunity cells + volume bars + "showing X of N" quota + freshness stamp) → Q3 `ActionPlanSection` (impact sort + Δ pill + copy-draft) → Q4 `SignalBreakdownSection` → evidence footer; mobile single-column; no-table-first.
- **P3 — Action engine:** `/app/plays` grouped Open/In-progress/Verifying/Done; **predicted vs actual Δ** (needs `signal_keys` scoping + `action_id` snapshots); "refreshes in X days".
- **P4 — Dashboard + `ScoreHistoryChart` (Recharts):** band zones, action markers, toggleable pillar series, `score_version` annotation, empty/low-data states; reader `lib/scan/score-history.ts`; 3-col glanceable zone; Growth product switcher.
- **P5 — Search-gap depth + signal weight bars + metering:** rank-depth quota from `TIER_LIMITS.rankDepth`; freshness stamps; contribution bars.
- **P6 — Distribution:** upgrade `opengraph-image.tsx`/`badge-embed.tsx` to `bandFor()` + top-1 fix; "share your score"; (later) `/tools` mini-checkers (each exposes one HTML-hygiene signal from Wave A — natural acquisition assets).
- **P7 — Polish + Wave C + app parity:** tooltip glossary; empty states; onboarding "see the score move"; Wave C signals (backlinks/press/ASO); App Store adaptive signal set.

---

## 7. Recommended MVP cut-line

**P0 (Wave A + B signal engine) + P1 (gauge/band/Δ/explainability) + P4 (history chart)** = the "dashboard feel" with a *real* 18-signal score behind it. Independently shippable; answers §9 priorities 1, 2, 5. P2/P3/P5 = increment two; P6/P7 = growth/polish/app-parity.

---

## 8. Risk register

| Risk | Mitigation |
|---|---|
| **Re-pointing proxies → real data MOVES existing users' scores** (e.g. theme-proxy → real organic keywords) | `score_version=2`; **don't retro-move history**; annotate chart "scoring upgraded — past scores shown as-is"; communicate; pick weights so the median user doesn't swing wildly |
| 18-signal weights must re-normalise correctly per pillar & platform | registry stores per-platform weights; unit-test each pillar sums to its weight and total∈[0,100] across mode |
| `scan_signals` empty for historical scans | graceful degrade; no backfill |
| App platform lacks the domain-based signals | adaptive subset + per-platform weights; "not measured" never fake-zero; app parity in P7 |
| Recharts bundle bloat | lazy `ssr:false`, tree-shake, authed-routes only |
| `score_version` jump confuses users | plain-English chart annotation |
| Determinism preserved through refactor | keep the number pure-code; extend determinism tests; LLM stays narrative-only |
| Weekly-refresh must persist signals | wire `persistScanSignals` into `runWeeklyRefresh` in P0 |

---

## 9. Remaining sub-decisions (smaller, can resolve during P0)
- **App-platform 18-signal subset** — which ASO signals to build now vs defer (drives P7 size).
- **Wave C scope** — enable the Backlinks subscription for `referring_domains`? Wire Tavily news for `press_mentions` now or later?
- **Weight calibration** — set the 18 per-pillar weights so v2 scores stay credible vs v1 (needs a sample run over fixtures/real scans before flipping `score_version`).

## 10. Verification (per increment)
`pnpm typecheck && pnpm test && pnpm lint` green; `pnpm test:render` clean; `pnpm build` (PPR intact); bundle reviewed (Recharts chunk lazy). Dev fixture: run a full scan, assert 18 `scan_signals` rows + sane recomputed score; seed multi-snapshot history (incl. `action_id`) to validate `ScoreHistoryChart` markers; confirm gauge band/Δ across low/mid/high; report gauge-first at 375px.

---

*v2 — decisions locked: 18-signal engine, Recharts, refine-first. Ground truth from the extraction audit: ~8 signals are cheap HTML parses of already-stored markup, ~7 are wiring of layer-3 data the score ignores today, ~3 are new/expensive (later). The score is already deterministic; the work is the per-signal data layer + the gauge/band/history visuals + metering/freshness — surfaced as charts over prose.*
