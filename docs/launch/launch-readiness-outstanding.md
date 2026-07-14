# ReachKit — Outstanding Launch-Readiness Report

_Generated 2026-07-13 during the audit session. Scope: topics **not** already covered by the documented invariants/known-risks in `CLAUDE.md` or the tasks instructed this session. Six parallel audits: legal/compliance, billing go-live, security, observability/ops, product/marketing, testing/CI-data._

Each item is tagged **[NEW]** (surfaced by this audit) or **[KNOWN]** (already in `CLAUDE.md`/memory, repeated here for a single launch picture). Prioritised launch-blockers first.

---

## 🔴 P0 — Launch blockers (do not ship without)

### Security

- **[NEW] SSRF via redirect bypass — live-exploitable.** `assertPublicHttpUrl()` validates the *initial* URL only; `fetch()` then follows redirects with default mode. An attacker submits `https://evil.com/x` (passes) that `302`s to `http://169.254.169.254/latest/meta-data/iam/security-credentials/`; the response body is stored in `raw_documents.raw` and surfaced in the report. On Vercel/AWS this leaks IAM credentials. `lib/scan/adapters/fetch-timeout.ts:80-94`, `lib/scan/adapters/site-fetch.ts:36`. **Fix:** re-assert on every redirect hop, or resolve-then-pin and disallow redirects to private ranges.
- **[NEW] SSRF via DNS rebinding.** The guard is a host-*string* check, not a DNS resolution. `attacker.com` with an A-record pointing at `169.254.169.254`/`10.0.0.5` passes the literal-IP/name checks, then Node resolves to the internal target. **Fix:** resolve the hostname, block private/link-local/loopback IPs, and pin the resolved IP for the actual connection.
- **[NEW] No security headers anywhere.** No `headers()` in `next.config.ts`, none in `middleware.ts`. Missing CSP, HSTS, X-Frame-Options/frame-ancestors, X-Content-Type-Options, Referrer-Policy. Public report pages render arbitrary scanned third-party content (titles/descriptions) and are clickjackable with no XSS mitigation.

### Billing (real money)

- **[NEW] No `invoice.payment_failed` / dunning handling.** The webhook switch has no invoice case. Failed renewals rely entirely on Stripe eventually firing `subscription.updated`→`past_due`. No dunning email, no grace period. `lib/billing/webhook.ts:33-50`.
- **[NEW] `past_due` instantly revokes paid access, no grace window.** `entitlementsFor` treats only `active`/`trialing` as active; a transient failed charge immediately locks the user out — churn risk on recoverable cards. `lib/billing/entitlements.ts:63-64`.
- **[NEW] Stripe env is entirely optional / no boot enforcement.** All Stripe keys are `.default("")` in `env.ts:34-42`. A prod deploy missing `STRIPE_WEBHOOK_SECRET`/price IDs won't fail at boot — it fails silently at checkout/webhook time. **Fix:** require the money-path env in prod.
- **[NEW] Trial messaging mismatch.** Checkout sets **no** trial and charges immediately (`checkout.ts:59,150`), but onboarding emails say "your free trial is active" and `trial_will_end` handling exists (will never fire). Customer-facing contradiction. `lib/email/resend.ts:43,53,96`.

### Legal / compliance (EU exposure)

- **[NEW] Analytics fire with zero consent.** PostHog inits immediately whenever `NEXT_PUBLIC_POSTHOG_KEY` is set — no cookie banner, no opt-in, no opt-out UI. `lib/analytics.ts`. Direct GDPR/ePrivacy violation for EU/UK visitors (the EU-style legal pages + `/imprint` imply EU targeting).
- **[NEW] Placeholder Imprint — no legal entity/address/VAT.** `content/legal/imprint.ts` explicitly flags this as pending (sole trader, `noindex` stopgap). Blocks EU Impressum compliance and weakens Terms/Privacy, which defer controller identity + governing law to it.

### Data / migrations

- **[KNOWN→VERIFY] Destructive + additive migrations must be confirmed applied to prod before deploy.** `20260708120000_retire_dead_intel_tables.sql` is `DROP TABLE … CASCADE` on 7 tables (irreversible). The cost-column set (`…_scans_external_api_cost`, `…_cost_event_types`, `…_user_spend_monthly_view`, `…_external_cap_hit`) is **read by live code** (`costedStep`, `/app/diagnostics`); if unapplied, prod errors at runtime. Memory flags PR#39 cost columns as possibly unapplied. **No down-migrations exist → no rollback story.**

---

## 🟠 P1 — Fix before or immediately at launch

### Security

