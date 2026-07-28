# Requirement Intake — number-claim-honesty-paid-surfaces

## 1. Verbatim requirement

> "Wait, this was the entire reason we built the competitor page. To pull our
> competitors top referrers. Why are we then pulling referrs whole-domain monthly
> organic traffic? … This is completely unrelated to, in this example, acquire.com"
>
> "How are we then defining even in the first place that indiehackers is a referrer
> of acquire.com?"
>
> "This must even be more wrong, indiehackers is a whole platform and has much more
> than 84k monthly traffic … this structure is completely broken …"
>
> "this kills me - I was so close to launching and this sets us back … We have no
> choice but to fix this now … I need you to similarly review the same logical
> inconsistencies across all pages and data structures"
>
> — owner (Tim), 2026-07-28

Owner decisions recorded via the intake question set (2026-07-28):
- **ETV/traffic magnitudes:** *Drop the raw magnitudes* — remove "Est. visits/mo",
  the traffic-by-channel donut, "Pulls 84K/mo"; keep only honest relative/strength
  signals.
- **Competitor page:** *Full rename + reframe* — "referrers / where you get found"
  → **backlinks & placements**; no traffic implication anywhere.
- **Sequence:** *Write this intake first*, get sign-off, then build.

## 2. Restatement

A single defect class shipped across the product: **a rendered number or claim
whose data source does not measure what its label says.** Two root sources:
1. **DataForSEO organic ETV / search volumes** — US (`location_code 2840`),
   English, Google-**organic-only** (`lib/config/env.ts:91-92`), rendered as
   "traffic / visits / demand / market size / reach" with no scope qualifier
   (NARROW-SLICE-AS-TOTAL).
2. **DataForSEO backlinks** (`backlinks/backlinks/live`) — proves only that an
   `<a href>` **exists** on a page; rendered as "referrers / where you get found /
   discovery channels / traffic by channel" (EXISTENCE-AS-MAGNITUDE; referrer≠backlink).

**Deltas from the verbatim (added / narrowed):**
- The owner asked specifically about the competitor referrer number; the work is
  **narrowed to the class**, not that one cell — every sibling render is in scope
  (full ledger §6/§7).
- **Added** (owner-approved): drop raw ETV magnitudes entirely (not merely qualify
  them). Keep same-slice ratios/shares only where the label states the slice.
- **Added:** the durable half — extend the number-honesty rubric to the **paid**
  surfaces (the coverage gap that let this ship; R-6.6 exists but is `UNENFORCED`).
- **Not in scope:** re-designing the scoring model (Discoverability / Market
  position / Footprint strength are honest and stay); adding non-US DataForSEO
  locales (a data-cost decision, deferred — see O-ETV-LOCALE below).

## 3. Open questions — asked BEFORE design

| # | Question | Answer | Answered by / date |
|---|---|---|---|
| 1 | ETV magnitudes: drop, or qualify with "US · Google organic"? | **Drop** raw magnitudes; keep honest relative/strength only | owner, 2026-07-28 |
| 2 | Competitor page: full reframe or relabel copy only? | **Full rename + reframe** to backlinks & placements | owner, 2026-07-28 |
| 3 | Build now or intake-first? | **Intake first**, then build | owner, 2026-07-28 |
| 4 | Category-demand "altitude": a laddered head-term volume renders under the LLM's narrower cosmetic label (bare "seo" 40.5k under "SEO tooling"). Keep, or reconcile label↔number? | DEFAULT until owner rules: keep laddering, but the rendered label states the measured phrase. Recorded as `OPEN(O-CAT-ALT)`. | pending |
| 5 | Do we ever want non-US search data (the real fix for "understated for global founders"), or is dropping magnitudes sufficient for launch? | DEFAULT: drop-magnitudes ships for launch; multi-locale is a separate funded data decision. Recorded as `OPEN(O-ETV-LOCALE)`. | pending |

## 4. Permutation matrix

Axes: tier (free/paid) × auth (anon/authed/owner) × entry surface (public `/scan` ·
`/app` · checkout/webhook · cron) × data-state (fresh / legacy-payload /
empty-inputs / pathological / wrong-subject).

