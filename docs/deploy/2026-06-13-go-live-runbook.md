# ReachKit — Go-Live Runbook

**Status:** the product is build-complete (Cycles 0–5 merged to `main`) and runs end-to-end **keyless** in local dev. This runbook is the step-by-step to take it **live**. Everything here needs *your* accounts/keys — the code is deploy-ready.

**Order matters:** do §0 (the jurisdiction decision) first — it gates Stripe + the Impressum. Then §1→§9. Each step has a checklist.

---

## §0 — Decisions & domain (do first)

- [ ] **#5 Entity / billing jurisdiction (DE vs UAE).** This is the one open product decision. It determines: the Stripe account's legal entity, the **Impressum** (DE requires a § 5 TMG Impressum; the page already exists with placeholders), tax/VAT handling, and the governing-law clause in Terms. **Decide before creating the Stripe account.**
- [ ] **Domain.** The code hard-codes `https://reachkit.app` (`lib/seo.ts` `SITE.url`, OG images, Terms/Privacy copy). Register `reachkit.app` (or change `SITE.url` + the legal copy if using a different domain). You'll point its DNS at Vercel in §6.

---

## §1 — Accounts to create

- [ ] **Vercel** (hosting) · **Supabase** (prod Postgres + Auth, a NEW project — separate from local) · **Stripe** (billing) · **Inngest** (durable functions / the scan + weekly-refresh pipeline)
- [ ] **Vendor API keys:** Anthropic (LLM) · DataForSEO (SERP/keywords/app-data — pay-as-you-go, ~$50 min deposit) · Tavily (web research) · Product Hunt (OAuth token) · YouTube Data API (a GCP project key) · Voyage AI (embeddings) · Resend (transactional email) · PostHog (analytics)

---

## §2 — Production Supabase

