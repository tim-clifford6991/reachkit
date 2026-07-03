# Launch-readiness audit — A-Z funnel, design consistency, domain, data

**Date:** 2026-07-03 (launch target: this weekend). Sources: 3 code audits (funnel/payment/onboarding · design consistency · routing/domain) + live prod walkthrough (real free scan of bloom.io, all marketing routes).

## 1. What already works (verified)

- **Free scan** end-to-end on prod: anon, rate-limited, staged progress UX (excellent), score + Positioning Mirror render. Free-tier teaser/redaction (`redactReportForTier`) built.
- **Payment-first funnel** fully built: anonymous Stripe checkout (charged immediately) → webhook provisions account + deepens scan (`provisionCheckoutUser`) → magic-link email → `/auth/confirm` → `/welcome` → onboarding/app. Recovery path exists if the magic link is lost (`WelcomeResend`).
- **Entitlements**: tier gates (free/solo/growth), app limits, report redaction, Stripe portal, Solo↔Growth upgrade, sign-out, app switcher.
- **Logged-in nav**: marketing nav shows "Dashboard"/"New scan" when authed (no auto-redirect from `/`, which is standard).
- **App dashboard**: canonical kit, internally consistent, live data (per the depth work).

## 2. Gaps vs the intended launch spec

### Funnel/UX (P0)
| # | Gap | Detail |
|---|---|---|
| G1 | **Onboarding is not a blocking overlay** | It's a standalone page; the gate is a redirect that only intel routes enforce (`resolveIntelContext`). Settings, billing, and the full nav shell are reachable un-onboarded. Required: full-screen overlay over the app, everything locked until complete, enforced at the app layout level. |
| G2 | **No forced post-onboarding sequence** | Intended: onboarding → competitor selection → full-screen "calculating" loading sequence → dashboard. Actual: onboarding → dashboard renders immediately with a "pick your competitors" notice. Competitor selection is skippable; the calculation progress is inline per-page, not a gate. |
| G3 | **Real scan shows 0 ranked fixes, 0 search-gap queries** (bloom.io, full pipeline, live prod) | The hero promises "the 7 fixes that move it"; the results page delivered zero. This is the conversion tease AND the paid deliverable. Root cause in the action-generation path — must be fixed or mitigated before launch. |
| G4 | `/help` footer link 404s | "Help & docs" in the footer of every page. |
| G5 | "Paid but never activated" | Webhook fully provisions; if the user never opens the magic link they're charged with no session. Recovery = `/welcome` resend only. Acceptable for launch; consider a follow-up email later. |
| G6 | "Trial" naming with no trial | `/api/billing/trial`, trial emails exist, but checkout charges immediately (intended). Naming/copy debt only. |

### User management (P1)
- Settings is **display-only**: no change-product-URL, no change-email. No **account deletion** anywhere. Billing/portal/upgrade OK.

### Design consistency (P1) — two token systems coexist
The canonical `--c-*` kit covers the app + most marketing, but System B (Tailwind/`--color-*`) still owns, ranked by visibility:
1. **The funnel core**: `/scan/[id]` scanning + findings screens are System B, with a *different* score gauge than the results screen shows seconds later (gauge whiplash at the moment of highest attention).
2. **The footer** (System B) under a System-A nav on every page.
3. **`/app/onboarding`** — the only System-B screen inside the paid app (and the screen G1 rebuilds anyway).
4. `/login` mixed; `/compare/[slug]` mixed; `/tools/on-page-check` fully System B (indexed).
5. **5 nav-linked `ComingSoon` stubs** (`/roadmap`, `/status`, `/changelog`, `/docs`, `/blog`) in System B.
6. 5+ gauge implementations with different geometry/band hexes; hardcoded hex bleed (captured HTML blobs); duplicate font loading (Geist legacy + per-page Google-Fonts links); ~28 dead legacy components/imports.

### How-it-works (P1)
Exists, on-brand, but **3 shallow cards**. The methodology (18-signal registry, Content/Outreach/SEO weighting, supply→demand→synthesis pipeline, data sources, LLM steps grounded in extracted evidence, deterministic scoring, verify-loop) appears nowhere publicly. No paid-dashboard glimpse on any marketing surface (a stale untokenized capture exists at a hidden design route; the live kit components are the right reuse).

## 3. Domain & navigation — facts and recommendation

**Facts:** No middleware exists; `/app/*` gating is per-page. One `APP_URL` env powers all Stripe/magic-link URLs. Session cookies are host-only. Marketing nav reads auth state (needs the session). Only 2 marketing links point at `/app`. `/app` is already crawl-blocked. **No custom domain is configured anywhere — prod is `reachkit-pi.vercel.app`.** (The landing hero mockup shows `app.reachkit.io` as copy only.)

**Recommendation: launch on the path (`domain.com/app`); defer the subdomain.**
- A subdomain move 48h before launch touches: net-new middleware or a second deployment, cross-subdomain cookie domain (else the marketing nav loses auth awareness), Supabase redirect allow-list, every Stripe success/cancel/portal URL, an `APP_URL` split (marketing base vs app base), absolute-URL fixes in marketing. All risk, no launch-visible benefit at this scale.
- Industry practice: both are common. Subdomains win when you want cookie isolation, separate scaling/CDN policy, or a separate app deployment — none binding today. A later migration is clean because everything routes through `env.appUrl` + two marketing links.
- **The actual pre-launch domain task is attaching a real custom domain** (if owned): add to Vercel, set `APP_URL` + `NEXT_PUBLIC_SITE_URL`, update Supabase auth allow-list + Stripe dashboard URLs, re-issue any hardcoded copy (`app.reachkit.io` hero text).
- Navigation for logged-in users: keep marketing browsable (standard), rely on the existing "Dashboard" affordance; add one small fix — `/login` should bounce straight to `/app` when already authenticated.

## 4. Data migration dev→prod (test user)

Local has the full nudgi.ai dataset (scan, 5 confirmed competitors, all intel tables + warm caches). Plan: script copies the **domain-keyed** rows (shared, user-independent): `domain_intel`, `domain_content_page`, `keyword_gap`, `demand_pocket`, `content_plan_item`, `distribution_plan_item`, `cohort_competitor`, `demand_intel` for the nudgi cohort, plus the cohort's `search_cache` blobs (instant warm cache) — then bind prod's nudgi app (Tim's account): confirmed `competitors` rows + latest scan/score rows mapped to the prod `app_id`. Zero DataForSEO/LLM spend. Verify: prod dashboard fully populated.

## 5. Proposed execution waves (weekend scope)

- **Wave A — funnel P0:** blocking onboarding overlay (kit-styled, enforced in `app/(app)/app/layout.tsx`, nav locked) → forced competitor selection → full-screen calculating sequence (reuse the scan-progress pattern) → dashboard. Fix G3 (0-fixes). Fix `/help`.
- **Wave B — design unification:** funnel scanning/findings → kit + single gauge; footer → kit; login; on-page-check; ComingSoon strategy (per decision); dead-code + font-loading cleanup.
- **Wave C — how-it-works deep-dive + dashboard glimpse:** extended methodology page (kit), live-component dashboard glimpse w/ fixture data, linked from landing/nav.
- **Wave D — launch ops:** custom domain attach + env/Supabase/Stripe URL updates; `/login` authed-bounce; payment E2E test (per decision).
- **Wave E — data migration** (§4) + final full A-Z verification pass.
