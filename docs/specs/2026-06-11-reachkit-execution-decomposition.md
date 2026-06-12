# ReachKit — Execution Decomposition (Plan-of-Plans)

**Status:** Approved 2026-06-11 — master sequencing doc for the ReachKit build
**Owner:** Tim
**Source of truth:** `REACHKIT_SPEC_V2.md` (GTM Brain Product Specification v2.3). This doc *sequences* that spec; it does not restate or override it. Where they differ, the spec wins and this doc is corrected.
**Naming:** The product is **ReachKit** everywhere (package, UI, docs, domain). The spec's working title "GTM Brain" is historical; treat every "GTM Brain" in the spec as "ReachKit". (Resolves spec §19 open question #6.)

---

## 0. How to use this document

The ReachKit MVP is too large for one implementation plan. It is built as **seven cycles**, each its own `spec → implementation plan → build` loop ending in a **deployable increment** behind an **acceptance gate**. This document is the index and the sequencing contract:

- **Cycle 0** is shared foundation (an explicit extraction from the spec's Phase 1 scaffold).
- **Cycles 1–5** map 1:1 to spec §17 Phases 1–5 (the MVP).
- **Cycle 6** is spec §17 Phase 6 (v1.5) — listed for continuity, out of MVP scope.

Each cycle's own spec + plan is written **just before that cycle starts**, not all up front — so later plans absorb what earlier cycles actually learned (cost telemetry, golden-set scores, source-empiricism results). The spec's **Phase 1 spans two cycles** here (Foundation + Scan skeleton); both are delivered as focused plans. **Written now:** `docs/plans/2026-06-11-phase-1a-foundation.md` (Cycle 0 — the first build step). **Next:** `docs/plans/2026-06-11-phase-1b-scan-skeleton.md` (Cycle 1), written against the concrete interfaces Foundation establishes. Cycles 2–5 are planned just-in-time at the start of each.

Spec section references (e.g. `§5.7`, `§9.2`) point into `REACHKIT_SPEC_V2.md` and are the authoritative detail for any work item named here.

---

## 1. Principles (load-bearing — enforced in every cycle)

These are the spec's non-negotiables, lifted here as build filters. Every plan and every PR is checked against them.

1. **Scan-first PLG.** The free scan ships and goes public (end of Cycle 2) *before* any paid code. (D21; spec change #1 — v1's "infra first" is explicitly rejected.)
2. **Foundations thin, not infra-heavy.** Build only the warehouse/pipeline surface a cycle needs; no speculative infra.
3. **Evidence-grounded or it doesn't ship.** Every customer-facing claim links to resolvable evidence; the Critic Gate (§9.2) enforces it from Cycle 3.
4. **90%+ gross margin is a hard constraint** (§13). `pipeline_runs` cost telemetry is live from Cycle 0; per-scan budget caps are enforced in code; Sonnet never reads raw text (fact sheets only).
5. **No auto-posting / auto-sending / auto-submitting, ever** (§11). Every action is founder-executed; drafts require an edit event before copy activates.
6. **Four-question acceptance rule** (§5.6). Every customer-facing UI addition must answer *What you offer / Who it's for / Where they are / What to do this week*, or move the Score — else it doesn't ship. The 7 categories (§6) stay internal.
7. **Per-scan source empiricism** (§6). No source has fixed authority; each scan measures signal density per source and drops thin sources, surfacing which sources fed the analysis.
8. **TDD + golden-set evals.** Pipeline logic, adapters, scoring, and the Critic Gate are test-first. The 5 analyses are regression fixtures; quality is scored pre-deploy from Cycle 3 (R1 mitigation).
9. **Honest degradation, never silent padding** (§9.1 fallback). After 3 Critic rejections, ship labeled "lower confidence" output — never fabricated filler.

---

## 2. Cycle map

| Cycle | §17 | Goal | Depends on | Acceptance gate |
|---|---|---|---|---|
| **0 · Foundation** | (from P1) | Repo + DB + jobs + telemetry standing | — | App deploys; migrations apply; no-op Inngest run writes a `pipeline_runs` row; pgvector query returns |
| **1 · Scan skeleton** | P1 | Paste URL → live data-pull → facts | 0 | Facts screen <10s p95; fixtures GTM Brain + Nudgi (web), Sofa (app); every fetch in `raw_documents` |
| **2 · Findings + gate** | P2 | Preliminary insight + email capture | 1 | Findings <120s p95; gate conversion measurable → **free scan ships publicly** |
| **3 · Full scan + Critic** | P3 | Quality-gated full report | 2 | Golden-set mean ≥ threshold; full scan <30min; cost/scan logged within target |
| **4 · Paid loop** | P4 | Weekly engine + monetization | 3 | Paying user gets a Monday queue, every card passes Critic v2; badges render on X/Reddit |
| **5 · Hardening + launch** | P5 | Survive public launch | 4 | Free scan survives launch traffic; Phase 0 conversion criteria re-measured at scale |
| **6 · v1.5** | P6 | Post-revenue expansion | 5 | *Out of MVP scope — see §3.7* |

**Critical path:** 0 → 1 → 2 → 3 → 4 → 5. The public free-scan launch is at the **end of Cycle 2**; paid launch at the **end of Cycle 4**.

---

## 3. Per-cycle detail

Each cycle below lists its **work packages**, the **new tools/tables** it introduces, **key spec refs**, and the **decisions/risks** it touches. The cycle's own spec + plan expand these into test-first steps.

### 3.0 Cycle 0 — Foundation

**Goal:** every shared surface the scan needs, standing and observable, with zero product logic.

**Work packages**
- **Repo & tooling:** Next.js 16 (App Router, Turbopack, Cache Components) · React 19.2 + React Compiler · TypeScript strict · Tailwind v4 (`@theme` tokens) · shadcn/ui generated on **Base UI** · Geist fonts · ESLint/Prettier/typecheck · CI with per-route-group bundle-size budgets (§20.4) · repo layout per §21.4.
- **Database (Supabase):** core data model (§5.4) + warehouse layers 1–3 (§5.7: `raw_documents`, `fact_sheets`, `outcomes`, `pipeline_runs`, `monitors.watermark`) · RLS policies · **magic-link Auth only** (D42) · **pgvector** extension + HNSW indexes (embedding model+version per row) · Storage buckets for blobs (HTML snapshots, screenshots, OG images).
- **Jobs:** Inngest durable-function harness (scan pipeline = multi-step function); a no-op `scan.demo` function proving the path end-to-end.
- **Cross-cutting libs:** typed config/secrets module (Anthropic, DataForSEO, Tavily, Resend, Stripe, PostHog) · `lib/seo.ts` (metadata + JSON-LD factory) · `lib/analytics.ts` (PostHog) · `lib/flags.ts` · **cost-telemetry writer** (every external/LLM call appends a `pipeline_runs` row) · **tool-registry interface** skeleton (§9.4 — 10 named tools, classes D/L, budgets) with no implementations yet.
- **Deploy:** Vercel project (preview + prod); PostHog wired; env validated.

**New tables:** all of §5.4 + §5.7. **New tools:** registry interface only (no bodies).
**Key refs:** §5.3, §5.4, §5.7, §20, §21.4. **Risks touched:** R12 (cache TTL fields present from the start), margin telemetry (R9).
**Acceptance:** app deploys to Vercel; migrations apply cleanly; `scan.demo` Inngest run writes a `pipeline_runs` row; a pgvector similarity query returns; CI green incl. bundle budgets.

### 3.1 Cycle 1 — Scan skeleton (spec Phase 1)

**Goal:** paste any App Store or website URL → live data-pull feed <10s → preliminary facts (facts, not claims — the horoscope rule, §5.1).

**Work packages**
- **Input router** (§5.2): URL pattern → `platform ∈ {ios, android, web}` → adapter set (§4.1).
- **Stage 0 COLLECT** (§9.1, no LLM): parallel fetch per mode — app (iTunes Search, review RSS, DataForSEO app data) · web (site fetch/Tavily, Trustpilot + Product Hunt via DataForSEO, SERP "alternatives") · shared (≤5 SERP, Tavily×3) → rows in `raw_documents` (content-hash dedupe) + `evidence`.
- **Tool registry — D-class bodies** (§9.4): the four the <10s facts path needs — `get_listing`, `get_reviews`, `find_competitors`, `search_web` — typed, each attaching `evidence_ids`, logging a `pipeline_runs` row, respecting per-scan budget caps. (`search_keywords`, `find_communities`, `find_creators` fetch data for LLM *findings*, not facts, so they land in Cycle 2 with the full collect.)
- **Competitor auto-discovery** first pass (§5.2): ranked candidate list with `source` per entry (confirm UI deferred to Cycle 3).
- **Streaming UI:** `POST /api/scan` (anonymous allowed) · `GET /api/scan/:id/stream` (SSE) → the 0–10s "working" screen with the live data-pull feed → the preliminary facts screen (category, top-5 competitors, review volume/trend or web traffic-proxy, word-level review themes).
- **Web-mode traffic proxy** (resolves §19 #7): default composite = SERP-result count + PH upvotes + domain/Wayback age; confirmed in this cycle's spec.

**New tools:** the 7 D-class collectors. **Key refs:** §4.1, §5.1, §5.2, §5.5, §9.1 (Stage 0), §9.4.
**Decisions:** locks §19 #7. **Risks touched:** R5 (Tier-C garnish-only, graceful degrade), R11 (web-mode evidence thinness — proxy + labeling).
**Acceptance:** facts screen <10s p95 for the three fixtures (GTM Brain, Nudgi — web; Sofa — app); every fetch landed in `raw_documents`; `pipeline_runs` populated per call.

### 3.2 Cycle 2 — Instant findings + email gate (spec Phase 2)

**Goal:** a credible 2-minute preview that converts to an email — then **ship the free scan publicly**.

**Work packages**
- **Remaining D-tools** carried from Cycle 1: `search_keywords` (DataForSEO Keywords Data), `find_communities` (HN Algolia / Bluesky / SERP), `find_creators` (YouTube Data API / SERP) — the full collect that feeds findings.
- **Stage 1 EXTRACT** (Haiku 4.5): per-source structured extraction → typed facts → `fact_sheets` (shared, TTL'd).
- **Stage 2 SYNTH (minimal)** (one Sonnet 4.6 call over fact sheets only): preliminary Discoverability Score, positioning mirror, 3 evidence-linked findings, 1 blurred sample action card.
- **Email gate:** `POST /api/scan/:id/claim` {email} → Resend magic link → **silent account creation** (D42). **Auth contract (established by Cycle 0 RLS, Task 8):** the signup handler MUST set `public.users.id = auth.uid()` (insert the profile row with the auth user's id, or add an `auth.users` → `public.users` trigger). Every owner RLS policy is predicated on `users.id = auth.uid()`; a mismatched/auto-`gen_random_uuid()` id makes every authenticated dashboard return empty. Also: Cycle 0 left `competitors`/`monitors`/`score_snapshots`/`outcomes` RLS-on but service-role-only — add owner-read policies when the dashboard first surfaces them.
- **Funnel moments 1–4** (§23): scan theater (SSE artifacts, Motion stagger) · partial reveal with Score count-up (NumberTicker + radial sweep — the signature moment, §20.3) · blur-locked sections **with real headlines** · single-field email gate.
- **Instrumentation:** PostHog funnel events (land → scan start → completion → reveal → gate view → conversion) — these ARE the §14 Phase 0 numbers measured live.

**New tables in use:** `fact_sheets`, `findings`, `users`. **Key refs:** §5.1 (90–120s), §9.1 (Stages 1–2), §10.1, §23 moments 1–4, §20.3.
**Decisions:** uses score weights (§19 #2) as config; landing theme dark-first (§19 #9).
**Acceptance:** URL → findings <120s p95; gate conversion measurable. **→ Public ship + waitlist invites.**

### 3.3 Cycle 3 — Full scan + Critic Gate + evals (spec Phase 3)

**Goal:** the full four-question report at the frontier-quality bar, gated by the Critic and the golden set. This cycle owns risk **R1**.

**Work packages**
- **Full Stage 0–4 pipeline** (§9.1): over-generate candidate actions 2–3× in Synth.
- **Stage 3 CRITIC — Critic Gate v2** (§9.2, 10 rules verbatim): reject/revise loop, max 3 retries; evidence-entailment spot checks; `pipeline_runs.critic_rejections` logged.
- **`check_link` (L-class)** entailment tool (§9.4) + **bounded agentic loops** (§9.5: competitor-discovery, evidence, gap-chasing) with `(max_rounds, novelty_threshold, budget_cents)` and 30–60 tool-call hard cap.
- **Golden-set eval harness:** the 5 analyses (Bearable, Opal, CardPointers, Sofa, Nudgi) as fixtures (incl. 2 web-mode: ReachKit itself + Nudgi, per R11); mean quality scored **pre-deploy** on every pipeline change.
- **Stage 4 FORMAT** (Haiku): schemas → UI payloads; drafts polished to `founder_voice`; algorithm-safety scan (§11 rules 5–6: cross-customer similarity + generic-tell).
- **Competitor confirm/edit UI** · full Score breakdown + 7-axis radar (§7) · action cards with drafts (§10.2) · the four-question report (§5.6) · fact-sheet **TTL + cross-customer shared cache** (§5.7 layer 2) · scan email delivery (Resend).
- **pgvector semantic layer** populated (§5.7): review chunks, threads, PAA questions, positioning blurbs, findings, drafts.

**New tools:** `check_link`. **Key refs:** §6 (modules 1/2/5), §7, §9.1–9.5, §10, §11, §5.7.
**Risks owned:** R1 (quality bar), R6 (anti-vanity score rules §7.2), R8 (draft spam safety §11).
**Acceptance:** golden-set mean ≥ threshold; full scan <30min; cost/scan logged within the $0.65–1.50 target band (alert at p95 > $1.50).

### 3.4 Cycle 4 — The paid loop (spec Phase 4)

**Goal:** convert a report into a weekly operating system and take payment.

**Work packages**
- **Billing:** Stripe Solo $29/mo + customer portal (resolves §19 #1; needs entity decision §19 #5).
- **Weekly delta refresh** (§5.7 watermarks + §9.6): fetch past watermark → no-op ≈ $0.02 → else Haiku delta → escalate to Sonnet only if pgvector novelty exceeds threshold; Continuous loop = weekly re-entry into loops 1–3 (§9.5 loop 4).
- **Action queue + verification:** `/app/plays` queue (quick-wins/medium/long, §6 horizon mix) · `verify_action` tool (URL paste + weekly DataForSEO `track_rank`) · `outcomes` rows (the moat, §5.7 layer 3) · per-platform cadence caps (§11 rule 4).
- **Engagement surface (light-plus, §7.3):** weekly streak (≥3 verified actions) · score history (`score_snapshots`) · share-badge generator + OG score-card images · anti-vanity caption + score-vs-installs honesty check (§7.2 rule 5).
- **App shell** (§21.3): four-question dashboard, persistent sidebar, View Transitions content swap, `<Activity>` tab-state preservation; report layout is **one component** for free + paid (paid unlocks; free blur-locks).

**New tools:** `verify_action`, `track_rank` (wired). **Key refs:** §5.6, §7, §9.6, §10.3, §11, §21.3, §23 moments 6–7.
**Decisions:** locks §19 #1 (pricing) and needs §19 #5 (entity) before shipping.
**Acceptance:** a paying user receives a Monday queue where every card passes Critic v2; badge shares render correctly on X/Reddit.

### 3.5 Cycle 5 — Hardening + launch (spec Phase 5)

**Goal:** survive a public launch and close the funnel + GTM surface.

**Work packages**
- **Abuse & resilience:** 1 scan/app, email verification, IP+app dedupe, depth-budget hard caps (§13) · degraded-output paths (§9.1 fallback) end-to-end.
- **Cold Start sub-mode (PLG-native, §4.3):** validation-through-distribution cards, `probability_based` labeling, confidence cap 0.6, kill criteria as pivot-suggestion cards.
- **Founder-voice sample** at onboarding (§11 rule 7, MVP-simple).
- **Content & GTM:** curated-40 directory checklist (§6 module 5) · 5 teardowns (Bearable, Opal, CardPointers, Sofa, Nudgi) · Show HN / Product Hunt launch assets (§3).
- **Marketing surface MVP** (§15 item 12; §22.1 subset): `/`, `/scan` + funnel, `/report/[slug]`, `/teardowns/[slug]` ×5, `/pricing`, legal (`/privacy` `/terms` `/imprint`) — built on the §21 section-composition system.
- **GEO launch checklist** (§22.2): `llms.txt` · robots.txt explicitly allows GPTBot/ClaudeBot/PerplexityBot/Google-Extended (verify Vercel isn't blocking) · JSON-LD on every template via `lib/seo.ts` · answer-shaped content rules · Author/E-E-A-T entity (Tim).

**Key refs:** §3, §4.3, §9.1, §13, §21, §22. **Risks owned:** R4 (abuse), R7 (scope discipline vs §15).
**Acceptance:** free scan survives launch traffic; §14 conversion criteria re-measured at scale; performance budgets (§20.4) green.

### 3.6 Parallel tracks (run alongside the cycles, not after)

- **Phase 0 validation (§14)** — from day 1: landing + waitlist + genuine community participation + ~10 lightweight founder conversations + **pre-committed kill/proceed criteria** (§14.3). The Cycle 0–2 funnel IS the test instrument; the gate is measured live from Cycle 2. Salvage asset if killed: the teardown content engine.
- **Golden-set eval harness** — fixtures digitized in Cycle 0–1; scorer operational in Cycle 3; every subsequent pipeline change scored pre-deploy.
- **Marketing/SEO/GEO surface** — the §21 token→primitive→section→page system + programmatic factories (§21.2) develop in parallel from Cycle 2; MVP subset lands in Cycle 5; programmatic pages (`/compare`, `/for`, `/playbooks`) scale post-launch (Cycle 6).

### 3.7 Cycle 6 — v1.5 (spec Phase 6, out of MVP scope)

Ads + Partnerships + PR modules (§6 modules 3/4/6) · RevenueCat/Stripe enrichment + RevenueCat directory listing · Growth tier $99 on · daily signal feed behind the density gate (§9.6, §19 #8) · Google Play parity · programmatic page factories at scale. Listed for continuity; planned only after the MVP revenue gate.

---

## 4. Decisions ledger (§19 — to lock at the gates shown)

| # | Open decision | Blocks | Recommendation | Status |
|---|---|---|---|---|
| 1 | Pricing $29/$99 vs $49 | Cycle 4 | Confirm **$29 Solo**; defer Growth | Open — needed before Cycle 4 |
| 2 | Score weights .30/.25/.45 | Cycle 2–3 | Ship as **config**, tunable with data | Default adopted (non-blocking) |
| 3 | Free scan once-forever vs quarterly | Cycle 5 | Once-per-app for launch | Open — Cycle 5 |
| 4 | Teardown cadence (1/wk) | none (GTM) | Tim's content call | Open — non-code |
| 5 | Entity/billing jurisdiction (DE vs UAE) | Cycle 4 + legal | Decide before Stripe | Open — needed before Cycle 4 |
| 6 | Product name | — | **ReachKit** | **Resolved** |
| 7 | Web-mode traffic proxy | Cycle 1 | Composite (SERP count + PH upvotes + domain/Wayback age) | Default adopted; confirm in Cycle 1 spec |
| 8 | Daily signal-feed classes | Cycle 6 | From beta telemetry | Deferred — v1.5 |
| 9 | Landing theme dark vs light | Cycle 2/5 | Dark-first; A/B later | Default adopted |

**Unblocked now:** Cycles 0 and 1 (only #7, already defaulted). **Need Tim before Cycle 4:** #1, #5.

---

## 5. Risk register → cycle mapping (§16)

| Risk | Sev | Owned in | How this plan addresses it |
|---|---|---|---|
| R1 Quality-bar replication | Critical | Cycle 3 | Golden-set evals pre-deploy; over-generate + Critic; 30–60 tool-call budget; honest degradation |
| R2 "Why not ChatGPT" fails | Critical | All | The five differentiators (§2) are the build filter (Principle 1, 3, 5) |
| R3 Pre-revenue churn | High | Cycle 4 | $29 price, near-zero CAC via the Cycle-2 free-scan loop; cohort survival tracking |
| R4 Free-scan abuse | Med | Cycle 5 | §13 controls (1 scan/app, dedupe, depth caps) |
| R5 Data-source closure | Med | Cycle 1 | Tier-C = garnish only; DataForSEO backbone is contractual; graceful degrade |
| R6 Score becomes vanity | High | Cycle 3–4 | §7.2 anti-vanity rules; score-vs-installs honesty check |
| R7 Solo-founder bandwidth | High | All | This decomposition + per-cycle gates; weekly scope review vs §15 |
| R8 Draft spam detection | High | Cycle 3–4 | §11 cadence caps + similarity divergence + generic-tell scan |
| R9 DataForSEO cost creep | Low | Cycle 0+ | Standard queue default; Live only for the 10s screen; budget caps |
| R10 GDPR (Hunter.io/EU) | Med | Cycle 3+ | Business-contact-only, minimal retention; revisit at entity setup (§19 #5) |
| R11 Web-mode evidence thinness | Med | Cycle 1–3 | Competitor reviews + threads + Stripe; honest basis labels; 2 web fixtures in golden set |
| R12 Stale shared cache | Med | Cycle 0+ | TTLs per data kind; budgeted scheduled refresh; `created_at` surfaced in evidence panel |

---

## 6. Cross-cutting invariants (checked in every PR, every cycle)

- **Cost telemetry:** every external + LLM call writes a `pipeline_runs` row; per-scan budget cap enforced in code; CI/alert at p95 scan cost > $1.50.
- **Evidence grounding:** no customer-facing claim without resolvable `evidence_ids`; Critic spot-checks links against claim text (from Cycle 3).
- **Algorithm safety (§11):** no auto-anything; edit-before-copy; ≤5 outreach drafts/founder/day; per-platform cadence caps; cross-customer similarity divergence; generic-tell scan.
- **Four-question gate (§5.6):** every customer-facing UI element answers one of the four questions or moves the Score.
- **Source empiricism (§6):** report shows which sources fed it; sources below the signal-density threshold are dropped per scan.
- **Confidence calibration:** `probability_based` (Cold Start) capped 0.6; B2B capped 0.6, prosumer 0.8 (§4.2); basis labeled on every finding.
- **Accessibility/perf:** `prefers-reduced-motion` honored globally (§20.3); performance budgets enforced in CI (§20.4).

---

## 7. Testing & quality strategy

- **TDD** for all pipeline logic, adapters, the input router, score computation, the Critic Gate, and verification tools (superpowers TDD discipline).
- **Golden-set evals** are the product-quality regression suite: the 5 analyses score every pipeline change pre-deploy from Cycle 3; a regression below threshold blocks deploy.
- **Acceptance gates** (the §17 criteria, restated per cycle above) are the definition of done — a cycle is not complete until its gate is demonstrably met on the named fixtures.
- **Funnel instrumentation** (PostHog) doubles as the §14 validation measurement from Cycle 2.
- **Contract tests** for each external vendor adapter (DataForSEO, Tavily, iTunes, Resend, Stripe) so vendor drift fails loudly, not silently.

---

## 8. Spec cross-reference index

| Topic | Spec § |
|---|---|
| Input router / modes | §4.1, §5.2 |
| Funnel architecture | §5.1, §23 |
| Data model + warehouse + pgvector | §5.4, §5.7 |
| API surface | §5.5 |
| Four-question UI | §5.6 |
| Modules (Content/Outreach/SEO) | §6 (1, 2, 5) |
| Score + gamification | §7 |
| Data sources matrix | §8 |
| Pipeline + Critic Gate + tools + loops | §9 |
| Output schemas | §10 |
| Algorithm safety | §11 |
| Pricing / cost model | §12, §13 |
| Phase 0 validation | §14 |
| MVP scope (IN/OUT) | §15 |
| Risk register | §16 |
| Roadmap (phases) | §17 |
| Decision log | §18 |
| Open questions | §19 |
| Frontend stack | §20 |
| Design system / templates | §21 |
| Page tree / GEO | §22 |

---

*Artifacts so far: this doc + `docs/plans/2026-06-11-phase-1a-foundation.md` (Cycle 0, written). Next: `docs/plans/2026-06-11-phase-1b-scan-skeleton.md` (Cycle 1). Cycles 2–5 planned just-in-time at the start of each.*