- **[NEW] Auth/magic-link routes are not rate-limited.** `app/api/auth/magic-link/route.ts` calls `signInWithOtp` with only email-format validation. Enables email bombing of any address, Supabase auth-quota exhaustion, and sender-reputation damage. (Only `/api/scan`, `/checkout`, `/billing/trial` use `assertRateLimit`.)
- **[NEW] Inngest endpoint auth depends on an env var being set.** `app/api/inngest/route.ts:15` uses `serve()` with no explicit `signingKey`; signature verification only happens if `INNGEST_SIGNING_KEY` is present in prod. If unset, the function-invocation endpoint is unauthenticated. Assert it's required in prod.

### Observability (currently blind in prod)

- ~~**[NEW] No error-tracking backend wired.**~~ ✅ **RESOLVED — P4 (2026-07-15).** `lib/analytics-server.ts` (`posthog-node`) `captureServerException` wired into the shared scan-pipeline failure handler (`handleScanPipelineFailure` → covers `scan-requested` + `scan-deepen`) and every Inngest `onFailure` (verify-action, weekly-refresh, search-cache-cleanup + new ones on score-pulse & scan-demo). Client boundaries (`app/error.tsx`, `app/(app)/error.tsx`, new `app/global-error.tsx`) call the consent-gated client `captureException`. Fail-safe: no-op when PostHog unconfigured, never throws.
- ~~**[NEW] No health-check / uptime endpoint.**~~ ✅ **RESOLVED — P4.** `GET /api/health` — DB reachability + build info (commit/region), 200/503, `no-store`, prod-exempt.
- ~~**[NEW] No kill switch for scanning.**~~ ✅ **RESOLVED — P4.** `SCANNING_ENABLED` env (default ON; only literal `"false"` disables) gates the HTTP scan entrypoint (`/api/scan` → 503), the on-demand refresh (`/api/app/[id]/refresh` → 503), and skips the weekly-refresh + score-pulse cron fan-outs.
- ~~**[NEW] Cost alerts have no delivery channel.**~~ ✅ **RESOLVED — P4.** `persistCostAlert` (the deduped first-sight) now fans out a PostHog `cost_alert` server event + an optional `COST_ALERT_WEBHOOK_URL` POST (e.g. Slack), on top of console + the persisted scan event. Best-effort.

### Billing

- **[NEW] No webhook idempotency ledger.** Reconcile upserts are logically idempotent, but `onCheckoutCompleted` side effects (`ensureDeepScan`, account create) have no `event.id` dedup table — a concurrent redelivery could double-run provisioning. `webhook.ts:65-98`.
- **[NEW] Account-creation race (webhook vs magic-link).** Both paths call `ensureAuthUser` concurrently with no DB unique-constraint/transaction shown; relies on `auth.admin.createUser` "already registered" handling. A true simultaneous double-create is possible. `provision.ts:30-47`.
- **[NEW] No Stripe Tax / VAT.** No `automatic_tax`/`tax_id_collection`/address collection. Selling into EU/UK without VAT collection is a compliance risk.

### Legal

- **[NEW] Incomplete subprocessor list.** Privacy page omits **Tavily, Inngest, and Vercel** (all data processors). GDPR Art. 28 transparency gap; no DPA link.
- **[NEW] Transactional emails lack CAN-SPAM footer** — no physical address, no unsubscribe (magic-link, scan-ready, trial emails).
- **[NEW] No consent gate before scanning third-party URLs** — no "you own/are authorised for this URL" checkbox; only a Terms clause + rate-limit protect an abuse/liability surface.
- **[NEW] No automated GDPR data export/deletion.** Deletion is a `mailto:`; no self-serve erase/export endpoint — SLA risk against the rights the Privacy Policy promises.

### Testing (masks the exact bugs CLAUDE.md warns about)

- **[NEW] No E2E render test of the conversion surface.** `free-report-e2e.test.ts` asserts only the persisted `report_payload` — the DB-payload-not-render pattern the hard rule warns masks garbage chips/dead zero-states/self-contradicting heroes. The results *screen* is never rendered in a test. No Playwright/Cypress at all.
- **[NEW] Live-mode is never exercised in CI.** Every job runs `REACHKIT_USE_FIXTURES=true`; the two live tests are `describe.skipIf` (never run). Fixtures hid the `linear.app` SPA-fetch bug — the hard rule's whole point.

---

## 🟡 P2 — Should-fix / polish before scale

