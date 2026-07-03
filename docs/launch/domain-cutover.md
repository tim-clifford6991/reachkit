# Domain cutover checklist

Launch ships on the Vercel-assigned domain (`*.vercel.app`). This is the
step-ordered checklist for attaching the real custom domain later. Every claim
below is grounded in a specific file — read it before you start, don't just
copy-paste.

**Two URL sources, not one — this is the #1 gotcha:**

| Var | Consumer | Fallback chain |
|---|---|---|
| `APP_URL` | Stripe checkout/portal URLs, transactional email links | `lib/config/env.ts` → hardcoded default `http://localhost:3000` if unset |
| `NEXT_PUBLIC_SITE_URL` | SEO canonical/OG/JSON-LD, `/report/[slug]` share links | `lib/seo.ts` → `VERCEL_PROJECT_PRODUCTION_URL` → `localhost:3000` |

If you only set one, Stripe emails and share links will point at **different
hosts**. Set both to the same value in the same deploy.

`APP_URL` consumers (grep-verified, `env.appUrl`):
- `lib/billing/checkout.ts:32,33,45,60,89,144,145,148` — scan/upgrade success + cancel URLs
- `lib/billing/portal.ts:30,55` — Stripe billing-portal return URL
- `lib/billing/webhook.ts:193` — "manage billing" link in the plan-change email
- `lib/billing/provision.ts:123,133` — magic-link email `redirectTo` + `/auth/confirm?token_hash=` URL

`NEXT_PUBLIC_SITE_URL` consumer:
- `lib/seo.ts` `SITE.url` — every `buildMetadata()` canonical/OG tag, `organizationLd`/`offerLd`/`articleLd`, and `app/report/[slug]/page.tsx:80,168` (OG image + share URL)

---

## Order of operations

### 1. Register + point DNS (no code/config change yet)
- Buy/confirm the domain. Note: the go-live runbook (`docs/deploy/2026-06-13-go-live-runbook.md`) assumed `reachkit.app` — that's also the verified Resend sending domain (`reports@reachkit.app`, `hello@reachkit.app` in `lib/email/resend.ts` and the contact/affiliates pages). If the final domain differs, the Resend domain must be re-verified for that domain too (see step 4).
- Do this step early — DNS propagation is the long pole, and everything else below is instant once it resolves.

### 2. Vercel — attach the domain
- Project Settings → Domains → add the domain (and `www` / `app.` subdomain if you're using one — see the hero-copy note below for why that distinction matters).
- Add the DNS records Vercel gives you (A/CNAME) at your registrar.
- Set the **production** target: which domain is canonical (apex vs `app.` subdomain) — decide this before step 3, it changes what you write into `APP_URL`.
- Wait for the Vercel dashboard to show the domain as "Valid Configuration" (SSL auto-provisions) before testing anything downstream.

### 3. Vercel env vars — set BOTH url vars, redeploy
- `APP_URL=https://<yourdomain>` (no trailing slash — every consumer above does raw string concatenation, e.g. `${env.appUrl}/app/billing`)
- `NEXT_PUBLIC_SITE_URL=https://<yourdomain>` (must be a `NEXT_PUBLIC_*` var — it's read client- and server-side; `VERCEL_PROJECT_PRODUCTION_URL` is NOT a substitute once a custom domain exists, it still points at the `.vercel.app` alias)
- Redeploy (env var changes don't apply to already-built deployments).

### 4. Resend — re-verify the sending domain
- If the cutover domain differs from `reachkit.app`, add + verify the new domain's DKIM/SPF records in Resend, and update `FROM` in `lib/email/resend.ts` (`reports@<yourdomain>`) and the support address used in `components/app/captured/settings-main.tsx` / `app/(marketing)/contact/page.tsx` / `app/(marketing)/affiliates/page.tsx`.
- Confirm Supabase Auth SMTP (§2 below) also points at the newly-verified domain.

### 5. Supabase Auth — Site URL + redirect allow-list
- Dashboard → Authentication → URL Configuration:
  - **Site URL** → `https://<yourdomain>`
  - **Redirect URLs** (allow-list) → add `https://<yourdomain>/auth/confirm` and `https://<yourdomain>/welcome` (the two `redirectTo`/token-hash targets `lib/billing/provision.ts:123,133` send users to). Keep the existing `.vercel.app` entries until you've verified the new domain end-to-end, then remove them.
- Local dev config (`supabase/config.toml:110-112`, `site_url` / `additional_redirect_urls`) is dev-only — no prod change needed there.

### 6. Stripe — webhook endpoint (checkout/portal URLs need no dashboard change; they're generated from `APP_URL` at request time)
- Dashboard → Developers → Webhooks → add/update the endpoint to `https://<yourdomain>/api/billing/webhook`, subscribed to `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted` (same 4 events as the existing endpoint — see `lib/billing/webhook.ts`).
- Copy the new endpoint's signing secret → `STRIPE_WEBHOOK_SECRET` in Vercel. **Do not delete the old endpoint until the new one has received a live event successfully.**

### 7. Landing hero copy — hardcoded example string
- `components/sections/scan-hero.tsx:57` and `components/sections/captured/landing-html.ts:25` both hardcode the literal text `app.reachkit.io/report/bloom.io` as illustrative mockup copy (not read from any env var). Update both to the real domain's report-URL format once it's decided. These files are outside this branch's scope (owned by the marketing/sections track) — hand off, don't edit directly here.

### 8. Test, in this order
1. Marketing page loads on the new domain, OG image renders (`curl -I https://<domain>/opengraph-image`).
2. `/scan` → funnel → Stripe checkout → confirm `success_url`/`cancel_url` land on the new domain.
3. Trigger a magic-link email → confirm the link's host and that `/auth/confirm` doesn't 400 (Supabase redirect allow-list working).
4. Trigger one Stripe webhook event (Stripe dashboard → "Send test webhook") → confirm 200 + `STRIPE_WEBHOOK_SECRET` verifies.
5. Share a `/report/[slug]` link → confirm the OG card + canonical URL show the new domain.

---

## Rollback

- Vercel: remove the custom domain from Domains (or just leave DNS unpointed) — the `.vercel.app` alias keeps serving traffic unaffected the whole time, so there's no outage risk from the domain step itself.
- Revert `APP_URL` / `NEXT_PUBLIC_SITE_URL` env vars to the previous `.vercel.app` value and redeploy — this is the fast, safe rollback since every consumer reads from these two vars, nothing else needs touching.
- Keep the OLD Stripe webhook endpoint enabled until the new domain is confirmed working (step 6) — this is what makes rollback safe; if you'd deleted it, reverting the domain would silently stop webhook delivery.
- Keep both the old and new Supabase redirect-allow-list entries until the new domain is confirmed (step 5) — same reasoning, auth would break for in-flight magic-link emails otherwise.
