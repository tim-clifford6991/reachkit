# Cycle 4 — The Paid Loop (spec Phase 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development to execute this plan task-by-task (fresh implementer + two-stage review per task). Steps use checkbox (`- [ ]`) tracking.

**Goal:** Turn the Cycle-3 one-shot report into a *weekly operating system* and take payment — Stripe billing (Solo $29 / Growth $99), a delta-only weekly refresh engine, an action queue with verification that writes the `outcomes` moat, an engagement surface (streak + score history + share badge), and a thin app shell to drive it.

**Architecture:** Billing is a thin Stripe layer (test mode) gated behind `fixturesEnabled()` exactly like every other paid vendor — the whole paid loop runs keyless in dev (simulated checkout/portal/webhook → direct tier set). The refresh engine re-enters the Cycle-3 pipeline *delta-scoped*: `monitors.watermark` bounds each fetch, Haiku summarizes deltas, and Sonnet is invoked only when pgvector novelty vs. existing `findings` exceeds threshold — this is where the **T10 bounded loops finally wire in** (continuous loop 4 = weekly re-entry into loops 1–3). Verification closes the loop: a completed action's `verify_url`/rank is checked (fail-closed), flips `actions.verify_state`, and writes an `outcomes` row. Every refresh-generated card passes Critic Gate v2 + §11 algorithm-safety, unchanged from Cycle 3.

**Tech Stack:** Stripe (`stripe` SDK, subscriptions + Billing Portal, **test mode**) · Inngest scheduled (cron) functions for the weekly refresh · existing warehouse tables (`monitors`/`outcomes`/`score_snapshots` already exist from Cycle 0 — Cycle 4 is the first consumer) · Next 16 `ImageResponse` for OG score-card badges · Supabase auth (the Cycle-2 magic-link user) for entitlement gating.

---

## Scope & locked decisions (read before estimating)

