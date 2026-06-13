# Cycle 5 — Hardening + Launch (spec Phase 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development to execute this plan task-by-task (fresh implementer + two-stage review per task). Steps use checkbox (`- [ ]`) tracking.

**Goal:** Take the built product to a launch-ready state — survive public traffic (abuse controls + degraded paths), handle pre-revenue/early apps (Cold Start), personalize drafts (founder-voice), and **complete the §20–23 frontend to its rollout standard** via the marketing surface (the §21.1 section library + Tier-3 GSAP/Lenis set pieces + the rich landing + 5 teardowns) — all SEO/GEO-correct, with a render smoke-test so UI never ships broken again.

**Architecture:** The §20 stack already exists (Cycle 4 E1: Next 16 / React 19.2 / Tailwind v4 `@theme` / shadcn-on-Base-UI / Motion / native View Transitions / Geist / signature Score visual). Cycle 5 **completes** the §20–23 vision: the marketing routes get Tier-3 **GSAP + Lenis** set pieces (lazy, marketing-only, out of the app bundle — §20.3) composed from a typed **§21.1 section library**, while the hardening work (abuse/Cold Start/founder-voice/degraded) makes the keyless pipeline safe for real traffic. Everything stays keyless (`REACHKIT_USE_FIXTURES`); the actual go-live (Vercel + prod Supabase + real keys + the #5 jurisdiction call) is the separate **deploy phase**, out of this cycle.

**Tech Stack additions:** `gsap` (+ ScrollTrigger, SplitText — free since 2025) and `lenis` (smooth scroll), lazy-loaded on marketing routes only; a headless-render smoke-test (Playwright or a chrome-headless script).

---

## Scope & decisions (read before estimating)

- **§20–23 is the rollout target (Tim, 2026-06-13).** Cycle 5's marketing surface brings the frontend to that standard: the section-composition system (§21), Tier-3 animation (§20.3), and the public pages. The Cycle-4 minimal funnel-entry landing is **upgraded** into the rich §22.1 landing.
- **MVP launch subset only** (§15 / §22.1): `/` (rich), `/scan` + funnel (done, polished in C4), `/report/[slug]` (done), **5 teardowns**, `/pricing` (done in C4 — refine onto the section system), legal (`/privacy` `/terms` `/imprint`). **Excluded (post-launch / Cycle 6):** programmatic `/compare`, `/for`, `/playbooks`, `/tools/*` (the §21.2 factories).
- **Keyless throughout.** Hardening + marketing + GEO all build + run under `REACHKIT_USE_FIXTURES`. Deploy/go-live (accounts, keys, jurisdiction #5, Vercel, prod Supabase) is a **separate phase**, not Cycle 5.
- **§14 Phase 0 validation** (smoke test, founder conversations, kill/proceed criteria) is a **GTM activity for Tim**, not a build task — noted, not implemented.
- **Closes the render-verification gap** found 2026-06-13: the Cycle-4 UI passed build/typecheck/bundle but had runtime render bugs (circular font var, Cache-Components Suspense, server-component event handlers, ssr:false reveal) because subagents never rendered it live. Task 14 adds a headless render smoke-test to the gate.
- **Invariants (every PR):** keyless-fixtures intact · no auto-send (§11) · Critic v2 on any new cards · RLS · §20.4 perf budgets green (incl. GSAP/Lenis OUT of the app bundle) · render smoke-test green · `prefers-reduced-motion` honored.
- **Risks owned:** R4 (free-scan abuse), R7 (scope discipline vs §15 — resist building the post-launch programmatic pages now).

---

## Milestone A — Abuse & resilience (R4) + degraded paths (§13, §9.1)

### Task 1: scan abuse controls (1 scan/app · dedupe · email verification)
**Files:** `supabase/migrations/<ts>_scan_abuse.sql`, `lib/scan/abuse.ts` (+ test), modify `app/api/scan/route.ts`.
- [ ] Migration: a partial unique / lookup index to enforce **one in-flight scan per app** + an `ip_hash` column on `scans` (sha256 of IP, no raw IP stored) for IP+app dedupe. `lib/scan/abuse.ts`: `assertScanAllowed({ storeUrl, appId, ipHash }): Promise<void>` — rejects a 2nd scan for the same app within a window (free = 1 scan/app/forever per §12, configurable via a window), and rate-limits per ip_hash (e.g. ≤N scans/hour). Throws a typed `AbuseError` → 429. Email verification: the magic-link gate already verifies ownership of the email; ensure the FULL report requires a verified/claimed email (already gated) — document the chain.
- [ ] Wire into `POST /api/scan`: hash the request IP, `assertScanAllowed` before enqueueing (429 + clear message on reject). Fixture/dev: a generous window so local testing isn't blocked.
- [ ] **Commit** `feat: scan abuse controls — 1 scan/app, IP+app dedupe, rate limit (R4)`.

### Task 2: depth-budget hard caps + cost alerting (§13)
**Files:** modify `lib/tools/registry.ts` (`ScanBudget`), `lib/telemetry/pipeline-runs.ts` (+ test).
- [ ] Confirm/enforce the §9.5 hard ceiling (30–60 tool calls, budget cents) is a HARD stop in `ScanBudget` (throws `BudgetExceededError` past the cap, already partly there). Add a per-scan cost roll-up check: after a scan, if total `pipeline_runs.cost_cents` for the scan exceeds the budget, log a `p95 > $1.50` style alert marker (a telemetry warning row / console.error). Keep it cheap.
- [ ] **Commit** `feat: enforce scan depth-budget hard cap + cost-overrun alert (§13)`.

### Task 3: degraded-output paths end-to-end (§9.1)
**Files:** `tests/integration/degraded-paths.test.ts` (new), targeted fixes in `lib/scan/*` / `lib/llm/*` where a failing source/stage doesn't degrade cleanly.
- [ ] Audit each stage (collect → extract → synth → critic → format → score → report) for graceful degradation: a dead source / empty fact sheet / LLM failure must yield an HONEST partial report (degraded labels, `probability_based`), never a crash or a blank page. Most is built (fixtures prove happy path) — this task PROVES the failure paths. Integration test: force each source/stage to fail (mock reject) and assert the scan still completes with a usable `report_payload` + honest basis labels.
- [ ] **Commit** `test: degraded-output paths end-to-end (§9.1) + fix any non-graceful stage`.

---

## Milestone B — Cold Start sub-mode (§4.3, PLG-native)

### Task 4: Cold Start detection
**Files:** `lib/scan/cold-start.ts` (+ test), modify `lib/scan/collect.ts` / facts assembly.
- [ ] `isColdStart(facts): boolean` — true when `<25` reviews (app) / negligible review+traffic footprint (web) / pre-launch signals. Set a `coldStart` flag on `PreliminaryFacts` (+ persist on the scan). Pure + TDD the thresholds.
- [ ] **Commit** `feat: Cold Start detection (<25 reviews / negligible footprint)`.

### Task 5: Cold Start action queue (validation-through-distribution)
**Files:** `lib/llm/cold-start-actions.ts` (+ test), modify `lib/scan/full-scan.ts` (branch on coldStart).
- [ ] When `coldStart`, generate the §4.3 queue instead of the standard plan: (1) waitlist/free-tool PLG artifact card w/ draft, (2) 2–3 scored-community post cards (demand tests), (3) one comparison/landing page on the top intent keyword, (4) optional `$50 ad test` card, (5) optional (never mandatory) discovery-conversation script card. **All `probability_based`, confidence capped 0.6.** Kill/pivot criteria computed from observed signals (waitlist conv, CTR, community engagement) surface as a **pivot-suggestion action card in the same queue** — never a lecture. Fixture-aware. Passes Critic v2 + §11.
- [ ] **Commit** `feat: Cold Start queue — validation-through-distribution cards + pivot-as-card (§4.3)`.

---

## Milestone C — Founder-voice (§11 rule 7)

### Task 6: founder-voice capture + draft personalization
**Files:** `app/(app)/app/settings/*` (voice input), `app/api/app/voice/route.ts`, (founder_voice already in `users`; `lib/llm/actions.ts` already reads it) + test.
- [ ] A simple onboarding/settings input: founder pastes 1–2 paragraphs in their voice → `POST /api/app/voice` → `users.founder_voice` (auth-gated). `actions.ts` already injects `founderVoice` into the FORMAT prompt — confirm the flow end-to-end (voice captured → drafts adopt it). MVP-simple (a textarea + save), no fancy onboarding wizard. Unit/integration test the round-trip.
- [ ] **Commit** `feat: founder-voice capture + draft personalization (§11 rule 7)`.

---

## Milestone D — §20–23 marketing surface + design-system completion (the rollout target)

### Task 7: §21.1 section library
**Files:** `components/sections/*` (+ render tests), `lib/seo.ts` (JSON-LD builders per section).
- [ ] Build the typed, content-as-props sections (a page = ordered sections + one content object, §21): `Hero`, `ScanInput` (reuses the funnel input), `SocialProofMarquee`, `FeatureBento`, `HowItWorksScroll`, `TeardownGrid`, `ComparisonTable`, `PricingTable` (refactor the C4 pricing onto this), `FAQ` (emits FAQPage JSON-LD automatically), `FinalCTA`, `Footer`. On the E1 design system (tokens/primitives), dark-first, Motion for in-app micro-interactions. Each section render-tested.
- [ ] **Commit** `feat: §21.1 marketing section library (typed, content-as-props, JSON-LD-aware)`.

### Task 8: Tier-3 animation — GSAP + Lenis (§20.3), marketing-only
**Files:** `pnpm add gsap lenis`, `components/motion/gsap/*` (lazy wrappers), modify `app/(marketing)/layout.tsx`.
- [ ] Add **GSAP** (ScrollTrigger, SplitText) + **Lenis** smooth scroll, **lazy-loaded, client, marketing routes ONLY** (a `(marketing)` layout that mounts Lenis + a GSAP provider below the fold; the hero animates with CSS until GSAP hydrates per §20.4). Implement the signature set pieces: hero **SplitText** reveal, the scroll-driven **"watch a scan happen"** sequence, pinned **how-it-works**. **`prefers-reduced-motion`** disables all of it. **GSAP/Lenis must NOT enter the app/funnel bundle** (verify via `pnpm check:bundle`).
- [ ] **Commit** `feat: Tier-3 marketing animation (GSAP + Lenis, lazy, marketing-only, reduced-motion-safe)`.

### Task 9: rich landing `/` + `/scan` entry (§22.1, §23 moment 1)
**Files:** modify `app/(marketing)/page.tsx`, `app/(marketing)/scan/page.tsx` (new), `lib/seo.ts`.
- [ ] Compose the sections (Task 7) + set pieces (Task 8) into the full landing — hero + scan input above the fold (§23 moment 1 preserved: scan input still the primary CTA), then social proof, how-it-works scroll, feature bento, teardown grid, pricing, FAQ, final CTA, footer. Dedicated `/scan` lead-magnet entry (HowTo JSON-LD). `/` gets SoftwareApplication + Organization + FAQPage JSON-LD via `lib/seo.ts`. LCP < 2.0s (animation lazy below fold).
- [ ] **Commit** `feat: rich §22.1 landing + /scan entry (sections + set pieces + JSON-LD)`.

### Task 10: teardowns — template + 5 launch analyses (§22.1 content engine)
**Files:** `app/(marketing)/teardowns/page.tsx`, `app/(marketing)/teardowns/[slug]/page.tsx`, `content/teardowns/{bearable,opal,cardpointers,sofa,nudgi}.ts` (+ render test), `lib/seo.ts` (Article+Author).
- [ ] `/teardowns` index (TeardownGrid) + `/teardowns/[slug]` template rendering a teardown analysis (reuse the report section components where apt). Seed the **5 launch teardowns** from the golden-set fixtures / hand-authored analyses (Bearable/Opal/CardPointers/Sofa/Nudgi). Article + Author JSON-LD + a "last verified" date. (Programmatic DB-driven teardowns = Cycle 6; these 5 are file-backed content for launch.)
- [ ] **Commit** `feat: teardowns template + 5 launch analyses (content engine, Article JSON-LD)`.

### Task 11: legal pages (DE Impressum)
**Files:** `app/(marketing)/{privacy,terms,imprint}/page.tsx`, `content/legal/*`.
- [ ] `/privacy`, `/terms`, `/imprint` on the section system. Imprint per DE entity requirement (placeholder entity details until the #5 jurisdiction decision; clearly marked TODO for the real entity at deploy). Plain, compliant, linked in the footer.
- [ ] **Commit** `feat: legal pages (/privacy /terms /imprint)`.

### Task 12: render smoke-test (closes the verification gap)
**Files:** `tests/render/smoke.test.ts` (or `scripts/render-smoke.mjs`), `package.json` script `test:render`, CI wiring.
- [ ] A headless-Chrome (Playwright, or a `chrome --headless --dump-dom` script) test that boots the app (dev or `next start`), seeds a demo scan, and hits each key route (`/`, `/scan`, `/pricing`, `/scan/[id]/results`, `/report/[slug]`, `/teardowns`, `/teardowns/[slug]`, a legal page; + `/app` authed if a session can be seeded) — asserting for each: HTTP 200, NO Next error overlay (`Runtime Error` / `blocking-route` / `Event handlers cannot be passed`), and a key content marker present. `pnpm test:render` runs it; it gates pre-deploy. This is the discipline that would have caught the 2026-06-13 render bugs.
- [ ] **Commit** `test: headless render smoke-test for all key routes (no error overlay + content present)`.

---

## Milestone E — GEO launch checklist (§22.2)

### Task 13: llms.txt + robots + JSON-LD coverage + E-E-A-T
**Files:** `app/llms.txt/route.ts` (or `public/llms.txt`), `app/robots.ts`, `app/sitemap.ts`, audit `lib/seo.ts` coverage, an Author/entity page or metadata.
- [ ] `llms.txt` describing the product + pricing + key pages for AI crawlers. `robots.ts` explicitly **allows** GPTBot, ClaudeBot, PerplexityBot, Google-Extended (+ verify nothing blocks them). `sitemap.ts` covering the MVP routes. Confirm **every template emits JSON-LD via `lib/seo.ts`** (the §22.1 payloads). Author/E-E-A-T entity (Tim) on teardowns/playbooks. Answer-shaped content rules applied to teardowns (question H2s, direct first-paragraph answers).
- [ ] **Commit** `feat: GEO launch checklist — llms.txt, robots (AI crawlers), sitemap, JSON-LD coverage, E-E-A-T`.

---

## Milestone F — Launch assets (§3 dogfooding) — *content, lightest code*

### Task 14: directory checklist + launch assets
**Files:** `content/directories.ts` (curated-40, §6 module 5), `content/launch/{show-hn,product-hunt}.md`.
- [ ] The curated-40 directory checklist as data (used by SEO/ASO action cards + a future `/tools` page). Show HN + Product Hunt launch copy/templates (markdown). Content-heavy, minimal code — can be trimmed/deferred if Tim prefers to author these himself.
- [ ] **Commit** `feat: curated-40 directory checklist + Show HN / Product Hunt launch assets`.

---

## Self-Review (plan author)

**Spec coverage (Cycle 5 / decomposition §3.5 / spec Phase 5):** abuse & resilience (1 scan/app, dedupe, email verification, depth caps) + degraded paths → A ✓ · Cold Start sub-mode (PLG-native, prob_based, 0.6 cap, pivot-as-card) → B ✓ · founder-voice sample → C ✓ · marketing surface MVP (§22.1 subset) on the §21 section system + Tier-3 GSAP/Lenis (§20.3) → D ✓ · GEO checklist (§22.2) → E ✓ · directory checklist + launch assets (§3) → F ✓ · **render smoke-test** (new, closes the C4 gap) → Task 12 ✓.
**§20–23 completion:** Tasks 7–11 bring the frontend to the rollout standard (section library, Tier-3 animation, rich landing, teardowns) — the Cycle-4 stack is reused, not rebuilt.
**Scope discipline (R7):** programmatic factories (`/compare`, `/for`, `/playbooks`, `/tools`) are EXCLUDED (post-launch / Cycle 6). Phase-0 validation (§14) is a GTM activity, not a build task.
**Keyless / deploy boundary:** everything builds + runs under `REACHKIT_USE_FIXTURES`; go-live (Vercel, prod Supabase, real keys, #5 jurisdiction, real Impressum entity) is the separate deploy phase.
**Perf (§20.4):** GSAP/Lenis lazy + marketing-only (out of the app bundle, verified by `check:bundle`); landing LCP < 2.0s (animation below fold); reduced-motion honored.
**Type seams:** §21.1 sections (T7) → landing/teardowns (T9/T10); `coldStart` flag (T4) → Cold Start queue (T5); founder_voice (T6) → existing `actions.ts` FORMAT prompt.
**Confirm-at-build:** the 5 teardown analyses' depth (golden-set-derived vs hand-authored); the GSAP set-piece scope (how elaborate the "watch a scan happen" sequence is); the directory-checklist + launch-asset content (Tim may author).

---
*Execution: subagent-driven, milestone-grouped; per-task review for abuse/Cold-Start/degraded (judgment-heavy) and the marketing surface (UI, uses ux-designer + frontend-design + the new render smoke-test). The deploy/go-live phase + §14 Phase-0 validation are separate.*
