# Free Scan — Number Consistency & Honesty (design + plan)

**Date:** 2026-07-17 · **Status:** design agreed, not implemented · **Owner:** Tim
**Purpose:** this document is written to be **MERGED with a parallel agent's findings/plans**. §0 is the merge contract; §10 lists what this plan deliberately does not decide.

---

## 0. Merge notes (read first)

**What this plan is.** The free scan is the lead magnet and the first touchpoint. Its
headline numbers were audited against live production data on 2026-07-17. **Three of
the four numbers on its search panel do not measure what their labels claim**, and the
product ships **four mutually-inconsistent definitions of "monthly searches"**. This
plan makes the free scan's numbers mean what they say, and collapses the two parallel
keyword systems into one.

**Decisions already locked by the owner** (do not re-litigate on merge — reopen only
with an explicit reversal):

| # | Decision | Consequence |
|---|---|---|
| D1 | **Competitor keyword gap stays PAID-only** | Free never shows "what rivals win that you don't" |
| D2 | **No rival keyword fetch on the free scan** | Free measures only the subject; competitors are *named* (from `facts.competitors`), never *measured*. The word "gap" does not appear on free. |
| D3 | **Stable method, honest movement — NO ratchet** | Metrics are computed one way everywhere so they don't wobble from sampling; a genuine decline still renders as a decline. "Only grows" = kill the fake wobble, not the bad news. |

**What merges cleanly.** This plan touches: `lib/scan/search-visibility.ts`,
`lib/scan/free-report.ts`, `components/report/captured/{results-screen.tsx,to-results-props.ts}`,
a new `lib/scan/keyword-engine/` module, and the guard layer. If the parallel agent's
plan touches the paid intel views (`components/app/intel/*`), the **§6 metric contract**
is the shared seam — adopt it there too and the two plans compose.

**What conflicts.** Any parallel proposal that (a) puts rival keywords on free,
(b) adds a *new* "monthly searches" metric, or (c) ratchets a displayed number,
contradicts D1/D2/D3 — surface it, don't merge it silently.

**Prerequisite to verify before implementation** (marked `[VERIFY]` throughout): the
exact response shape + live cost of DataForSEO `dataforseo_labs/google/domain_rank_overview/live`.
Everything else in this document was verified against production.

---

## 1. Evidence ledger (all verified against prod, 2026-07-17)

Subject: `resend.com`, scan `14533748-9d8f-4783-94b4-63ade4884cce`, tier `free`,
`score_total = 85`, `score_version = 5`. The numbers below match what the owner read
off the live page, so the render is confirmed.

### 1.1 `categoryCaptureRate` is not a capture rate — it is the score, renamed

`lib/scan/search-visibility.ts:285`:

```ts
const categoryCaptureRate = sv.score;
```

Verified across **all 10 scans ever run**: `categoryCaptureRate === searchVisibility.score`
in **10/10 rows** (100=100, 81=81, 46=46, 6=6, 0=0 …). The free report therefore prints
the *same number twice under two labels*: "Search presence **81**" (hero driver bar) and
"You capture **81%**" of your category. This is the root of the owner's "they seem so
similar" — they are identical.

**Why it was substituted.** The honest ratio is impossible with current inputs:
`categoryCapturedSearches` exceeds `categoryDemand` on 7/10 scans, by up to **1,308×**
(143,890 captured vs 110 demand) and **933×** (10,221,350 vs 10,950). The real ratio
would print "130,800% captured", so the score was swapped in. The unit mismatch is
acknowledged in the code comment — the mismatch was hidden, not fixed.

### 1.2 `keywordsRanked` is the API limit, not a measurement

`search-visibility.ts:320` → `cachedRankedKeywords(self, 50)`; `keywordsRanked = rows.length`.

Verified distribution across all scans with a `searchVisibility` payload:

| `keywordsRanked` | scans |
|---|---|
| **50** | **7** |
| 6 | 1 |
| 0 | 2 |

Every established domain pins at exactly 50 — forever. resend.com ranks for thousands.
**It is a constant rendered as a metric.**

### 1.3 `estMonthlyVisits` is a top-50 slice presented as a total