| Cell | Covered / Excluded | How / why |
|---|---|---|
| free × anon/authed × public `/scan` × fresh | **covered** | Free report: relabel "est. visits/mo" (drop or qualify per §5), fix `offTopicPct` label + under-summing split bar. |
| free × any × public `/scan` × legacy-payload | **covered** | Label/render-layer only; legacy `report_payload` still renders (null-coalesced at `to-results-props.ts`). Legacy render test extended. |
| free × any × public `/scan` × empty-inputs | **covered** | 0-ranking / referrer-less already omit sections (invariant #11); no magnitude to mislabel. |
| paid × authed × `/app` dashboard × fresh | **covered** | Drop "Est. visits/mo" KPI + "traffic by channel" donut; keep footprint/scores (honest). |
| paid × authed × `/app` competitors × fresh | **covered** | Full reframe: referrer→backlink & placement; gap-map relabeled to link-presence, not discovery-strength; drop ~84K magnitude framing (keep authority/dofollow). |
| paid × authed × `/app` demand+plan × fresh | **covered** | "Addressable demand" → sample-disclosed label; Ease/Impact meters → bands not %; intent de-precisioned; buyer-insights provenance fixed. |
| paid × authed × `/app` × legacy-payload | **covered** | Render-layer relabel; older payloads (pre-field) null-coalesce; paid-corpus fixture (O-4) exercises legacy shape. |
| paid × authed × `/app` × empty/pathological | **covered** | Empty backlink/demand sets already omit their sections; the funnel-poison guard (2026-07-28) covers the all-"other" pathology. |
| owner × `/app/diagnostics` | **excluded** | Cost/telemetry surface; renders no ETV/backlink magnitude to a customer. |
| any × checkout/webhook × any | **excluded** | No render of these numbers; provisioning path only. |
| any × cron/Inngest × any | **excluded** | Refresh writes payload; render honesty enforced at the render layer it feeds, covered above. |

No blank cells.

## 5. Acceptance criteria (written FIRST, watched fail)

The durable oracle is a **rubric extension to the paid surfaces** + free-report
rubric additions. All written and watched-fail on real captured fixtures BEFORE
implementation (corpus-first). Depends on landing the paid-corpus fixtures named
in `OPEN(O-4)`.

**Free report — new rules in `lib/testing/report-rubric.ts` (run by
`report-corpus.rubric.test.tsx` over `lib/scan/fixtures/report-corpus/*`):**
- **R10 — slice-honest magnitudes:** no render labels an ETV/organic number
  "visits / traffic / reach / audience" without a scope qualifier (or the number
  is dropped). Fires on the current `results-screen.tsx:800` "est. visits/mo".
  Mutation-proven on a real payload.
- **R11 — bucket completeness:** a split bar's rendered segments sum to 100 (no
  silent under-fill from an unrendered bucket like `aggregatedPct`); a
  "%-of-X-names" label points at the bucket it names. Fires on the directory
  fixture (`offTopicPct` mislabel).

**Paid surfaces — new rules in `INTEL_RUBRIC_RULES` (paid corpus, `paid-corpus.rubric.test.tsx`),
extended to the dashboard + competitor + demand/plan builders:**
- **Ri3 — no ETV magnitude under an unqualified traffic label** (own KPI, rival
  cards, referrer rows, landing-page chips). Mutation: reintroduce "Est. visits/mo"
  → fails.
- **Ri4 — no backlink-derived COUNT rendered as a traffic share/flow** (the
  "traffic by channel" donut; gap-map "Strong/Some/None" as discovery strength).
- **Ri5 — terminology:** the token "referrer/referral" never labels backlink data
  on the competitor surface (source tripwire via `expectCallsSymbol`-style scan of
  the rendered label set).
- **Ri6 — no fabricated precision:** a value drawn from an N-bucket categorical
  (Ease/Impact from `EASE`/`IMPACT`; per-thread `intent`) does not render as a
  granular %/2-decimal; it renders the band. Mutation: render `Math.round(value*100)%`
  → fails.

**Non-render guards:**
- Close `OPEN(O-5)`: assert `audienceProxy` is absent (grep-tripwire) — the placeholder is gone; the doc-risk is stale.

## 6. Class statement

**Class:** a rendered number/claim whose data source does not measure its label.
Sub-types: (1) mislabel · (2) existence-as-magnitude · (3) whole-entity attributed
to a relationship · (4) narrow-slice-as-total · (5) LLM-guessed-as-measured ·
(6) alias · (7) referrer(=sent visitors)≠backlink(=a link exists).

**Every sibling site (the full audit ledger — all must be fixed, not just the
reported cell):**

*Launch-blockers* — competitor "referrers/where you get found" framing
(competitors-view.tsx:177,192,126-128); "Est. visits/mo" own-KPI = US-organic ETV
(dashboard-view.tsx:169; intel.ts:126; competitors-view.tsx:128,168); "traffic by
channel" donut = backlink counts as % traffic (dashboard-view.tsx:153-167;
traffic-lens.ts:104-124).

