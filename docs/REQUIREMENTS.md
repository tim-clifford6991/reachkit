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
- **Default until answered:** Placeholder stands, documented.
- **Owner answer:** *(unanswered)*



### OPEN(O-6) — Cardpointers cleanup

- **Decision:** The leaked third-party URL may still sit in a prod user's `app_ids` (owner TODO from 2026-07-18). Confirm it's removed, or ask an agent to verify + purge.
- **Where it bites:** §8 R-8.5
- **Default until answered:** Unverified.
- **Owner answer:** *(unanswered)*



### OPEN(O-7) — Reviews on the paid scan

- **Decision:** The product contract (R-1.6) does not include review themes. Cut `reviewThemes`/`strengthsAndWeaknesses` and their gathering from the paid scan entirely (this also deletes the highest grounding-risk surface — the invented-reviews class), or keep them as a secondary paid section?
- **Where it bites:** §6 R-6.1, §7 R-7.3
- **Default until answered:** Proposed CUT — reviews already removed from the free path (R-1.5); paid gathering stays until you confirm.
- **Owner answer:** *(unanswered)*



### OPEN(O-8) — Creators pass

- **Decision:** The contract (R-1.6) centers referrers + customer communities. The creators pass (`find-creators`, `audienceProxy` — a known always-0 placeholder, see O-5) is off-contract. Cut the pass and its render, or keep and finish it?
- **Where it bites:** §6 R-6.1/R-6.4
- **Default until answered:** Proposed CUT (subsumes O-5's question).
- **Owner answer:** *(unanswered)*



### OPEN(O-9) — Content-intel scope

- **Decision:** Content-intel / content drafts are off the contract's three paid lines unless they feed the lessons/actions surfaces. Keep only what feeds actions ("lessons from competitor referrers" → content to create), or cut entirely?
- **Where it bites:** §6 R-6.2
- **Default until answered:** Proposed KEEP-where-it-feeds-actions, cut the rest.
- **Owner answer:** *(unanswered)*



### OPEN(O-10) — Retire local Supabase (cloud-only dev/test)

- **Decision:** (Owner ruling 2026-07-21) "Local supabase may also be causing confusion and adding no value — we can simply do everything in supabase cloud, in production to avoid redundancy." Two things read local today: `.env.local` (`SUPABASE_URL=http://127.0.0.1:54321`) and the CI `eval-integration`/`test:int` jobs (spin up a local Supabase via the CLI). This session hit the friction directly — `pnpm capture:report` defaulted to local and could not see the prod scan. Move dev + integration tests to a cloud project (prod or a dedicated cloud test project), retire the local-CLI stack?
- **Where it bites:** §11 (dev system); `pnpm test:int` / `pnpm eval` CI jobs; `capture:report` + `check:live` credential sourcing.
- **Default until answered:** Proposed CUT local — point `.env.local` and CI at cloud; `capture:report` reads cloud by default. Caveat to weigh before executing: integration tests mutating a shared cloud DB need isolation (a dedicated cloud test project or per-run schema), and cloud round-trips are slower than the local stack — so the swap is a small program, not a one-liner. Until decided, local stays.
- **Owner answer:** *(leaning yes — confirm the isolation approach: dedicated cloud test project vs prod)*



### 0.1 Resolved decisions

*None yet. When a decision above is answered and written into its* `R-x.y` *requirement, it moves here as:* `RESOLVED(O-n, YYYY-MM-DD) — <one-line outcome> → R-x.y`*.*

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
- **R-3.10** Rivalry has both states: discovered rival names render free (per-rival intel is the paid tease); zero rivals renders the honest degrade tease, never silence, never invented names.
- **R-3.11** Every number ≥10 on the report derives from the payload (no aliases, no fetch-limits-as-totals, no literals); teaser counts equal the collection their section renders and are never 0; empty inputs render no section; comparative copy renders only when true. Machine-enforced by rubric R1–R6 over the report corpus, every build.
- **R-3.12** Old persisted reports must always render: every consumer of `report_payload` null-coalesces new fields; legacy shapes (pre-ladder, retired aliases, `medium` rungs, inverted broad rungs) render cleanly with the retired parts filtered at the props boundary.
- **R-3.13** One tease vocabulary across the report: free states what's true; paid unlocks what rivals do about it. Locked counts always come from the real collection.

**The market model + free floor** (owner decisions D1–D4, 2026-07-21 — approved, build in flight):

- **R-3.14** The category/niche cards show **market size + your share**: market-level demand measured from the MARKET itself (site-independent, real DataForSEO volumes — big when the market is big), with the subject's position/share rendered beside it. The gap between them is the pitch. A market number's basis is disclosed (e.g. "sized from <leader>'s rankings"). Never an ETV percentage share (G1 class).
- **R-3.15** To ground market size, a free scan may make **ONE category-leader `ranked_keywords` fetch** (~2¢, within the 25¢ cap, per-domain cached). This amends the 2026-07-17 "no rival fetch on free" rule; per-rival gap analysis and rival intel remain paid-only (R-3.10 unchanged). Thin/failed leader data degrades to seed-basket volumes — never fabricates.
- **R-3.16** Category/niche **relevance and labels** are judged by an LLM relevance pass over REAL keywords (classification, never generation — all volumes stay DataForSEO); deterministic token heuristics remain as pre-filter and structural veto. The score-side footprint classifier stays deterministic and frozen (invariant #1).
- **R-3.17** The free report always shows **3 real ranked fixes** (deterministic floor — `FREE_MIN_ACTIONS=3`), plus blurred locked placeholder rows that carry no numbers and no fabricated specifics (zero LLM spend on placeholders).



## 4. Conversion & checkout

- **R-4.1** Payment-first funnel: free report → unlock CTA (price stated up front: "€59/mo · cancel anytime" from the one pricing source) → Stripe Checkout → webhook creates/updates the account → magic-link email → `/app` dashboard.
- **R-4.2** Both upgrade paths (anonymous checkout and in-app upgrade) run the SAME provisioning policy — one policy, shared; drift between them is the class that once left in-app upgrades never deepening.
- **R-4.3** The public shared-report page (`/scan/<id>`) is reachable by anyone with the link, always free-redacted, and never branches on viewer entitlement. Paying users see their full report only in `/app` (guard: `no-scan-ejection` tripwire — no in-app surface may link to a `/scan` report).



## 5. Onboarding & the app shell

- **R-5.1** One onboarding path: add a product via `/app/add` (in-shell), which runs the deliberate deep-scan + tracking enrolment. Per-product setup (competitor selection) lives in `/app/add`, not a global first-run wizard.
- **R-5.2** Adding a product dedupes against a recent scan of the same URL via ONE policy (`resolveProductScan`, 14-day window) — never a second parallel dedupe rule.
- **R-5.3** Navigation lands on `/app/dashboard` directly (never a redirecting `/app` hop — the Connection-closed class).



## 6. The paid loop

- **R-6.1** A paid deep scan enriches the free scan with off-site signals: competitor cohort (≤ `MAX_SELECTED=5` rivals), keyword gap, market analysis, communities, creators. Deep-pass sentinel is `scans.deepened_at`.
- **R-6.2** The paid headline additions are the **Market Position grade** (off-site cohort strength — separate from, never blended into, the Discoverability Score) and the intel surfaces (`/app` dashboard + supply/demand/competitors/audience/synthesis tabs).
- **R-6.3** The plan (`/app/plan`) is the singular action timeline: floored to `MIN_ACTIONS=5` with deterministic fixes; every active category keeps ≥1 surviving action after the §11 cap; every "+N pts" is the model-computed shortfall, never the LLM's free choice; observed deltas are the real gauge movement post-completion.
- **R-6.4** §11 outreach safety: cap 5 outreach cards, divergence 0.92, 1 action per evidence host, every draft `draftRequiresEdit=true` — nothing auto-sends. (`audienceProxy` placeholder: `OPEN(O-5)`.)
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