`estMonthlyVisits = Σ etv` over the same capped 50 rows (`order_by etv desc`). resend's
24,551 is the sum of its **top 50 terms only** — a floor, labelled "est. visits / mo".
`brandPct`/`categoryPct`/`offTopicPct` are likewise computed over those 50 rows only.

### 1.4 `categoryDemand` is three LLM-guessed phrases, not a market

`computeCategoryDemand` sums the volumes of ≤8 LLM-authored seed phrases. For resend the
arithmetic pins it exactly: `email api` (590) + `email delivery service` (590) +
`transactional email api` (70) = **1,250**. Three phrases.

No number is fabricated (DataForSEO supplied each volume — the `categorySeeds` design
correctly avoids `keyword_ideas` expansion noise). **The label overstates the measurement.**
Across scans this "category size" ranges **10 → 123,300**, which is seed-guessing variance,
not market size. The seeds are **never shown to the user**: the report itemises only the
*unwon* seeds (660 of the 1,250), so the total can never be reconciled by the reader.

### 1.5 Two adjacent percentages, both labelled "category", 9× apart

The panel renders, inches apart:

- "**You capture 81%**" (= the search-presence score, §1.1)
- "**your category 9%**" (= category share of top-50 ETV, §1.3)

Worst case in prod: capture **100%** beside category share **13%**.

### 1.6 The 24,551 vs 1,250 impossibility

24,551 est. visits/mo from a category with 1,250 searches/mo is arithmetically impossible.
Different denominators, rendered as one story. This is what the owner sensed as
"we need to show the differentiator between those two metrics better" — they are not two
metrics needing differentiation; one is a mislabelled copy of the score and the other is
a capped sample.

### 1.7 "The weaker half" is hardcoded and false on 40% of scans

`results-screen.tsx` prints, unconditionally:

> "Winning this term lifts your **Search presence** — the weaker half of your Discoverability Score."

Verified: search presence is the **stronger** half on **4 of 10 scans** (on-page 48 /
search 100; on-page 76 / search 100; on-page 93 / search 100; on-page 75 / search 87).
We tell those users to fix their strongest driver.

### 1.8 "18 signals" — we measure 9

`results-screen.tsx:497` hardcodes `· 18 signals ·`. Actual `scan_signals` rows for resend:

- **measured: 9** — 6 pass (`canonical_url`, `content_depth`, `heading_structure`, `media_richness`, `schema_jsonld`, `social_share_tags`), 2 warn (`title_tag`, `meta_description`), 1 fail (`comparison_pages`)
- **unmeasured: 9** — `organic_keywords`, `keyword_rankings`, `referring_domains`, `content_cadence`, `owned_channels`, `marketplace_presence`, `community_presence`, `share_of_voice`, `press_mentions`
- **feeding the score: 8** (`FIXED_BASIS_SIGNAL_KEYS`)

The registry defines 18; free measures 9; the gauge uses 8. `components/report/evidence-footer.tsx:16-17`
already computes this claim **honestly** from real counts — so the product contradicts
itself on the same fact in two components.

### 1.9 Four incompatible definitions of "monthly searches"

| Surface | Label | Computation |
|---|---|---|
| Free report | "searches/mo **across your category**" | Σ ≤8 LLM seed volumes (`google_ads/search_volume`) |
| `intel/demand-view.tsx:62` | "**Addressable searches** — monthly, category-wide" | Σ on-topic `keyword_ideas` volume |
| `intel/synthesis-view.tsx:59` | "**Volume opportunity** — monthly searches in reach" | Σ `contentPlan.estMonthlyVolume` |
| `demand/gather.ts:337` (progress) | "N **monthly searches**" | Σ **raw** `keyword_ideas`, pre-filter |

A user upgrading sees three different answers to one question, with no reconciliation.
(`lib/scan/score.ts:70` carries a fifth `totalVolume` for `kwScore`.)

### 1.10 Cost: the free soft cap did not fire

Free-tier external spend (DataForSEO + Tavily), `status='done'`:

- **typical: 12.60¢** (6 of 8 scans) — healthy headroom under the 25¢ cap
- **one outlier: 120.70¢ — 4.8× the cap — with `external_cap_hit_at` NULL**

