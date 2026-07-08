# Stripe test-mode E2E runbook — revenue path (Workstream B2)

The revenue path (`checkout` → `webhook` → `provisionCheckoutUser` →
`ensureDeepScan` → Resend magic-link email) has only ever been exercised via a
direct DB entitlement grant (`scripts/prelaunch-validate.md` §3) — real Stripe
Checkout has never run against this codebase. This is the exact loop to close
that gap with **test-mode** keys. No real charge is ever created.

Covers **Path A (scan-first)**: `POST /api/scan/[id]/checkout` → anonymous
checkout bound to an existing free scan. This is the primary funnel and
exercises every hop asked for in the audit (checkout metadata, webhook
signature + event routing, account provisioning, scan deepening, the
onboarding email/link). Path B (`POST /api/billing/trial`, no scan) and the
legacy authenticated in-app upgrade (`POST /api/billing/checkout`) share the
same `createCheckout`/webhook machinery — see the note at the end for what
differs.

## Prerequisites

1. **Stripe test mode** — toggle "Test mode" in the Stripe dashboard for the
   whole session below. Nothing here should ever touch live mode.
2. **Test-mode price IDs** — Products → Solo / Growth must have test-mode
   prices (Stripe keeps live and test catalogs separate; create/copy them if
   they don't exist yet). Grab their `price_...` ids.
3. **A webhook source**, either:
   - **Stripe CLI** (fastest for local dev): `stripe listen --forward-to
     <APP_URL>/api/billing/webhook`. Prints a `whsec_...` signing secret —
     use it as `STRIPE_WEBHOOK_SECRET` for the target the CLI is forwarding
     to.
   - **Dashboard endpoint** (needed for a Vercel preview deploy, since the CLI
     can't forward to a URL it doesn't run next to): Developers → Webhooks →
     Add endpoint → `<preview-url>/api/billing/webhook`, events:
     `checkout.session.completed`, `customer.subscription.created`,
     `customer.subscription.updated`, `customer.subscription.deleted`,
     `customer.subscription.trial_will_end`. Copy its signing secret into the
     preview deployment's `STRIPE_WEBHOOK_SECRET` env var and redeploy.
4. **Target env vars** (preview deployment or local `next dev`, never prod):
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...          # from step 3
   STRIPE_PRICE_SOLO=price_test_...
   STRIPE_PRICE_GROWTH=price_test_...
   REACHKIT_USE_FIXTURES=false              # or unset — fixtures mode bypasses Stripe entirely
   ```
   `RESEND_API_KEY` should be a real (or Resend test-mode) key so step 6 is a
   real email; without it the app throws on send (`sendMagicLinkEmail` only
   no-ops in fixtures mode, not just because Resend is unset).
5. A disposable test email you can read (Gmail `+tag` works — Gmail ignores
   the tag so it lands in your real inbox but is identifiable).

## Steps

### 1. Seed a free scan
```bash
APP=<target-url>   # local http://localhost:3000 or the preview URL
curl -s -X POST "$APP/api/scan" -H 'content-type: application/json' \
  -d '{"store_url":"example.com"}'
# → { "scan_id": "...", "slug": "..." }
```
Poll `scans` until `status = 'done'`.

### 2. Start checkout (Path A)
```bash
curl -s -X POST "$APP/api/scan/<scan_id>/checkout" -H 'content-type: application/json' \
  -d '{"plan":"solo","interval":"month"}'
# → { "url": "https://checkout.stripe.com/c/pay/cs_test_..." }
```
`createAnonymousCheckout` (`lib/billing/checkout.ts:23`) sets
`metadata: { plan, interval, scanId }`, `client_reference_id: scanId`,
`success_url: <APP>/welcome?session_id={CHECKOUT_SESSION_ID}`, and
`cancel_url: <APP>/scan/<scan_id>`. Open the returned `url` in a browser.

### 3. Complete checkout with a Stripe test card
- Email: your disposable test address.
- Card: `4242 4242 4242 4242`, any future expiry (e.g. `12/34`), any 3-digit
  CVC, any ZIP/postal code.
- Submit. You land on `<APP>/welcome?session_id=cs_test_...` — "Check your
  email to log in".

### 4. Expected webhook events, in order

| # | Event | Handler | Effect |
|---|-------|---------|--------|
| 1 | `checkout.session.completed` | `onCheckoutCompleted` (`lib/billing/webhook.ts:65`) | No `metadata.userId` (anonymous) → resolves email from `customer_details.email`, calls `provisionCheckoutUser({ email, scanId, stripeCustomerId, stripeSubscriptionId, sendMagicLink: true })` |
| 2 | `customer.subscription.created` | `onSubscriptionUpsert` (`lib/billing/webhook.ts:105`) | Resolves user by `stripe_customer_id` (bound in step 1), sets `tier`, `subscription_status`, `current_period_end`, `stripe_subscription_id` |

`provisionCheckoutUser` (`lib/billing/provision.ts:67`) in step 1 does, in
order: create-or-find the auth user for the email → bind
`stripe_customer_id`/`stripe_subscription_id` → `linkScanToUser` (adds the
scan's `app_id` to `users.app_ids`) → `ensureDeepScan(scanId)` (flips
`scans.tier = 'full'`, enqueues the `scan/deepen` Inngest event) → send the
onboarding magic-link email.

Note: Stripe doesn't guarantee event ordering. If `customer.subscription.created`
somehow arrives before `checkout.session.completed`, `updateUserByCustomer`'s
`createIfMissing` defensive path (`lib/billing/webhook.ts:264`) creates the
account from the Stripe customer's email itself, so tier/status are never
silently dropped. `expect status: 'active'` here — the test price has no
`trial_period_days` configured (checkout charges immediately by design,
`lib/billing/checkout.ts:59`), so don't expect `trialing` unless you've
explicitly configured a trial on the test price.

### 5. SQL verification, per hop

After event 1 (`checkout.session.completed` processed — check Stripe CLI /
dashboard logs for a `200`):
```sql
select id, email, stripe_customer_id, stripe_subscription_id, app_ids, tier, subscription_status
from users where email = '<test-email>';
```
Expect: the row exists, `stripe_customer_id`/`stripe_subscription_id`
populated, `app_ids` contains the scanned app's `app_id`. `tier`/
`subscription_status` are still pre-purchase values — event 2 sets those.

```sql
select id, tier, deepened_at from scans where id = '<scan_id>';
```
Expect `tier = 'full'` immediately; `deepened_at` populates once the async
`scan/deepen` Inngest run finishes (poll — seconds, not instant).

After event 2 (`customer.subscription.created` processed):
```sql
select tier, subscription_status, current_period_end from users where email = '<test-email>';
```
Expect `tier = 'solo'` (or `growth`), `subscription_status = 'active'`,
`current_period_end` in the future (~1 month out for the monthly test price).

### 6. Email + magic-link verification
Check the test inbox (or the Resend dashboard's send log) for "Your ReachKit
login link". Click it: it opens
`<APP>/auth/confirm?token_hash=...&type=magiclink&next=%2Fwelcome`
(`app/auth/confirm/route.ts`), which calls `verifyOtp`, sets the session
cookies, and redirects to `/welcome` → now authenticated → `/welcome`
redirects to `/app` (`app/welcome/page.tsx:47`). Confirm: signed in as the new
account, the scanned app appears in the dashboard, and (once `deepened_at` is
set) the full paid report is available rather than the free teaser.

### 7. Idempotency / redelivery check
Trigger a redelivery of the `checkout.session.completed` event — Stripe
dashboard → the event → "Resend", or `stripe events resend evt_...` via the
CLI. Confirm:
- The webhook still returns `200`.
- `users` row is unchanged (no duplicate row; last-write-wins on the same
  columns).
- **No second onboarding email is sent.** `provisionCheckoutUser` now guards
  this explicitly (see "Findings" below) — before this pass, every
  redelivery re-sent the login email.

### 8. Cleanup
```sql
delete from users where email = '<test-email>';
delete from scans where id = '<scan_id>';
delete from apps where id = '<app_id>';
```
Delete the auth user via the Supabase dashboard (or
`serverDb().auth.admin.deleteUser(<id>)`). Test-mode Stripe customers/
subscriptions never bill — safe to leave, or delete via the dashboard for
tidiness.

### Path B / legacy path notes
- **Path B** (`POST /api/billing/trial`, no scan): identical webhook flow
  minus the `scanId` — no `linkScanToUser`/`ensureDeepScan` call. The user
  runs their first scan from inside the dashboard instead.
- **Legacy in-app upgrade** (`POST /api/billing/checkout`, requires an
  existing session): `createCheckout` (`lib/billing/checkout.ts:68`) sets
  `metadata.userId`, so `onCheckoutCompleted` takes the "legacy" branch — it
  just binds the Stripe ids by `userId` (no account creation, no email; the
  user is already signed in). Verify with the same event-2 SQL check above.
  Note: neither this route nor its UI check server-side whether the user
  already has an active subscription before creating a new Checkout Session —
  the UI (`BillingActions`, `app/(app)/app/billing/billing-actions.tsx:220`)
  only renders the upgrade buttons when `!isActivePaid`, but a direct POST to
  `/api/billing/checkout` from an already-subscribed account would create a
  second Stripe subscription. Not exercised by this runbook; flagged for a
  follow-up (see below).

## Findings from this audit

### Fixed
- **`lib/billing/provision.ts` — `provisionCheckoutUser` resent the
  onboarding magic-link email on every `checkout.session.completed`
  delivery**, including Stripe's at-least-once redeliveries (retries on a
  non-2xx response, or a manual "Resend" from the dashboard). The module's own
  doc comment claimed everything was "idempotent... so the webhook can be
  redelivered without creating duplicates," but that only held for the DB
  writes (`update` is last-write-wins) and `ensureDeepScan`/`linkScanToUser`
  (both explicitly idempotent) — the email send had no such guard. Fixed by
  checking, before sending, whether the incoming `stripeCustomerId` is already
  bound to the resolved user; if so this is a redelivery of an
  already-processed event and the send is skipped. Covered by
  `lib/billing/provision.test.ts` (new).

### Verified correct, no change needed
- **Signature verification** (`app/api/billing/webhook/route.ts`): reads the
  raw request body (required — re-serialization would break the HMAC),
  verifies `stripe-signature` via `constructEvent` against
  `STRIPE_WEBHOOK_SECRET` *before* touching `handleStripeEvent`, and returns
  `400` without dispatching on failure. Already covered by
  `app/api/billing/webhook/route.test.ts`.
- **DB-write idempotency** in `lib/billing/webhook.ts`: every handler is a
  pure last-write-wins reconciliation from the current Stripe object state
  (no read-modify-write races), so redelivered/out-of-order
  `customer.subscription.*` events converge correctly. Confirmed by the
  existing `lib/billing/webhook.test.ts` suite.
- **Checkout metadata**: `createAnonymousCheckout` correctly carries
  `scanId`/`plan`/`interval` in `metadata` and `scanId` in
  `client_reference_id` (belt-and-suspenders — the webhook reads
  `metadata.scanId ?? client_reference_id`); `createCheckout` correctly
  carries `userId`. Price resolution (`priceIdFor`) degrades gracefully to
  monthly when an annual price id isn't configured.
- **Cross-device magic-link flow**: the admin-generated `token_hash` +
  `verifyOtp` flow (`lib/billing/provision.ts:139`,
  `app/auth/confirm/route.ts`) is correctly decoupled from the PKCE
  `?code` flow used by in-browser login, so the emailed link works from any
  device with no client-side `code_verifier`. `next` param is sanitized to
  relative paths only (open-redirect guard).
- **`ensureDeepScan`/`linkScanToUser`**: both are genuinely idempotent — the
  former via the `scans.deepened_at` sentinel (with a legacy `actions`-count
  fallback), the latter via an `app_ids` containment check — safe to call
  from every `provisionCheckoutUser` invocation, including retries.
- **Defensive account creation**: if `customer.subscription.*` races ahead of
  `checkout.session.completed` (event ordering isn't guaranteed), the
  subscription-event handler creates the account from the Stripe customer's
  email itself rather than silently dropping the tier update.

### Documented, not fixed (pre-existing, already triaged in the launch plan)
These were surfaced again during this audit but are already tracked as
accepted launch debt in `docs/plans/2026-07-07-launch-readiness.md` (G5/G6) —
not fixed here to stay in scope and low-risk:
- **G5 — "paid but never activated":** if the user never opens the magic
  link, they've been charged with no session ever created. Recovery is the
  `/welcome` "resend" button only; no follow-up email nudge yet.
- **G6 — "trial" naming with no trial:** `/api/billing/trial`'s name, and
  more notably the onboarding email copy itself
  (`lib/email/resend.ts:43`: *"Welcome to ReachKit — your free trial is
  active"* / *"Your free trial is active"*) both say "trial," but checkout
  charges the card immediately — `lib/billing/checkout.ts` has no
  `trial_period_days` and explicitly comments "No free trial... charged
  immediately at checkout." The email text is a direct, customer-facing
  contradiction of that — worth a copy fix before launch even though it's
  filed as non-blocking debt.
- **New, same family as the above, not previously filed:**
  `/api/billing/checkout` (the legacy in-app upgrade route) has no
  server-side guard against an already-actively-subscribed user creating a
  second Stripe subscription; only the UI hides the button. Low blast radius
  (requires a signed-in user manually crafting the request) but worth a
  follow-up — either check `entitlementsFor(userId).active` in the route and
  redirect to the portal, or rely on Stripe's `customer` uniqueness plus a
  manual reconciliation script.