*Serious* — gap-map "Strong/Some/None" = backlink-host count as discovery strength
(competitor-gap-map.tsx; channel-strength.ts); "used by N rivals / channels
missing" (funnel.ts:130,251); plan "Ease/Impact %" from LLM buckets
(plan-entry-card.tsx:586; synthesize.ts:215); "Addressable demand · category-wide"
= kept-sample sum (demand-view.tsx:62; gather.ts:401); US/en/Google scope disclosed
nowhere (rank-targets, demand-view, dashboard-view); free-report "est. visits/mo"
+ "other companies' names %" mislabel (results-screen.tsx:800,806-824).

*Minor* — driver chips "On-page 98/Search 4" missing `/100` (dashboard-hero.tsx:73);
per-thread "intent 0.90" false precision (buyer-thread-feed.tsx:221); "Buyer
insights from 0 review pages" + own inferred pains as buyer-sourced
(demand-view.tsx:98; gather.ts:189); keyword intent defaulted "informational"
(demand-view.tsx:90); free-report "+N" fix-cards missing "pts" (results-screen.tsx:935);
"opportunity"=volume band; share-of-voice / page-ETV / "referring domains" nuances;
"we ranked the closest matches" (LLM).

*Honest (keep; the pattern to extend):* unified gauge, Market position, Footprint
strength (named+scaled+distinct); plan "+N pts" (#5a-compliant); thread engagement
(real, gated); keywordsRanked never printed on paid; free-report gauge/driver
bars/keywordsRanked-sample-disclosure/category-demand-reconciliation/LLM-numeral-scrub.

## 7. Rendered-surface ledger

This requirement **deletes renders and their orphaned calls** — the inverse of the
usual "new call needs a surface":
- **Delete** "traffic by channel" donut → if `computeTrafficLens`/`lens.sources`
  has no other live consumer, delete it too (verify before deleting; `TrafficLens`
  is types-only elsewhere per the supply-view note).
- **Keep** `fetchTrafficForHosts`/`monthlyTraffic` ETV **as an internal signal**
  (it still drives competitor **size tiers** and the referrer **low-relevance**
  flag — both of which DO render). It is only removed as a **raw magnitude**. This
  stays within "never pay for data you don't render" because the call still
  terminates in a rendered strength/tier, just not a mislabeled number.
- **No new cost-bearing calls** are introduced. (Multi-locale ETV, which WOULD be
  a new call, is explicitly deferred — O-ETV-LOCALE.)
- Competitor reframe introduces **no new data** — it renders the same backlink
  fields (authority, dofollow, anchor, category presence) under honest labels.

## 8. REQUIREMENTS.md delta (ships in the same PR)

- **New R-1.10 — Number-claim honesty (slice / existence / terminology).** No
  rendered number is labeled beyond what its source measures: an organic-ETV/volume
  figure is never "traffic/visits/reach/market" without its US·Google·organic
  scope (default: drop the magnitude); a link-existence count is never a traffic
  flow/share; "referrer" never labels backlink data; a categorical bucket never
  renders as fabricated precision. Binds free AND paid.
- **Strengthen R-6.6** — the paid honesty requirement gains machine enforcement
  (`INTEL_RUBRIC_RULES` Ri3–Ri6); the §12 Quality Contract "Terseness / Data-driven"
  and this new row move from `UNENFORCED (paid)` toward enforced as O-4 lands.
- **New R-3.x — Competitor surface is a backlink & placement map**, not a referrer
  /traffic map: SEO-strength gap (authority + dofollow) and placement gap (venues
  where rivals have links you don't); no traffic attribution.
- **Close OPEN(O-5)** — `audienceProxy` is gone from the codebase; mark resolved.
- **Add OPEN(O-CAT-ALT)** (§3 Q4) and **OPEN(O-ETV-LOCALE)** (§3 Q5) to §0.

## 9. Suggested phasing (not part of the contract — for the plan step)

1. **Free-report labels** (R10/R11) — smallest, highest-visibility (conversion).
2. **Competitor reframe** (Ri5 + R-3.x) — the largest rework; the reported cell.
3. **ETV magnitude drop** (Ri3/Ri4) — dashboard KPI + donut + rival cards.
4. **Precision/provenance** (Ri6 + demand/plan minors).
5. **Paid rubric activation** (O-4 fixtures) — the durable guard; must land with 1–4,
   not after.