- **Pricing (Tim, 2026-06-13):** Free Scan / **$29 Solo** / **$99 Growth** — both paid tiers wired now. This pulls **Growth forward from Cycle 6**: Cycle 4 ships the Growth *tier + limits* (3 apps, higher draft/rank quota, weekly→ (daily feed stays v1.5)), but the Growth-*differentiated modules* (Ads/Partnerships/PR) remain v1.5. Tier limits table in Task 1.
- **Stripe = TEST MODE, keyless-first.** `fixturesEnabled()` short-circuits all Stripe calls: checkout returns a simulated success that directly sets `users.tier`, portal returns a stub URL, and there is no real webhook (the simulated checkout upserts billing state inline). Real Stripe *test* keys are optional and only needed to exercise the live checkout/webhook path (Stripe CLI forwards webhooks in dev). Production keys + the **entity/jurisdiction decision (#5 DE vs UAE)** are **deploy-time, NOT this cycle**.
- **UI = polished §20–23, built now (Tim, 2026-06-13).** Milestone E implements the **full §20–23 design system + every conversion-path surface** (funnel + app + report + engagement) to **final spec** — built once, no thin-then-restyle, to avoid duplicate work. The thin Cycle 1–3 funnel views (scan theater, score reveal, results) are **upgraded in place** onto this system. Only pure content-marketing pages (teardowns ×5, programmatic `/compare`·`/for`·`/playbooks`, legal, changelog) stay Cycle 5 — and they **compose** this design system rather than duplicate it. The headless engine (Milestones A–D, F) is built first; Milestone E renders it. UI work uses the **ux-designer** + **frontend-design** skills.
- **Folds in the Cycle-3 follow-ups** (recorded in memory): wire/retire `lib/scan/loops.ts` (Task 9), fix the algorithm-safety divergence self-match on re-scan (Task 9), strengthen the golden-set with a per-category floor + de-tautologize `findingsCoverage` (Task 19), add a true end-to-end Inngest integration test (Task 19), `APP_URL` in prod (deploy note).
- **Invariants (every PR):** every paid call `fixturesEnabled()`-gated · **no auto-send/post** (`draft_requires_edit` stays true through refresh) · every refresh/queue card passes Critic v2 · RLS on all new columns/tables · `users.id = auth.uid()` honored on every authed route · Inngest steps idempotent (delete-before-insert / upsert) · `pipeline_runs` cost telemetry on every refresh.

---

## Milestone A — Billing (Stripe test mode + tiers + portal + entitlement gating)

### Task 1: migration — billing state + the tier/limits contract
**Files:** `supabase/migrations/<ts>_billing.sql`, `lib/billing/tiers.ts` (+ test), regen `lib/db/types.ts`.
- [ ] Migration: add to `users` → `stripe_customer_id text`, `stripe_subscription_id text`, `subscription_status text` (`active|past_due|canceled|trialing|incomplete|null`), `current_period_end timestamptz`. (`tier` already exists: `free|solo|growth`.) Indexes on `stripe_customer_id`, `stripe_subscription_id`. No RLS change (service-role writes from the webhook; users read own row under the existing `id = auth.uid()` policy).
- [ ] `lib/billing/tiers.ts` — the single source of truth: `type Tier = "free"|"solo"|"growth"`; `TIER_LIMITS: Record<Tier, { apps: number; refreshCadence: "none"|"weekly"; draftQuota: number; rankDepth: number }>` (free: 1/none/0/0 · solo: 1/weekly/20/20 · growth: 3/weekly/100/50); `tierForPriceId(priceId): Tier` (maps `env.stripePriceSolo|Growth`); `isPaid(tier)`. Pure + TDD.
- [ ] **Commit** `feat: billing migration (users stripe/subscription state) + tier-limits contract`.

### Task 1b: Server-auth foundation (@supabase/ssr cookie session) — *prerequisite for ALL authed surfaces (billing, queue, app shell)*
**Files:** `lib/auth/server.ts`, `lib/auth/client.ts`, `app/auth/callback/route.ts`, modify `app/api/scan/[id]/claim/route.ts`; `pnpm add @supabase/ssr`.
- [ ] **Gap found at build (2026-06-13):** Cycle 2 shipped only the magic-link *send* (`signInWithOtp`); there is no server session **read** (`serverDb()` is service-role only). Add `@supabase/ssr`: a cookie-based server client (`createServerClient` with the Next 16 `cookies()` adapter) + a browser client; an `/auth/callback` route that exchanges the magic-link `code` for a cookie session then redirects to `next` (default `/app`); repoint the claim route's `emailRedirectTo` at `/auth/callback?next=/scan/[id]/results`. Export `currentUser(): Promise<{ authId: string; user: UsersRow } | null>` (reads the cookie session via `auth.getUser()`, loads the `users` row by `id`) and `requireUser()` (throws an `AuthError` mapped to 401). The `users.id = auth.uid()` profile row already exists (the `auth_user_profile` trigger). Keyless: local dev uses Supabase local auth (Inbucket) — no extra keys. Follow the official `@supabase/ssr` Next App-Router pattern.
- [ ] **Commit** `feat: server-auth foundation (@supabase/ssr cookie session, /auth/callback, currentUser/requireUser)`.

> All auth-gated routes below (`/api/billing/*`, `/api/app/:id/*`, `/api/action/:id/*`, the `(app)` shell) resolve the caller via `requireUser()` from Task 1b.

### Task 2: Stripe client + env (test-mode, fixture-aware)
**Files:** `lib/billing/stripe.ts`, modify `lib/config/env.ts` (+ test).
- [ ] env: add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_SOLO`, `STRIPE_PRICE_GROWTH` — all `z.string().optional().default("")`; **not** in the PAID_KEYS required set (keyless dev relies on fixture short-circuit). Map `stripeSecretKey`, `stripeWebhookSecret`, `stripePriceSolo`, `stripePriceGrowth`.
- [ ] `lib/billing/stripe.ts` — `stripeClient()` returns `new Stripe(env.stripeSecretKey)`; a module guard `assertStripeConfigured()` throws a clear error if called with empty keys outside fixtures mode. `pnpm add stripe`.
- [ ] **Commit** `feat: Stripe client + test-mode env (fixture-gated)`.

### Task 3: checkout — create a subscription Checkout Session
**Files:** `lib/billing/checkout.ts`, `app/api/billing/checkout/route.ts` (+ integration test).
- [ ] `createCheckout({ userId, plan }): Promise<{ url: string }>`. Fixture path: skip Stripe, directly set `users.tier = plan` + `subscription_status="active"` and return `{ url: ${env.appUrl}/app?billing=demo }` (keyless upgrade for dev). Live path: ensure a Stripe customer for the user (create + persist `stripe_customer_id` if absent), create a `mode:"subscription"` Checkout Session for `tierForPriceId`'s price, `success_url=${appUrl}/app?upgraded=1`, `cancel_url=${appUrl}/app/billing`, `client_reference_id=userId`, `metadata.userId`.
- [ ] `POST /api/billing/checkout` `{plan: "solo"|"growth"}` — auth-gated (resolve `auth.uid()` → users row; 401 if anon), calls `createCheckout`, returns `{url}`. Integration test (fixtures): authed POST → tier flips to the plan, returns a url.
- [ ] **Commit** `feat: subscription checkout (fixture-aware) + /api/billing/checkout`.

### Task 4: webhook — reconcile subscription state
**Files:** `lib/billing/webhook.ts`, `app/api/billing/webhook/route.ts` (+ test).
- [ ] `handleStripeEvent(event): Promise<void>` — on `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`: resolve the user (by `client_reference_id`/`metadata.userId` or `stripe_customer_id`) and upsert `stripe_subscription_id`, `subscription_status`, `current_period_end`, and `tier` (← `tierForPriceId(sub.items[0].price.id)`; `free` on delete/`canceled`). **Idempotent** (last-write-wins by current state). Unknown event types → ignore.
- [ ] `POST /api/billing/webhook` — read **raw body** (`await req.text()`), `stripeClient().webhooks.constructEvent(raw, sig, env.stripeWebhookSecret)`, dispatch to `handleStripeEvent`. Return 400 on bad signature. (No fixture path — real webhook is a live-test-only surface; in fixtures the checkout sets state inline.) Unit test: a signed `subscription.updated` fixture event flips tier; bad signature → 400.
- [ ] **Commit** `feat: Stripe webhook → subscription/tier reconciliation (idempotent)`.

### Task 5: customer portal
**Files:** `lib/billing/portal.ts`, `app/api/billing/portal/route.ts`.
- [ ] `createPortalSession(userId): Promise<{url}>` — fixture path returns `${appUrl}/app/billing?portal=demo`; live path `stripe.billingPortal.sessions.create({ customer, return_url: ${appUrl}/app/billing })`. `POST /api/billing/portal` auth-gated.
- [ ] **Commit** `feat: Stripe billing portal session + /api/billing/portal`.

### Task 6: entitlements — the gate used everywhere
**Files:** `lib/billing/entitlements.ts` (+ test), modify the report-unlock read path.
- [ ] `entitlementsFor(userId): Promise<{ tier, limits, active: boolean }>` (active = `isPaid(tier) && subscription_status ∈ {active,trialing}`); `assertCanAddApp(userId)` (enforces `limits.apps` vs `users.app_ids.length`); `assertPaid(userId)` (throws `EntitlementError` for the queue/refresh surfaces). The **report unlock is data-gated, not regenerated**: drafts/actions exist in `report_payload`/`actions` already — free shows blur-locked previews, paid unlocks; implement `redactReportForTier(payload, tier)` (free → strip `draft` bodies + cap actions to 3 previews; paid → full). Wire into the results read path. TDD the redaction + quota logic.
- [ ] **Commit** `feat: tier entitlements + report redaction (free blur-lock / paid unlock)`.

---

## Milestone B — Weekly delta refresh (the engine, §5.7 + §9.6)

### Task 7: monitor seeding + watermark model
**Files:** `lib/scan/monitors.ts` (+ test), modify `lib/scan/full-scan.ts` (seed on completion).
- [ ] `seedMonitors(ctx): Promise<void>` — idempotent (upsert by `app_id,kind`): create `monitors` rows for kinds `reviews|rank|threads|competitors` with `cadence:"weekly"`, initial `watermark` (last review id, current top ranks, latest thread ts, known competitor set) captured from the just-completed full scan. `WatermarkBody` types in `lib/scan/types.ts`. Call at the end of `runFullScan` (so a claimed scan is monitor-ready). NEVER throws (best-effort, like notify).
- [ ] **Commit** `feat: monitor seeding + watermark model (weekly refresh prerequisites)`.

### Task 8: delta collectors (fetch-past-watermark)
**Files:** `lib/scan/delta-collect.ts` (+ test).
- [ ] `collectDeltas(ctx, monitors): Promise<{ kind, items, newWatermark }[]>` — per kind, fetch only what's newer than the watermark using existing adapters (reviews → app-store-rss since last id; rank → DataForSEO/`track_rank` since last positions; threads → HN/Bluesky since ts; competitors → `find_competitors` diff vs known set). Fixture-aware (canned deltas). Returns deltas + advanced watermarks; updates `monitors.last_run_at`/`watermark` only after the refresh consumes them (Task 9). `allSettled` per kind — one dead source degrades, never throws.
- [ ] **Commit** `feat: delta collectors (watermark-scoped, fixture-aware)`.

### Task 9: refresh pipeline — delta → Haiku → novelty → (Sonnet) → cards [wires T10 loops; fixes divergence self-match]
**Files:** `lib/scan/refresh.ts` (+ integration test), modify `lib/scan/algorithm-safety.ts`, consume `lib/scan/loops.ts`.
- [ ] `runWeeklyRefresh(ctx): Promise<RefreshResult>`: `collectDeltas` → **nothing new ⇒ cheap no-op** (record a ~$0.02 `pipeline_runs` row, advance watermarks, return empty digest). Else: Haiku delta-summary per changed kind → embed + **novelty check** (`searchSimilar` vs existing `findings` embeddings); **escalate to Sonnet only if novelty > threshold** → re-extract affected fact sheets → `generateActions` on the delta → `runCriticGate` → `algorithmSafety` → append Critic-passed cards to the queue (idempotent per week) → `score_snapshots` row → "what changed" digest. **Wire `lib/scan/loops.ts`**: the competitor-delta kind re-enters `competitorDiscoveryLoop` (continuous loop 4 = weekly re-entry into loops 1–3); the gap-chasing loop reallocates leftover refresh budget. Honor §11 cadence caps.
- [ ] **Fix Cycle-3 follow-up #3 (divergence self-match):** in `algorithm-safety.ts applyDivergenceCheck`, exclude the app's OWN prior-scan draft embeddings — `deleteEmbeddingsForApp(appId,"draft")` **before** `searchSimilar`, or pass an `excludeAppId` filter — so a re-scan/refresh doesn't self-flag. Update the stale comment. Keep the existing test green; add a re-scan regression test.
- [ ] **Commit** `feat: weekly delta-refresh pipeline (watermark→Haiku→novelty→Sonnet, loops wired) + fix divergence self-match`.

### Task 10: Inngest scheduled refresh + weekly trigger
**Files:** `lib/inngest/functions/weekly-refresh.ts`, modify `lib/inngest/client.ts` (register), `app/api/inngest/route.ts`.
- [ ] An Inngest **cron** function (weekly, e.g. Mondays) that fans out over active paid apps (`tier ∈ {solo,growth}`, `subscription_status active`) → per app `step.run` → rebuild ctx → `runWeeklyRefresh` → on success advance watermarks + emit a `refresh` scan_event (extend the CHECK like Cycle 3's `report`). Idempotent per `app_id + week_of` (skip if a snapshot for this week exists). `onFailure` logs; one app's failure doesn't abort the fleet (per-app `step.run`). Also expose a manual `POST /api/app/[id]/refresh` (auth+`assertPaid`) for on-demand/testing.
- [ ] **Commit** `feat: weekly scheduled refresh (Inngest cron, per-paid-app, idempotent)`.

---

## Milestone C — Action queue + verification + the outcomes moat (§10.3, §9.4, §5.7 layer 3)

### Task 11: weekly plan assembly (§10.3)
**Files:** `lib/scan/weekly-plan.ts` (+ test).
- [ ] `assembleWeeklyPlan(appId, weekOf): Promise<WeeklyPlan>` → `{ week_of, app_id, queue: { quick_wins, medium, long_play }, carryover, score_delta_last_week, honesty_note }`. Buckets `actions` by effort horizon (§10.3 mix: quick `<30m` / medium `30–120` / long `>120`), pulls unfinished prior-week cards into `carryover`, computes `score_delta_last_week` from `score_snapshots`, sets `honesty_note` from the §7.2 score-vs-installs check. Pure over persisted rows; TDD the bucketing + carryover.
- [ ] **Commit** `feat: weekly plan assembler (§10.3 horizon mix + carryover + score delta)`.

### Task 12: queue API
**Files:** `app/api/app/[id]/queue/route.ts` (+ integration test).
- [ ] `GET /api/app/[id]/queue` — auth + `assertPaid` + app ownership → `assembleWeeklyPlan`. 402-style `EntitlementError` for free tier. Integration test (fixtures): paid app returns a bucketed plan; free → blocked.
- [ ] **Commit** `feat: weekly action-queue API (entitlement-gated)`.

### Task 13: `verify_action` + `track_rank` D-tools (§9.4)
**Files:** `lib/scan/tools/verify-action.ts`, `lib/scan/tools/track-rank.ts`, `lib/scan/adapters/dataforseo-rank.ts` (+ tests), register in `lib/scan/tools/index.ts`.
- [ ] `verify_action` (D): fetch `verify_url` + parse → confirm the action is live (e.g. the page/post exists and matches the expected artifact) — **fail-closed** like `check_link` (unreachable/ambiguous ⇒ `verified:false`). Fixture-aware.
- [ ] `track_rank` (D): DataForSEO rank endpoint for a keyword/target → current position; fixture-aware (canned rank). Used both by delta-collect (Task 8) and verification of `rank_check` actions.
- [ ] **Commit** `feat: verify_action + track_rank D-tools (fail-closed, fixture-aware)`.

### Task 14: action completion → verification → outcomes
**Files:** `lib/scan/verify.ts`, `app/api/action/[id]/complete/route.ts`, `lib/inngest/functions/verify-action.ts` (+ integration test).
- [ ] `POST /api/action/[id]/complete` `{ verify_url? }` — auth + ownership → set `actions.verify_state="pending"`, store `verify_url`, enqueue an Inngest `action/verify` event. The Inngest fn runs `verify_action` (or `track_rank` for `rank_check` method) → on success: `verify_state="verified"`, `status="done"`, **write an `outcomes` row** (`verified_signal`, `observed_delta` = score-component movement) → trigger a score recompute/snapshot. Honor §11 per-surface cadence caps. Idempotent (re-complete doesn't duplicate outcomes — upsert by `action_id`).
- [ ] **Commit** `feat: action verification → outcomes (the moat) + score recompute`.

---

## Milestone D — Engagement surface (§7.3 light-plus)

### Task 15: streak + score history + honesty check
**Files:** `lib/scan/engagement.ts` (+ test).
- [ ] `weeklyStreak(appId): Promise<number>` (consecutive weeks with ≥3 verified actions, from `outcomes`/`actions`); `scoreHistory(appId): Promise<{ taken_at, total }[]>` (from `score_snapshots`); `installsHonestyNote(appId)` (§7.2 rule 5 — flag score-up-while-installs-flat). Pure-ish reads; TDD streak boundaries.
- [ ] **Commit** `feat: weekly streak + score history + anti-vanity honesty note`.

### Task 16: share badge + OG score-card (growth loop)
**Files:** `app/report/[slug]/opengraph-image.tsx`, `lib/badge/score-card.ts` (+ test), modify `app/report/[slug]/page.tsx` (badge embed snippet).
- [ ] Dynamic OG score-card via Next `ImageResponse` (score + radar summary + anti-vanity caption) as the `/report/[slug]` OG image — every social share is a landing page (§22 growth loop). Add a copy-paste "Add to your site/README" badge snippet on the public report that links back to `/report/[slug]`. Anti-vanity caption (no inflated claims). Test the score-card data builder (pure) + that the route renders.
- [ ] **Commit** `feat: shareable score-card OG image + report badge embed (growth loop)`.

---

## Milestone F — Quality gate hardening (folds remaining Cycle-3 follow-ups) — *headless, build before UI*

### Task 17: strengthen the golden set + end-to-end pipeline test
**Files:** modify `lib/eval/score.ts` + `lib/eval/types.ts` + the 5 fixtures, `tests/integration/scan-requested-e2e.test.ts` (new).
- [ ] De-tautologize the eval (follow-up #2): replace/augment the static `findingsCoverage` with a **pipeline-produced** signal, add a **per-category action floor** to the rubric (≥1 surviving action per active module — this is the regression class the §11 cap bug fell into), and tighten `scoreBand`/`minActions`. Keep `pnpm eval` mean threshold meaningful (a real regression must drop it).
- [ ] Add a **true end-to-end Inngest test** (follow-up #4): drive `scanRequested` through all steps (collect→findings→full-scan→notify→done) in fixtures mode and assert the terminal `report_payload` + `done` event + (for a paid app) a seeded monitor set.
- [ ] **Commit** `test: de-tautologize golden set (per-category floor) + end-to-end Inngest pipeline test`.

---

## Milestone E — §20–23 Design System + Polished Product UI (final quality, built once)

> **Scope (Tim, 2026-06-13):** implement the polished §20–23 UI **now** — establish the design system once and render every conversion-path surface (funnel + app + report + engagement) to final spec, so nothing is built twice. The thin Cycle 1–3 funnel views are **upgraded in place** onto this system. Pure content-marketing pages (teardowns ×5, programmatic `/compare`·`/for`·`/playbooks`, legal, changelog) stay Cycle 5 and **compose** this system. UI tasks use the **ux-designer** + **frontend-design** skills; each task below is a milestone-sized effort decomposed further at build time. The headless engine (A–D, F) lands first; E renders it against the real APIs.

### Task 18: Design-system foundation (§20–21)
**Files:** `app/globals.css` `@theme` tokens, `components/ui/*` (Base UI + shadcn primitives), `components/motion/*` (Motion + GSAP+plugins + native View-Transitions wrappers), `components/sections/*` (§21.1 section primitives), route groups `app/(marketing)|(funnel)|(app)` (§21.4), `lib/seo.ts` (metadata + JSON-LD factory), §20.4 perf-budget CI.
- [ ] Lock the **three-tier animation system** (§20.3): Motion for app UI, GSAP+plugins for marketing set pieces, native View Transitions for navigation. Establish the token → primitive → section → page architecture (§21) and the §21.4 repo layout. Enforce §20.4 performance budgets in CI. This foundation is what every later UI task composes — build it deliberately so funnel/app/marketing never re-skin.
- [ ] **Commit** `feat: §20–21 design-system foundation (tokens, primitives, 3-tier animation, section library, perf budgets)`.

### Task 19: Funnel UI polished (§23 moments 0–5) — *upgrade the thin Cycle 1–3 views*
**Files:** `app/(marketing)/page.tsx` (landing/scan entry), `app/(funnel)/scan/[id]/*` + `…/results/*` (replace the thin views).
- [ ] Build to final §23 spec, **replacing** the thin scaffolds: landing scan-entry → scan theater (live SSE artifact feed) → animated Score reveal → blur-locked sections with real headlines → single-field email gate. Reuse the existing SSE/scan/claim APIs unchanged — this is the presentation layer only. Acceptance rule (§5.6): every element answers one of the four questions or moves the Score.
- [ ] **Commit** `feat: polished conversion funnel (§23 moments 0–5) on the design system`.

### Task 20: App shell + four-question dashboard (§21.3)
**Files:** `app/(app)/app/layout.tsx` (sidebar shell + auth guard), `app/(app)/app/page.tsx`, `app/(app)/app/{offer,audience,channels}/*`, `components/report/report-view.tsx`.
- [ ] Persistent sidebar (four questions + Score + Feed + Settings + Billing), View-Transitions content swap, `<Activity>` tab-state preservation, and **one** polished `report-view` component shared free/paid (free blur-lock / paid unlock via `redactReportForTier`, Task 6) — one layout, the upgrade delta visible by construction. Auth-gated.
- [ ] **Commit** `feat: polished app shell + four-question dashboard (§21.3, one free/paid report layout)`.

### Task 21: Plays + billing + engagement UI + the upgrade moment (§23 moments 6–7)
**Files:** `app/(app)/app/{plays,billing,feed}/*`, `app/(marketing)/pricing/*`, `components/report/*` (engagement + badge), modify the report paywall CTA.
- [ ] Polished plays queue (tick-off → `/api/action/[id]/complete`), billing page (checkout/portal buttons), engagement surface (streak, score-history chart, share-badge embed), pricing page, and the §23 moment-7 upgrade flow (paywall "turn your report into an engine — $29/mo" → checkout → `/app` with the first week's plays pre-loaded).
- [ ] **Commit** `feat: polished plays/billing/engagement UI + upgrade moment (§23 moments 6–7)`.

---

## Self-Review (plan author)

**Spec coverage (Cycle 4 / decomposition §3.4 / spec Phase 4):** Stripe Solo+Growth + portal → A ✓ · weekly delta refresh (watermark + Haiku delta + Sonnet-on-novelty, §5.7/§9.6) → B ✓ · action queue + `verify_action`/`track_rank` + `outcomes` + cadence caps → C ✓ · streak + score history + share badge + honesty check (§7.2/§7.3) → D ✓ · **polished §20–23 design system + funnel/app/report/engagement UI** (§20–23, §21.3, §23) → E ✓ · continuous loop 4 / loops wired (§9.5) → Task 9 ✓ · acceptance ("Monday queue, every card passes Critic v2; badges render") → Tasks 10/11/16 ✓.
**Decision locks:** #1 pricing **confirmed** ($29/$99, Growth tier pulled forward; Ads/PR modules stay v1.5). #5 entity/jurisdiction = **deploy-time, explicitly out of this cycle** (Stripe test mode needs no entity).
**Fixture/keyless:** Stripe (checkout/portal/webhook), delta collectors, `verify_action`/`track_rank` all `fixturesEnabled()`-gated → the entire paid loop + refresh runs keyless in dev; real Stripe *test* keys optional for the live path.
**UI (polished, this cycle):** the §20–23 design system + all conversion-path UI are built to final spec in Milestone E (Tim's call — built once, no re-skin); the thin Cycle-1–3 views are upgraded in place. A–D/F are headless engine/APIs/tests that E renders. Only content-marketing pages (teardowns/programmatic/legal) stay Cycle 5, composing this same system.
**Type seams:** `Tier`/`TIER_LIMITS` (T1) → entitlements (T6) → queue/refresh gating; `WatermarkBody` (T7) → delta-collect (T8) → refresh (T9); `WeeklyPlan` (T11) → queue API (T12) + plays UI (T18); `outcomes` (T14) → engagement (T15).
**Carried Cycle-3 follow-ups closed here:** loops wiring (T9), divergence self-match (T9), eval rigor/per-category floor (T19), e2e Inngest test (T19); `APP_URL`-in-prod is a deploy checklist note.
**Confirm-at-build:** Stripe API version + webhook event shapes (lock via a signed-fixture contract test); the novelty threshold + refresh budget caps are tuned against telemetry over time; the Inngest cron cadence (weekly day/time).

---
*Execution: subagent-driven, milestone-grouped, per-task two-stage review; engine first (A→D, F), then the §20–23 design system + polished UI (E) using the ux-designer + frontend-design skills. Live Stripe/vendor verification + the entity/jurisdiction decision are separate deploy-time concerns.*