- [ ] Create a new Supabase project. Copy: **Project URL**, **anon key**, **service_role key** (→ `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
- [ ] **Apply the 16 migrations** (they self-enable `pgvector`, create all 15 tables + RLS + the `users.id = auth.uid()` trigger + the HNSW indexes; no Storage buckets are used — `raw_documents` bodies are inline jsonb):
  ```bash
  supabase link --project-ref <your-prod-ref>
  supabase db push        # applies everything in supabase/migrations/ in order
  ```
  Verify in the SQL editor: `select count(*) from pg_extension where extname='vector';` = 1, and the tables `apps, scans, users, raw_documents, fact_sheets, findings, actions, outcomes, monitors, score_snapshots, competitors, evidence, embeddings, scan_events, pipeline_runs` all exist with RLS enabled.
- [ ] **Auth → URL config:** Site URL = `https://reachkit.app`; add `https://reachkit.app/auth/callback` to the redirect allow-list (the magic-link flow lands there).
- [ ] **Auth → SMTP:** configure custom SMTP via **Resend** so magic-link emails send in prod (the default Supabase SMTP is rate-limited and not for production). Use the verified `reachkit.app` domain (see §5 Resend).

---

## §3 — Inngest (the pipeline runtime)

The scan pipeline, weekly delta-refresh (cron), and action-verification all run as Inngest durable functions (`app/api/inngest` serves `scanRequested`, `scanDemo`, `weeklyRefresh`, `actionVerifyRequested`). In dev these run via `npx inngest-cli dev`; in prod they run on Inngest Cloud.

- [ ] Create an Inngest app. Copy **`INNGEST_EVENT_KEY`** + **`INNGEST_SIGNING_KEY`** (the SDK reads these from env automatically — set them in Vercel, §6).
- [ ] After the first Vercel deploy, **sync the app** to Inngest: point Inngest at `https://reachkit.app/api/inngest` (the Vercel↔Inngest integration auto-syncs on deploy, or add the endpoint manually). Confirm all **4 functions** register.
- [ ] Confirm the **`weekly-refresh` cron** (Mondays 09:00 UTC) appears + is enabled — this is what makes paid subscriptions a weekly engine.

---

## §4 — Stripe (live billing)

- [ ] Create the Stripe account under the **§0 entity**. Copy the live **`STRIPE_SECRET_KEY`** (`sk_live_…`).
- [ ] Create **2 recurring products**: **Solo $29/mo** and **Growth $99/mo**. Copy each **price id** → `STRIPE_PRICE_SOLO`, `STRIPE_PRICE_GROWTH`.
- [ ] **Webhook:** add endpoint `https://reachkit.app/api/billing/webhook` subscribed to `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`. Copy the **signing secret** → `STRIPE_WEBHOOK_SECRET`. (The handler reconciles tier from the subscription's price id — see `lib/billing/webhook.ts`.)
- [ ] **Enable the Customer Billing Portal** in the Stripe dashboard (the `/api/billing/portal` route creates portal sessions; the portal must be configured first).
- [ ] **Dry-run in TEST mode first:** with `sk_test_…` + test price ids + `stripe listen --forward-to localhost:3000/api/billing/webhook`, run a full upgrade → webhook → tier flip → `/app` unlock, then a portal session + a cancel. Only then switch the Vercel env to the live keys.

---

## §5 — Vendor API keys

Set each in Vercel (§6). Notes:
- [ ] **Anthropic** → `ANTHROPIC_API_KEY` (Haiku + Sonnet; the pipeline routes models per §13 for the 90% margin).
- [ ] **DataForSEO** → `DATAFORSEO_LOGIN` + `DATAFORSEO_PASSWORD` (SERP/keywords/app-data; fund the account). Optional: `DATAFORSEO_LOCATION_CODE` (default 2840 US), `DATAFORSEO_LANGUAGE_CODE` (default `en`).
- [ ] **Tavily** → `TAVILY_API_KEY` · **Product Hunt** → `PRODUCT_HUNT_TOKEN` · **YouTube Data API** → `YOUTUBE_API_KEY` · **Voyage AI** → `VOYAGE_API_KEY`.
- [ ] **Resend** → `RESEND_API_KEY`; **verify the `reachkit.app` sending domain** (the scan-ready email sends from `reports@reachkit.app`, `lib/email/resend.ts`). Also used for Supabase Auth SMTP (§2).
- [ ] **PostHog** → `NEXT_PUBLIC_POSTHOG_KEY` + `NEXT_PUBLIC_POSTHOG_HOST` (client funnel analytics, `lib/analytics.ts`) and `POSTHOG_KEY` + `POSTHOG_HOST` (server). The §14 funnel-conversion gate is measured here.

---

## §6 — Vercel

- [ ] Import the repo. Framework auto-detects **Next.js 16**. Default build command. **Node: pin to an LTS (20 or 22)** in Project Settings (the dev machine runs a newer Node; prod should use a supported LTS).
- [ ] **Set ALL env vars** (Production scope). The complete list (from `lib/config/env.ts` + Inngest + PostHog):
  - Required always: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  - Paid (required when fixtures off): `ANTHROPIC_API_KEY`, `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`, `TAVILY_API_KEY`, `RESEND_API_KEY`, `PRODUCT_HUNT_TOKEN`, `YOUTUBE_API_KEY`, `VOYAGE_API_KEY`
  - Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_SOLO`, `STRIPE_PRICE_GROWTH`
  - Inngest: `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`
  - Analytics: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `POSTHOG_KEY`, `POSTHOG_HOST`
  - App: `APP_URL=https://reachkit.app`; optional `SCAN_BUDGET_CENTS` (default 150)
  - **`REACHKIT_USE_FIXTURES` — DO NOT SET (or set `false`).** ⚠️ If this is ever `true` in prod, the app serves canned fixtures and the keyless "demo upgrade" path becomes reachable (a paywall bypass). This is the single most important prod env check.
- [ ] Add the **`reachkit.app`** domain + configure DNS; Vercel provisions SSL. Confirm `APP_URL` + `SITE.url` match the live domain.
- [ ] Deploy. Then complete the Inngest sync (§3) + the Stripe webhook points at the live domain (§4).

---

## §7 — Code finalization (the in-code deploy TODOs)

- [ ] **Impressum** (`content/legal/imprint.ts`): replace every `[…]` placeholder (Entity name, address, contact email, VAT/registration, responsible person per § 18 (2) MStV) with the real §0 entity. The page already renders a visible "TODO: finalize at deploy" notice until this is done.
- [ ] **Terms governing law** (`content/legal/terms.ts` §10): set to the §0 jurisdiction.
- [ ] **`lib/seo.ts`:** confirm `SITE.url` = the live domain and replace the `sameAs: ["https://x.com/reachkit"]` placeholder with the real social handle(s).
- [ ] (Optional) tighten `scripts/check-bundle.mjs` marketing budget once perf is measured on prod.

---

## §8 — Pre-launch verification (against a prod/preview deploy, fixtures OFF)

- [ ] **Full real scan, both modes:** paste a real App Store URL and a real website → scan theater → findings → report → email-gate (confirm the magic link arrives via Resend + lands on `/auth/callback` → `/scan/[id]/results`).
- [ ] **Full paid loop:** upgrade (live Stripe checkout) → webhook flips tier → `/app` unlocks drafts → complete a play → verification → Score moves; then the Customer Portal + cancel.
- [ ] **Render smoke-test against prod:** `BASE_URL=https://reachkit.app pnpm test:render` → all 9 routes clean (needs Chrome + the seed creds, or run against a preview URL).
- [ ] **Quality gate:** `pnpm eval` (golden-set R1) green.
- [ ] **GEO:** fetch `/robots.txt` (AI crawlers allowed, `/app`+`/api` disallowed), `/llms.txt`, `/sitemap.xml`; validate the JSON-LD on `/`, `/pricing`, a teardown, a report via Google's Rich Results test.
- [ ] **Cost/margin (§13):** run a handful of real scans; check `pipeline_runs.cost_cents` per scan is within `SCAN_BUDGET_CENTS` and the `[cost-alert]` marker only fires on genuine overruns. Confirm the 90%+ margin holds.
- [ ] **Analytics:** PostHog receiving the §23 funnel events (land → scan → reveal → gate → upgrade).
- [ ] **Inngest:** trigger a scan and watch the `scanRequested` run complete in the Inngest dashboard; confirm the `weekly-refresh` cron is scheduled.

---

## §9 — §14 Phase-0 validation gate (GTM, runs in parallel — Tim)

Launch is gated by the spec's pre-committed criteria (not a code task): waitlist ≥150 from ~4 weeks of genuine community participation; once live, free-scan→email-gate conversion ≥35%; score-badge shares ≥10% of completions; ≥5 explicit paid-intent signals. The landing + free scan ARE the test instrument. Drive via community participation (no ads), instrument with PostHog. If the kill criteria trip, the salvage asset is the teardown content engine + audience.

---

## Go / No-Go checklist (final gate before flipping DNS / announcing)

- [ ] All env vars set in Vercel; **`REACHKIT_USE_FIXTURES` is OFF**
- [ ] 16 migrations applied to prod; pgvector enabled; RLS on
- [ ] Stripe live: 2 products + webhook (signature-verified) + portal enabled; test-mode dry-run passed
- [ ] Inngest synced; 4 functions registered; weekly cron live
- [ ] Resend domain verified; magic links + scan-ready emails deliver
- [ ] Domain + SSL; `APP_URL`/`SITE.url` = live domain
- [ ] Impressum + Terms + `sameAs` finalized to the real entity
- [ ] `pnpm test:render` (prod) 9/9 · `pnpm eval` green · JSON-LD valid
- [ ] One full real scan + one full real upgrade exercised end-to-end
- [ ] Cost within budget; PostHog live

---

*Generated 2026-06-13. Source of truth for env: `lib/config/env.ts`. Pipeline runtime: `app/api/inngest`. The product runs keyless in dev via `REACHKIT_USE_FIXTURES=true`; this runbook turns that off and wires the real services.*