- **[NEW] Email deliverability unverified in code.** SPF/DKIM/DMARC for `reachkit.app` live only in runbooks. If DNS auth isn't live, magic-links (the *sole* login path) hit spam → activation blocked. Verify live before launch.
- **[NEW] SEO canonicals depend on runtime env.** `lib/seo.ts` falls back to `localhost:3000` if `NEXT_PUBLIC_SITE_URL`/`VERCEL_PROJECT_PRODUCTION_URL` unset — a misconfigured deploy poisons every canonical/OG URL.
- ~~**[NEW] Revenue funnel is uninstrumented.**~~ ✅ **RESOLVED — P4.** The dormant email-gate helpers were repurposed to the payment-first surface: `funnel.paywallViewed` (TrialCta mount) + `funnel.checkoutStarted` (TrialCta + in-app CheckoutButton), and the billing webhook now emits a server-side `subscription_activated` (event.id-deduped → once per purchase). With the already-wired `scan_started`/`scan_facts_shown`/`scan_findings_shown`, the full funnel is measurable.
- **[NEW] No DB backup / PITR / rollback story documented.** Forward-only migrations; a bad DROP is unrecoverable without a manual restore. Confirm Supabase PITR is on and document the runbook.
- **[NEW] No social proof.** Landing leans on a favicon marquee explicitly labelled "until real testimonials exist" — weak credibility for a paid upsell.
- **[NEW] No blog/docs/changelog surface.** For a *discoverability* tool, the absence of an editorial/organic-content surface is an on-brand credibility + SEO gap.
- **[NEW] No `seed.sql`.** Fresh prod DB relies entirely on migrations + auth-trigger. Confirm no reference/lookup data (tiers, price mapping) is assumed present.
- ~~**[NEW] Missing `global-error.tsx` and route-level `loading.tsx`.**~~ ✅ **RESOLVED — P4.** Added `app/global-error.tsx` (root render-crash boundary with its own document shell + token-with-fallback styling + error capture) and `app/(app)/app/loading.tsx` (in-shell content skeleton). Other routes keep their existing per-page Suspense fallbacks.
- **[NEW] `app/design/*` sample routes reachable in prod** (robots-disallowed but publicly loadable). Minor surface-area risk.
- **[NEW] No receipt/invoice email on successful charge** (only magic-link + trial-ending). Stripe may cover this — verify.
- **[MEDIUM] Service-role client (`serverDb()`) bypasses RLS broadly.** RLS is complete (all 24 tables gated — good) but is defence-in-depth only; confirm no user-controlled `.eq()` filters run through `serverDb()`.

---

## ✅ Verified solid (don't re-litigate)

- RLS enabled on all 24 tables; dev routes gated (`blockInProd()` + middleware 404); owner gate fails closed; magic-link `next` param can't open-redirect; no secrets logged; `getUser()` not `getSession()`; no permissive CORS.
- Stripe webhook signature verified; entitlements are Stripe-driven last-write-wins (converges on redelivery); customer portal wired; price IDs env-sourced.
- Terminal-status resilience (invariant #9) genuinely handled; hard budget ceiling (`BudgetExceededError`) stops runaway spend; Inngest retries configured; branded 404/error pages with skew auto-recovery.
- SEO infra is comprehensive (sitemap, robots with AI-crawler allowlist, OG images, JSON-LD, llms.txt, per-page metadata); scan-wait progress UX; blocking onboarding overlay.
- Money/auth paths have unit + integration tests (webhook, entitlements, provision, RLS, auth-trigger); middleware env-throw incident fixed and guarded; CI runs typecheck/lint/arch/design/test/build/bundle + a real-Supabase eval-integration job per PR.

---

## Already-documented (tracked elsewhere — not re-audited here)

Score calibration (unresolved, unenforced) · 4 bundle-budget overages · `audienceProxy` always 0 · 7-table drop pending prod confirm · cohort cache-key stability · branch protection · paid-path verification needs Tim's own account · Supabase Site URL manual set.

---

### Suggested sequencing

1. **SSRF (both vectors) + security headers** — the only truly *exploitable* items; a URL scanner leaking cloud creds is existential.
2. **Cookie consent + imprint legal entity + subprocessor list** — EU launch blockers, low code effort.
3. **Billing: payment-failed handling + grace window + required-in-prod env** — protects revenue and prevents silent breakage.
4. **Observability: error backend + health check + kill switch + alert delivery** — so you can *see* the launch.
5. **Confirm migrations applied + backups/PITR on** — before any prod deploy.
6. **E2E render test of the free report + one live-mode smoke** — close the fixture blind spot.

---

## Post-Phase-1 tracked follow-ups (from the 2026-07-14 security audit)

Phase 1 shipped (PR #61); these residuals were judged acceptable for launch by the audit and are tracked here:
- **DNS-rebind is reduced, not closed.** `resolveAndAssertPublic` checks resolved IPs but does not PIN them for the connection, so a 0-TTL time-of-use rebind survives. True closure = connect-by-pinned-IP (undici `Agent` `lookup` hook). Low exploitability; follow-up.
- **Auth rate-limiter is in-memory (per instance).** Effective ceiling ≈ limit × instances; Supabase's own per-email OTP limit backstops it. Move to a shared store (Postgres counter like `assertRateLimit`, or Upstash) when abuse warrants.
- **Per-email cap ignores plus/dot aliases** (`victim+1@gmail.com`); Supabase shares this blind spot. Minor.
- **MAX_REDIRECTS=5** (was undici's ~20) — watch live scans for legitimate long redirect chains failing.
