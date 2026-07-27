# ReachKit — Product Requirements (living)

> **What this document is.** The single definition of how ReachKit is required to behave, written to be read and edited by the owner. It answers "what should the product do?" — `CLAUDE.md` answers "what are the rules for changing it?" and `docs/architecture.md` answers "how is it built?". When these disagree, THIS document states the intent and the disagreement is a bug in one of them — raise it, never silently reconcile.
>
> **How it is maintained.**
>
> - **The owner edits freely.** An owner edit here IS a requirement change: the next agent touching that area must reconcile code to this doc or raise the conflict (Feedback Protocol).
> - **Agents edit via the Requirement Intake Protocol** (`CLAUDE.md`): a new requirement gets an intake doc (`docs/superpowers/intakes/`), and the section of THIS file it touches is updated in the same PR — the doc and the product may never drift apart knowingly.
> - **Open decisions are pushed to the owner.** Anything an agent cannot decide is recorded as an `OPEN(O-n)` item in §0 with an **Owner answer** field. You write your answer in that field; an agent then writes it into the referenced `R-x.y` requirement and moves the item to §0.1 Resolved (see §0's own instructions). Agents must not resolve an OPEN item silently; until you answer, the stated default applies.
> - Requirement IDs (`R-x.y`) are stable — never renumber; retire with ~~strikethrough~~ and a dated reason.

---



## 0. Open decisions for the owner (the push-list)

> **How to use this section.** Each decision has an **Owner answer** field. Write your answer there in your own words (replace the `_(unanswered)_` placeholder). That's all you need to do — the field is the durable record of your intent.
>
> **What happens after you answer.** On the next pass, an agent (or you) does three things in one commit, per the Change + Feedback Protocols: (1) writes your answer into the referenced `R-x.y` requirement so the product spec reflects it, (2) makes any code/guard change the answer implies, and (3) moves the decision down to **§0.1 Resolved** with the date and a one-line outcome. Until you answer, the **Default** applies — the product already behaves that way, so nothing is blocked.
>
> A half-answer is fine: write what you've decided, leave a follow-up question in the field, and it stays open. Never delete a decision — resolve it into §0.1 so the history survives.



### OPEN(O-1) — Review coverage vs attribution tradeoff

- **Decision:** WS-A v3 drops genuine name-only review snippets (a G2 page that never writes `stripe.com`). Accept the coverage loss permanently, or invest in a verification step (e.g. fetching the platform page's vendor-website field)?
- **Where it bites:** §7 R-7.3
- **Default until answered:** Keep v3 (drop) — honesty over coverage.
- **Owner answer:** *( Keep v3 unless you see critical risk in not fixing this )*



### OPEN(O-2) — Explicit off-topic examples

- **Decision:** Adult/explicit keywords are curated out of *named* examples (`lib/scan/explicit-terms.ts`); percentages still count them. Is the term list right? Should other categories (violence, slurs) join it?
- **Where it bites:** §3 R-3.9
- **Default until answered:** Current narrow adult-terms list.
- **Owner answer:** *(Yes, this is good enough for now)*



### OPEN(O-3) — x.com brand-zero (Part C)

- **Decision:** The SPA-fetch escalation is in flight on `feat/part-c-fetch-escalation`. When it lands, re-capture the x.com + reachkit.app corpus fixtures and tighten expectations. Confirm this is the intended follow-up (or redirect).
- **Where it bites:** §3 R-3.4
- **Default until answered:** Fixtures pinned as-is with explanatory notes.
- **Owner answer:** *(unanswered)*



### OPEN(O-4) — Paid corpus activation (two one-command captures, zero spend)

- **Decision:** To extend the paid-surface rubric beyond the hero to the market blob + intel blocks, two verbatim captures are needed (both zero-spend, prod Supabase creds required — agent hand-transcription was attempted and abandoned, the md5 gate caught a corruption). Run them, or leave the paid rubric at hero-only for now?
  - (a) `pnpm capture:report 35e30a99-b26b-43c9-8d94-d3340ac9f096 --archetype=normal-saas` — freezes the cardpointers tier=full payload.
  - (b) an intel-cache capture for reachkit.app (its `funnel2:` / `content-intel:` cache rows are warm).
- **Where it bites:** §6 R-6.6
- **Default until answered:** Hero rubric runs on free fixtures now; the intel-blocks half awaits capture.
- **Owner answer:** *(unanswered)*



### OPEN(O-5) — `audienceProxy` is always 0

- **Decision:** The creator-reach proxy is a placeholder (the YouTube 2nd `videos.list` call is never made). Build it, or remove the field and its render? "Never pay for data you don't render" cuts both ways.
- **Where it bites:** §6 R-6.4
- ~~**Default until answered:** Placeholder stands, documented.~~
- **RESOLVED(2026-07-21) → §0.1** — cut with the creators pass (O-8); the field is removed, not built.



### OPEN(O-6) — Cardpointers cleanup

- **Decision:** The leaked third-party URL may still sit in a prod user's `app_ids` (owner TODO from 2026-07-18). Confirm it's removed, or ask an agent to verify + purge.
- **Where it bites:** §8 R-8.5
- **Default until answered:** Unverified.
- **Owner answer:** *(unanswered)*



### 0.1 Resolved decisions

- **RESOLVED(O-7, 2026-07-21)** — Cut reviews from BOTH tiers. Owner: "we cut reviews from the paid scan and from the free scan." `reviewThemes`/`strengthsAndWeaknesses` and their gathering are removed; the invented-reviews grounding-risk surface goes with them (invariant #11 machinery stays for what remains). → R-6.1, R-7.3.
- **RESOLVED(O-8, 2026-07-21)** — Cut the creators pass. Owner: "we can also cut this… not something we're showcasing on the paid scans." `find-creators` + `audienceProxy` + the creators render are removed (subsumes O-5). → R-6.1, R-6.4.
- **RESOLVED(O-9, 2026-07-21)** — Content-intel kept ONLY where it feeds the action plan. Owner: "typically only used for lessons/action surfaced for the action plan that the user actually creates." Everything else cut. → R-6.2.
- **RESOLVED(O-10, 2026-07-21)** — Cloud-only Supabase. Owner: "definitely something we need to go towards, so delete all local supabase implementation." Dev + integration move to cloud; the local CLI stack is retired. Isolation approach for shared-DB integration tests to be settled during execution. → §11 R-11.6.
- **RESOLVED(O-5, 2026-07-21)** — folded into O-8: `audienceProxy` is removed with the creators pass, not built.

---



## 1. Product thesis

- **R-1.1** ReachKit scans a product's site/store URL, scores how *findable* it is, and returns a ranked, evidence-grounded plan of fixes. One number (the Discoverability Score), one plan, no dashboard sprawl.
- **R-1.2** The buyer is a solo founder / small SaaS team without an SEO budget. Every surface must be readable by a non-specialist in one pass.
- **R-1.3** The core promise is **honesty**: every claim on any surface is grounded in evidence we actually gathered. Degrade, never invent. This is a product requirement, not a style preference — the marketing hero says "Every claim grounded in your live page" and the product must never contradict its own hero.
- **R-1.4** The user-facing processes stay **simple**: one entry point per intent, one path, no per-tier/per-product special-casing (owner rule 2026-07-17). A fix that needs a new special case signals the process itself is wrong.

**The product contract** (owner spec, 2026-07-21 — the filter every pipeline step, data call, and rendered section must pass; data that serves no contract line gets deleted):

- **R-1.5** The **free scan** exists to deliver immediate wow that drives upgrade. It answers exactly four things: (1) what your **category** is, (2) what your **niche** is, (3) where you **stand vs your industry**, (4) **three actions** to improve your standing in your niche/category. The free pipeline gathers ONLY the data these four require — anything else (e.g. review collection) is removed from the free path.
- **R-1.6** The **paid deep scan** (the weekly big scan) shows what competitors are doing: (1) who your **referrers** are, (2) who your **competitors' top referrers** are and the **lessons** to take from them, (3) who your **potential customers** are, **which communities** they sit in, and where you can go to work with / hear from / learn from them. Data irrelevant to these is removed (open cuts: §0 O-7/O-8/O-9).
- **R-1.7** **No LLM-generated sentences render in the UI.** LLMs synthesize the dynamics; every surface shows simple words, labels, and numbers — never prose paragraphs. (Product-wide extension of the free-board terseness gate.)
- **R-1.8** **Data-driven, not word-driven** (owner rule, 2026-07-23 — the positive half of R-1.7). ReachKit is a data application: gaps, trends, and performance are shown with **the data itself — bars, gauges, sparklines, deltas, positions, counts** — never a paragraph describing them. When a surface has a choice between a sentence and a chart/number, it uses the chart/number. Generated text is reduced to labels, not explanations. Every UI change (marketing, free report, paid app) is reflected 1:1 in Claude Design (`ds-src` mirrors) in the same change so the design system and the product never disagree. This binds every phase of the launch build.



## 2. Tiers, pricing & entitlements

- **R-2.1** Three tiers: `free`, `solo` (€59/mo, €590/yr), `growth` (€129/mo, €1,290/yr). Annual = 10× monthly (two months free). EUR only. Source of truth: `lib/billing/pricing.ts`; Stripe prices must match (`pnpm check:live`).
- **R-2.2** Entitlements: free = 1 tracked app, no refresh, no drafts, no rank tracking · solo = 1 app, weekly refresh, 20 drafts/refresh, rank depth 20 · growth = 3 apps, weekly refresh, 100 drafts, depth 50 (`lib/billing/tiers.ts` `TIER_LIMITS`).
- **R-2.3** There is **no trial**: checkout charges immediately. `past_due` keeps access within a grace window (recoverable failed charge ≠ instant lockout).
- **R-2.4** Every cost-bearing API route calls `assertPaid` before any gather — the UI paywall never protects an API (invariant 5b; guard `app/api/entitlement-gates.test.ts`).
- **R-2.5** The free report is redacted, never absent: 3 preview actions (drafts nulled), analysis sections visible, deep sections teaser-locked with true counts ("show the total, render a fraction").



## 3. The free scan (the conversion surface)

**Entry & tier**

- **R-3.1** The public scan box (`/api/scan`) is a free preview for **every** viewer — anonymous, logged-in, or paid. Surface-driven, never viewer-driven: it never deepens, never enrols the URL (invariant #12; the cardpointers-leak class). Deep scans and tracking happen only via `/app/add` and post-checkout provisioning.
- **R-3.2** Abuse: 10 scans / IP-hash / hour, 15-minute in-flight window; only the hash is stored.
- **R-3.3** A free scan must complete in well under a minute (live-verified 23–43s) and cost ≤ ~20¢ (budget `FREE_SCAN_BUDGET_CENTS`; external soft cap 25¢ tier-derived per step).

**What the free report must show** (the six-stage wow flow, PRs #109–#113)

- **R-3.4** The headline gauge is the **unified Discoverability Score v5** = geometric mean of on-page readiness × search presence, computed identically free and paid — the number **never moves on upgrade** (invariant #1). Both drivers render as bars; the weaker driver is named ("X is your gap") and must actually be the weaker one.
- **R-3.5** Identity: the site's own self-description renders above the headline (truncated with a real ellipsis only when actually cut).
- **R-3.6** Category demand is **data-grounded and reconcilable**: the headline demand number equals the sum of its rendered phrase chips (G4); the market ladder shows at most BROAD (only when genuinely bigger than the category) and NICHE rungs, each reconciling to its phrases (R6, G10). No invented volumes — when a data call flakes, degrade to the zero-state, never fabricate.
- **R-3.7** Wins render alongside gaps: top-3 rankings as a wins strip with an honest "+N more" disclosure when the sentence count exceeds the chips.
- **R-3.8** Classification is honest at render: no mega-brand/entity is ever "your category" or "your biggest opportunity"; incidental noise (timezone lookups) never becomes category; the subject's own sub-brands are never off-topic (macro rule + classification corpus).
- **R-3.9** Off-topic examples are named concretely — but explicit/adult terms never render as *named* examples (`lib/scan/explicit-terms.ts`); percentages still count every keyword. `OPEN(O-2)`.
- **R-3.10** ~~Rivalry has both states: discovered rival names render free (per-rival intel is the paid tease)~~ **SUPERSEDED (2026-07-21, Phase S + the product contract R-1.5):** competitor discovery is OFF the free contract — a free scan no longer discovers or renders rivals. The free "standing vs your industry" story is the market model (R-3.14: market size + your share), not a rival list. Rivalry (names + per-rival intel) is a paid capability; competitors are discovered at deepen time. A paid scan that has no rivals still renders the honest degrade tease, never invented names.
- **R-3.11** Every number ≥10 on the report derives from the payload (no aliases, no fetch-limits-as-totals, no literals); teaser counts equal the collection their section renders and are never 0; empty inputs render no section; comparative copy renders only when true. Machine-enforced by rubric R1–R6 over the report corpus, every build.
- **R-3.12** Old persisted reports must always render: every consumer of `report_payload` null-coalesces new fields; legacy shapes (pre-ladder, retired aliases, `medium` rungs, inverted broad rungs) render cleanly with the retired parts filtered at the props boundary.
- **R-3.13** One tease vocabulary across the report: free states what's true; paid unlocks what rivals do about it. Locked counts always come from the real collection.

**The market model + free floor** (owner decisions D1–D4, 2026-07-21 — approved, build in flight):

- **R-3.14** The category/niche cards show **market size + your share**: market-level demand measured from the MARKET itself (site-independent, real DataForSEO volumes — big when the market is big), with the subject's position/share rendered beside it. The gap between them is the pitch. A market number's basis is disclosed (e.g. "sized from <leader>'s rankings"). Never an ETV percentage share (G1 class).
- **R-3.15** To ground market size, a free scan may make **ONE category-leader `ranked_keywords` fetch** (~2¢, within the 25¢ cap, per-domain cached). This amends the 2026-07-17 "no rival fetch on free" rule; per-rival gap analysis and rival intel remain paid-only (R-3.10 unchanged). Thin/failed leader data degrades to seed-basket volumes — never fabricates.
- **R-3.16** Category/niche **relevance and labels** are judged by an LLM relevance pass over REAL keywords (classification, never generation — all volumes stay DataForSEO); deterministic token heuristics remain as pre-filter and structural veto. The score-side footprint classifier stays deterministic and frozen (invariant #1).
- **R-3.17** The free report always shows **3 real ranked fixes** (deterministic floor — `FREE_MIN_ACTIONS=3`), plus blurred locked placeholder rows that carry no numbers and no fabricated specifics (zero LLM spend on placeholders).
- **R-3.18** The onboarding competitor picker's size bands (Your size / A bit bigger / Much bigger / Biggest) **reuse the competitor traffic the deep scan already fetched** (`report_payload.market.cohort` — the market pass's per-rival `domain_rank_overview`), never a second fetch. A scan-seeded candidate whose domain the scan profiled gets a real `sizeTier`; one it didn't gets no tier (never fabricated); a free/not-yet-deepened scan shows the degraded seed. This closes the "paid-then-discarded" sizing seam (the deep scan paid for it; the picker ignored it) — intake `2026-07-27-competitor-picker-sizing-reuse`. The picker's cold-path `bulk_traffic_estimation` re-fetch for overlapping domains is the named follow-up. Guard: `app/api/competitors/candidates/sizing-reuse.test.ts`.
- **R-3.19** The competitor picker offers a **real choice**: the scan persists a candidate POOL of up to `SCAN_COMPETITOR_POOL=12` (not the selection max of 5), so the picker shows a ranked list to pick 5 from — never "5-of-5, all pre-checked". Widening the pool is **free** (the names were already extracted by SERP/Tavily/LLM discovery; the deep-scan market pass auto-discovers its own top-5 cohort independently, `cohort.ts`, so it never profiles the wider pool). Selection + deep analysis stay bounded to `MAX_SELECTED=5` (invariant #2 unchanged); size bands render only on the profiled overlap (R-3.18). Intake `2026-07-27-competitor-pool-width`. Guard: `lib/scan/competitors.test.ts`.



## 4. Conversion & checkout

- **R-4.1** Payment-first funnel: free report → unlock CTA (price stated up front: "€59/mo · cancel anytime" from the one pricing source) → Stripe Checkout → webhook creates/updates the account → magic-link email → `/app` dashboard.
- **R-4.2** Both upgrade paths (anonymous checkout and in-app upgrade) run the SAME provisioning policy — one policy, shared; drift between them is the class that once left in-app upgrades never deepening.
- **R-4.3** The public shared-report page (`/scan/<id>`) is reachable by anyone with the link, always free-redacted, and never branches on viewer entitlement. Paying users see their full report only in `/app` (guard: `no-scan-ejection` tripwire — no in-app surface may link to a `/scan` report).



## 5. Onboarding & the app shell

- **R-5.1** One onboarding path: add a product via `/app/add` (in-shell), which runs the deliberate deep-scan + tracking enrolment. Per-product setup (competitor selection) lives in `/app/add`, not a global first-run wizard.
- **R-5.2** Adding a product dedupes against a recent scan of the same URL via ONE policy (`resolveProductScan`, 14-day window) — never a second parallel dedupe rule.
- **R-5.3** Navigation lands on `/app/dashboard` directly (never a redirecting `/app` hop — the Connection-closed class).



## 6. The paid loop

- **R-6.1** A paid deep scan enriches the free scan with the contract's off-site intelligence (R-1.6): the competitor cohort (≤ `MAX_SELECTED=5` rivals), **referrer intelligence** (the user's referrers + competitors' top referrers + the lessons), keyword gap, and **customer communities** (demand pockets + where buyers talk). Deep-pass sentinel is `scans.deepened_at`. **CUT (2026-07-21, O-7/O-8):** reviews (`reviewThemes`/`strengthsAndWeaknesses`) and the creators pass (`find-creators`/`audienceProxy`) are off-contract and removed — neither is gathered or rendered.
- **R-6.2** The paid headline additions are the **Market Position grade** (off-site cohort strength — separate from, never blended into, the Discoverability Score) and the intel surfaces (`/app` dashboard + supply/demand/competitors/synthesis tabs). **Content-intel (O-9)** is kept ONLY where it feeds the user's action plan (lessons → content to create); the standalone content surfaces are cut.
- **R-6.3** The plan (`/app/plan`) is the singular action timeline: floored to `MIN_ACTIONS=5` with deterministic fixes; every active category keeps ≥1 surviving action after the §11 cap; every "+N pts" is the model-computed shortfall, never the LLM's free choice; observed deltas are the real gauge movement post-completion.
- **R-6.4** §11 outreach safety: cap 5 outreach cards, divergence 0.92, 1 action per evidence host, every draft `draftRequiresEdit=true` — nothing auto-sends.
- **R-6.4a** A generated draft is **always retained** (owner 2026-07-27): every "generate a draft" surface persists the draft **server-side** onto its `actions` row AS PART of generation, so it survives a refresh, a closed tab, or a dropped connection mid-generation — and on reload rehydrates as the tracked entry's draft. Content and distribution drafts share ONE path (`upsertDraftAction`, capability `draft-action-persist`): reuse a stored draft for free unless `regenerate` (which overwrites), never lose a completed draft even if the DB write blips (return it unsaved). The client shows an honest long-wait state ("up to a minute; saved automatically"), times out a stalled request, and distinguishes a connection failure from a server error. Guards: `lib/app/draft-action-store.test.ts` + the capability ledger.
- **R-6.5** Cadence: weekly refresh Monday 09:00 UTC (paid tiers), score pulse Thursday 09:00 UTC, cache cleanup daily 03:00. Trend lines reuse the persisted search-presence score so the score-over-time series never mixes scales.
- **R-6.6** The paid render surfaces obey the same number/section honesty as the free report. Machine coverage today: report-payload paid fixture through the shared-report path + hero/blocks render checks; full intel-cache corpus is `OPEN(O-4)`.



## 7. Honesty & grounding (product-level restatement of invariant #11)

- **R-7.1** No synthesized field asserts evidence we did not gather. Empty input sheet ⇒ empty field ⇒ section does not render. Never cache an empty/failed result; a grounding-policy bump invalidates every sheet cached under the older policy.
- **R-7.2** Generated prose (an LLM's or a search engine's `answer`) is never laundered into evidence.
- **R-7.3** Web reviews require **attribution**: a kept review result must reference the subject's own domain; a bare brand-name match is never attribution (WS-A v3 — the reachkit.ai class); the subject's own pages are never reviews. Accepted cost: genuine name-only snippets drop. `OPEN(O-1)`.
- **R-7.4** News/buzz keeps the weaker conflict-drop gate deliberately (aggregate counts, not rendered quotes); if a wrong-subject buzz incident ever ships, it tightens to R-7.3.
- **R-7.5** Competitors come only from the category-validated discovery set; a raw "alternatives" extract may enrich matching names, never add competitors.



## 8. Cost, caps & operational safety

- **R-8.1** Every cost-bearing call (LLM + DataForSEO + Tavily) is attributable to a scan and through it to a user. Nothing spends anonymously (invariant #2; ambient scan context).
- **R-8.2** Per-scan soft caps derive from the TIER via one seam (`externalCapCentsFor`): free 25¢ / paid 150¢ external; LLM cents free 20 / full 250 / weekly 120; 60 tool-calls. On breach: degrade and stamp `external_cap_hit_at`, never throw, never invent.
- **R-8.3** No data is fetched that no surface renders, per FIELD ("never pay for data you don't render"); enforced by the paid-data ledger (G9). Deleting a render deletes its call.
- **R-8.4** A pipeline failure always leaves a renderable `degraded` partial — never a permanently ACTIVE scan (invariant #9).
- **R-8.5** Production reads **zero product flags**; fixtures are a test-only injected seam; `SCANNING_ENABLED=false` is the ops kill switch. `OPEN(O-6)` (cardpointers residue).



## 9. Emails & notifications

- **R-9.1** The only user-facing email today is the post-checkout **magic-link** onboarding email (Resend). It must arrive even when Stripe webhook ordering races (the silently-skipped-magic-link class).
- **R-9.2** Any future recurring email (digest etc.) is a new requirement: intake doc first, and it joins this section before it ships.



## 10. Data, privacy & retention

- **R-10.1** Anonymous scan abuse tracking stores only an IP hash. Account deletion and export exist and are tested (`/app/settings`).
- **R-10.2** Public scan reports are permanent, public artifacts (the growth loop); scanning a site creates a public page for it by design — the gallery lists them.
- **R-10.3** RLS is enabled on user-facing tables; service-role access is server-only.



## 11. The development system itself (meta-requirements)

- **R-11.1** Requirements enter through the **Requirement Intake Protocol**: restatement, recorded clarifying questions, a permutation matrix (tier × auth × entry surface × data-state) with no blank cells, acceptance criteria written first, a class statement, and a rendered-surface ledger. Template: `docs/superpowers/templates/requirement-intake.md`.
- **R-11.2** Acceptance is corpus-first: expected outputs exist and fail before the implementation lands (report corpus + rubric; classification corpus; guard tests elsewhere). Ratchets only tighten.
- **R-11.3** Every new guard is proven to bite (mutation-proven) before it counts.
- **R-11.4** This document, `CLAUDE.md`, and `docs/architecture.md` are kept consistent in the same commit as the change that affects them (Change Protocol). The doc-rot tripwire asserts referenced files exist.
- **R-11.5** The owner always has a current view: `docs/architecture.md` (structure), this file (behavior), and the interactive process/ledger artifact (linked from `CLAUDE.md`).
- **R-11.6** **Cloud-only Supabase** (O-10, 2026-07-21): there is one Supabase — the cloud project. No local Supabase stack. Dev (`.env.local`) points at cloud; integration tests (`test:int`/`eval`) run against cloud with per-run isolation (a dedicated cloud test project or per-run schema, decided at execution). `capture:report` and `check:live` read cloud by default. Rationale: local added redundancy and confusion (a free scan captured against local couldn't see the prod scan) for no value.
- **R-11.7** **One capability, one implementation** (2026-07-21): every domain capability has a single canonical module, pinned in the capability ledger (`lib/testing/capability-ledger.test.ts`). A second definition of a registered symbol anywhere in `lib/` fails the build. This is the machine-checked form of R-1.4 (one path per use case) — prose alone never prevented a duplication; the ledger does.



## 12. The quality contract (owner-editable — the bar, and what enforces it)

> **What this is.** One table of the quality dimensions the product is held to, each with its **bar** (the owner's words) and its **gate** (the machine check, or `UNENFORCED` when there is none — the gap is named, never silent). The owner edits the bar; an agent then makes the gate match. This exists because before it, only *honesty* had a durable home — so magnitude/simplicity/wow feedback took a whole session to land, each time reinvented. (2026-07-21.)

| Dimension | The bar | Gate |
|---|---|---|
| **Honesty** | Every number derives from the payload; empty input ⇒ no section; comparative copy only when true. | Rubric R1–R7, G1–G10, classification corpus. |
| **Magnitude / credibility** | A number shown as a hero must be *credible*, not merely honest: a tiny or hollow market/category number degrades to its zero-state rather than standing alone as the headline (the trustmrr "10 searches/mo" class). | Rubric **R9** (report corpus). |
| **Terseness** | No LLM-generated sentences in the UI — labels + minor keywords + numbers only (R-1.7). | Rubric **R8** (free board); paid surfaces `UNENFORCED` until the paid corpus lands (Phase E / O-4). |
| **Data-driven representation** | Gaps/trends/performance shown as data — bars, gauges, sparklines, deltas, positions, counts — never a paragraph describing them; a surface with a sentence-vs-chart choice uses the chart (R-1.8). Every UI change mirrored 1:1 in Claude Design. | Rubric R8 (terseness proxy) + `check:design` (DS parity); a positive "prefer-viz" check is `UNENFORCED` (design-review judgment) — revisit if a live-review failure proves mechanically checkable. |
| **One path per use case** | One entry point, one path, no per-tier/per-product special-casing (R-1.4); one implementation per capability (R-11.7). | Capability ledger + dep-cruiser capability-owner rules. |
| **Contract fit — data↔UI alignment** | Every data point pulled is *showcased* and calculated efficiently; every rendered element maps to real data (owner, 2026-07-21). Nothing fetched-but-hidden; nothing rendered-but-fabricated. | G9 (per-wrapper: no wrapper without a consumer) + R2 (per-number: no render without a basis). **Per-FIELD `UNENFORCED`** — "fetch 50, show 8" is still un-gated (CLAUDE.md open risk); the field-level sweep is the next ratchet. |
| **One-glance comprehension** | A non-specialist reads any surface in one pass (R-1.2). | `UNENFORCED` (prose bar; no deterministic check exists — revisit only if a live-review failure proves mechanically checkable). |
| **UI standards** | Tokens only, mobile-clean at 390/360px, design-parity with the DS. | `check:design`, `test:mobile`, ESLint. |
| **Score calibration** | Bands separate on live data (no SPA-fetch false-lows, no tidy-page false-100s). | `UNENFORCED` — the one red rule; `scripts/score-calibration.mts` is a live tool, not CI. |