Invariant #2's soft cap **did not bite** on a 120.70¢ free scan. This is the
"a guard you have not SEEN FAIL is not a guard" class, live in production.
`[VERIFY]` root cause: retries/`Promise.all` racing past the checkpoint, or the flag never
being read on that path. **This is a cost-safety bug and does not depend on the rest of
this plan — it can ship first.**

---

## 2. Root cause

Two causes, both structural. Every individual defect above is a symptom of one of them.

**RC1 — Free and paid run two different keyword systems.**

- **free:** `lib/scan/search-visibility.ts` — its own `classify()`, its own `categoryDemand`, its own score, its own vocabulary
- **paid:** `lib/scan/referral/keyword-gap.ts` — cohort gap, its own brand filter, its own `WINNING_POSITION`
- **paid intel:** `lib/scan/demand/gather.ts` — a *third* demand model (`keyword_ideas` themes)

Same primitives, three implementations, three answers. This is the "two parallel systems"
anti-pattern already flagged in the 2026-07-10 pipeline audit (*"TWO duplicate
competitor-discovery + demand pipelines billed twice"*) — it was never collapsed, and
§1.9 is the bill coming due. **Consistency cannot be achieved by editing labels while
three engines disagree underneath.**

**RC2 — No guard checks that a number matches its label.**

The harness is strong and still caught none of this:

| Layer | Why it was blind |
|---|---|
| `documented-invariants.test.ts` | pins **constants** (v5, geomean, `FIXED_BASIS`) — `captureRate = score` violates no constant |
| `registry-score.test.ts` | pins free↔paid **stability** — a number that is stably wrong passes |
| Label-drift (layer 4) | compares **DS card text ↔ live component text** — never text ↔ *data* |
| `check:design` | tokens/mirrors — cannot see semantics |
| `expectCallsSymbol` | proves a symbol is **called** — not that its output means anything |

**The missing gate: does the value under this label measure what the label says?**
`keywordsRanked = 50` and `captureRate = score` are true-by-construction and pass everything.
This is the same shape as the `add-product-policy` tripwire that asserted a file contains
a symbol it *defines*. Per the Change Protocol, a new invariant needs a guard before merge —
§7 defines it.

---

## 3. Decisions (locked — see §0)

**D1: The competitor keyword gap stays paid-only.**
**D2: The free scan fetches no rival keyword data.** Free measures the subject only.
Competitors are *named* from `facts.competitors` (invariant #6's category-validated
discovery set — unchanged) but never measured. The word "gap" is reserved for paid.
**D3: Stable method, honest movement.** No displayed metric ratchets.

**Consequence for the owner's stated process.** The owner described a free flow that
included *"compare how they stand against their competitors… find what keywords they rank
for that resend don't… a very clear image of what the gap is."* Under D1+D2 **steps 3–4 of
that process are the PAID promise, not free.** This was raised and confirmed. The free
report's job is now narrower and sharper: *an honest, complete picture of YOU* — and the
paid report's job is *the gap*. That is a cleaner paywall than today's (free currently
shows a weak, mislabelled pseudo-gap that undercuts the real one).

---

## 4. The target process

**Free scan — "an honest picture of you"** (~14.6¢ external, 3 DataForSEO calls):

1. Fetch the page HTML → **8 on-site signals** → **on-page readiness** (unchanged, e.g. 90)
2. `domain_rank_overview(self)` `[VERIFY]` → **true** total keywords, **true** total organic ETV, position distribution — **1 call, ~2¢, NEW**
3. `ranked_keywords(self, 50)` → the top-50 terms, for the brand/category/off-topic split and to name the terms you win — **existing**
4. `google_ads/search_volume(categorySeeds)` → the volume of each named category phrase — **existing**
5. **Unified Discoverability Score** = geomean(on-page readiness × search presence) — **unchanged, invariant #1 untouched**
6. Name competitors from `facts.competitors` — **no keyword fetch** (D2)

**Paid deep scan — "the gap"** (unchanged in scope):
`gatherKeywordGap` over the `MAX_SELECTED=5` cohort, per-rival share, drafts, plan,
weekly tracking, `marketPosition`. The 14-day `rk:<domain>:50` cache means step 3 above
is a **cache hit** on upgrade — no double spend.

**Why this is simple.** Free = one subject, honest totals. Paid = the same engine plus
rivals. One code path, one set of definitions, tier decides only *how many domains get
fetched* — never *which formula runs*.

---

## 5. Architecture — one keyword engine

New module `lib/scan/keyword-engine/` — **the single source of every keyword number in
the product**, free and paid. Replaces the free half of `search-visibility.ts` and becomes
the substrate `keyword-gap.ts` and `demand/gather.ts` read from.

```
lib/scan/keyword-engine/
  footprint.ts   — what the subject ranks for.       Input: domain.
                   Output: Footprint (true totals + top-50 sample, EXPLICITLY separated)
  demand.ts      — what the category is worth.       Input: named seed phrases.
                   Output: Demand (per-phrase volumes, always itemised)
  presence.ts    — the 0–100 search-presence score.  Input: Footprint.
                   Output: number  (the ONLY consumer of CATEGORY_TARGET)
  gap.ts         — subject vs cohort.  PAID ONLY.    Input: Footprint[] (subject + rivals)
                   Output: Gap
  types.ts       — the contract in §6
```

Boundaries: `footprint` knows nothing about tiers, rivals, or rendering. `presence`
consumes a `Footprint` and returns a number — nothing else may compute a presence score.
`gap` takes `Footprint[]`; free simply never calls it. **The free/paid difference becomes
"how many Footprints did we fetch", not "which engine ran".** That is what makes the
numbers consistent by construction rather than by discipline.

---

## 6. The metric contract (the shared seam — adopt this in the merge)

The type makes the §1 defects **unrepresentable**. Every field carries its own basis.

```ts
/** A measured quantity that knows how it was measured. */
export interface Measured {
  value: number;
  /** "complete" = the true total for the domain.
   *  "sample"   = derived from a capped subset; `sampleSize`/`sampleOf` MUST be set. */
  basis: "complete" | "sample";
  sampleSize?: number;
  sampleOf?: string;      // e.g. "top 50 terms by traffic"
  source: "domain_rank_overview" | "ranked_keywords" | "google_ads_search_volume";
}

export interface Footprint {
  keywordsRanked: Measured;    // basis "complete"  ← fixes §1.2
  monthlyVisits: Measured;     // basis "complete"  ← fixes §1.3
  /** The split is honestly a sample — the type says so, and the UI must render it. */
  brandPct: Measured;          // basis "sample", sampleOf "top 50 terms by traffic"
  categoryPct: Measured;
  offTopicPct: Measured;
  topTerms: ClassifiedKeyword[];
}

export interface Demand {
  /** Σ of `phrases` — and the phrases are ALWAYS carried, so the total is
   *  reconcilable by the reader. Fixes §1.4. */
  total: Measured;
  phrases: Array<{ keyword: string; volume: number; yourPosition: number | null }>;
}
```

**Rules that follow from the contract:**

1. **`categoryCaptureRate` is deleted.** Not recomputed — deleted (§1.1). If a capture
   rate is ever reintroduced it must be `Measured` with a numerator and denominator in
   the same unit, which today's inputs cannot supply.
2. **`categoryCapturedSearches` is deleted** — it is internal, incoherent (§1.1), and
   feeds nothing once (1) is gone.
3. **A `Measured` with `basis: "sample"` MUST render its `sampleOf` next to the value.**
   "9% your category" becomes "9% of your top 50 terms by traffic".
4. **`Demand.phrases` MUST be rendered wherever `Demand.total` is rendered.** This alone
   converts the mystery 1,250 into the report's most convincing artifact and answers
   "what does *email delivery service* even mean" for free.
5. **One name per concept, product-wide** (fixes §1.9):
   - **"Category demand"** — Σ of named seed phrases. The ONLY "monthly searches" on free.
   - **"Addressable demand"** — paid `keyword_ideas` on-topic total. Never shown on free.
   - The progress-toast raw total (`gather.ts:337`) is **pre-filter** and must stop
     claiming "monthly searches" — it is a progress detail, not a metric.
   - `synthesis-view`'s "Volume opportunity" must state it is Σ of the content plan, not a market size.

---

## 7. The guard class (the ratchet addition — the most important section)

Per the Change Protocol, these ship **in the same commit** as the change they guard.
Every guard below must be **proven to bite**: break the production code, watch it fail
with real output, revert, confirm green. **A guard not seen failing is not a guard.**

| # | Guard | Bites when | Kills |
|---|---|---|---|
| G1 | **No metric equals another metric** — assert `captureRate !== presenceScore` over a fixture matrix with distinct inputs | any field is silently aliased to another | §1.1 |
| G2 | **No metric equals its own fetch limit** — assert `keywordsRanked.value !== FETCH_LIMIT` for a domain known to exceed it; assert `basis === "complete"` | a cap is rendered as a measurement | §1.2 |
| G3 | **Sample basis must be disclosed** — render test: any `Measured` with `basis:"sample"` renders its `sampleOf` string | a sampled number is shown as a total | §1.3, §1.5 |
| G4 | **Demand totals reconcile** — assert `Demand.total.value === Σ Demand.phrases[].volume` **and** every phrase is rendered | an unreconcilable total is shown | §1.4 |
| G5 | **Comparative copy is conditional** — assert the "weaker half" string is absent when `searchPresence >= onPageReadiness` | hardcoded comparative claims | §1.7 |
| G6 | **Signal counts are computed, never literal** — source tripwire via `expectCallsSymbol`: `results-screen.tsx` must not contain a hardcoded signal count; the count comes from real rows | a literal claim drifts from reality | §1.8 |
| G7 | **One "monthly searches" vocabulary** — pin the exact allowed label strings; a new one fails | a fifth definition appears | §1.9 |
| G8 | **The free external cap actually fires** — integration test driving spend past `EXTERNAL_SCAN_CAP_CENTS_FREE` and asserting `external_cap_hit_at` is stamped **and** enrichment stops | the cap silently no-ops | §1.10 |

**G8 is the one to write first** — it guards live money and is independent of everything else.

`documented-invariants.test.ts` gains the §6 contract; `CLAUDE.md` gains a new hard rule:

> **A rendered number must measure what its label says.** Every metric crossing into a
> component carries its own basis (`complete` vs `sample`) and source. A sampled number
> renders its sample. A metric may never be aliased to another metric, and never equals
> its own fetch limit. Guards G1–G8.

---

## 8. Workstreams

Ordered by *independence* — WS0 ships alone today; WS1–WS2 are the honesty fixes;
WS3 is the collapse. **Each lands with its guard.**

### WS0 — The cap that didn't fire *(independent, ship first)*
Root-cause the 120.70¢ free scan (§1.10). Fix `recordExternalCost` / the
`externalCapBreached()` checkpoints so breach stamps `external_cap_hit_at` and halts
enrichment. **Guard G8, proven biting.** Touches `lib/scan/cost-context.ts`, `full-scan.ts`.
*No dependency on the rest of this plan.*

### WS1 — Honest totals *(the core fix)*
- Add the `domain_rank_overview` adapter `[VERIFY]` → true `keywordsRanked` + `monthlyVisits`
- Introduce `Measured` + `Footprint` (§6); mark the brand/category/off-topic split `basis:"sample"`
- **Delete** `categoryCaptureRate` and `categoryCapturedSearches`
- Render `sampleOf` beside every sampled value
- **Guards G1, G2, G3.**

### WS2 — Honest copy *(cheap, high-trust, no data change)*
- `Demand.phrases` rendered wherever the total is (the seeds become the proof)
- "18 signals" → computed from real rows, matching `evidence-footer`'s existing honest logic
- "the weaker half" → conditional
- Kill the "you capture X%" bar; the panel now reads: your true footprint → your category
  phrases → the ones you don't win
- **Guards G4, G5, G6.**

### WS3 — One engine *(the structural collapse — fixes the class)*
- Stand up `lib/scan/keyword-engine/` (§5)
- Re-point `search-visibility.ts` (free), `keyword-gap.ts` (paid), and `demand/gather.ts`
  at it; delete the duplicated `classify`/brand-filter/vocabulary logic
- Unify the "monthly searches" vocabulary across free + intel views (§6.5)
- **Guard G7.** Verify invariant #1 (v5 free↔paid parity) still holds via `pnpm eval`.

### WS4 — Verification *(non-negotiable, per CLAUDE.md)*
`REACHKIT_USE_FIXTURES=false`, deploy, scan **three** live shapes — an established SaaS
(`resend.com`), a 0-ranking new product, a directory — then **headless-render each and read
the actual text**. Fixtures return canned clean data and would mask every defect in §1.
Confirm: no number equals a limit, every sampled number states its sample, every total
reconciles, no two labels share a value.

### Deferred (not this plan)
- The **Positioning Mirror** earns its space or goes. Evidence it currently doesn't:
  `whoItsFor.summary` for resend reads *"Buyers who value **reviews, com, similar**"* —
  naive token extraction, literally the word "com". The mirror pairs two near-synonym LLM
  tag-lists with no action and no evidence link. **Needs its own design pass** — likely
  merges with the parallel agent's work.
- `CATEGORY_TARGET = 6` saturation: 3/10 scans score a perfect 100 search presence.
  The score is a weak discriminator at the top. Belongs with `docs/score-calibration.md`,
  the known-open red rule.
- The `radar` Outreach axis reports `assessed:false`, while `scan_signals` for the same
  scan holds a **measured** `comparison_pages` row (state `fail`, pillar `outreach`). The
  headline basis and the signal table disagree about whether Outreach was measured. Same
  class as the shipped `735dbae` dead-row bug.

---

## 9. Cost model

| | today | after |
|---|---|---|
| Free external, typical | 12.60¢ | **~14.6¢** (+1 `domain_rank_overview`) |
| Free soft cap | 25¢ (**not enforced** — §1.10) | 25¢, **enforced (G8)** |
| Paid external, typical | ~37–60¢ | unchanged |

Free stays well inside the cap. D2 (no rival fetch) is what buys the headroom: the
alternative — 5 rival calls on every free scan — would cost ~21.6¢ on 100% of scans to
serve the ~5% who convert.

---

## 10. Open questions (for the merge)

1. **`domain_rank_overview` `[VERIFY]`** — ✅ **RESOLVED 2026-07-17 (live).** The endpoint
   works at **~1.2¢** (`cost: 0.01212`) and returns a **true keyword count + true ETV** — so
   WS1 does NOT need the fallback. **Path correction (the plan's assumption was wrong):** the
   metrics are at **`result[0].items[0].metrics.organic`**, NOT `result[0].metrics.organic`.
   Live for `resend.com` (location 2840, lang en): `organic.count = 2100`, `organic.etv = 28529.8`,
   `organic.pos_1 = 87`, `organic.is_new = 1409`. So the adapter reads
   `tasks[0].result[0].items[0].metrics.organic.{count,etv,pos_1,pos_2_3,pos_4_10,…}`. The
   current free report shows `keywordsRanked = 50` (the API cap) for this same domain — the
   true number is **2,100**. `count`/`etv` are both present, so WS1 renders both; the
   "drop the keyword count" fallback is unused.
2. **What replaces the "capture" bar?** Deleting it (§6.1) leaves a hole in the panel's
   middle. Proposal: "your category phrases, and where you sit on each" — a real,
   itemised, reconcilable table built from `Demand.phrases`. Needs a design pass.
3. **Does the parallel agent's plan touch `components/app/intel/*`?** If so, §6 is the
   shared seam and §6.5's vocabulary must be adopted there in the same release.
4. **Free-report seed quality.** `categorySeeds` produced only 3 usable phrases for a
   company as large as resend. The seeds are now user-visible (§6.4), which raises the
   quality bar on the LLM prompt that authors them. Possibly the parallel agent's territory.

---

## 11. What this plan explicitly does NOT change

- **Invariant #1** — the unified Discoverability Score v5, geomean, free↔paid stability.
  The headline is untouched; only the *drivers' honesty* changes.
- **Invariant #6** — competitor discovery stays discovery-only.
- **The paid deep pass** — scope unchanged.
- **`FIXED_BASIS_SIGNAL_KEYS`** — the 8-signal on-page driver is unchanged; only the
  *claim about how many signals we measured* is corrected.
