# Stripe setup, in test mode

The dashboard steps behind `docs/SPEC.md` §3, in the order to do them, and the one walk that
proves they took. Everything here is clicked by the owner in Stripe's own dashboard: the objects
this product charges against live outside the repository, and no test can reach them.

The code that reads each object is named beside it. Where this page and the code disagree, the
code is right. Bindings and who sets them are `docs/RUNBOOK.md` §3; the boot invariant that
refuses a wrong price is §7, check 6.

**Blocked by two things that are not Stripe's.** No mail leaves until the Resend sending domain is
verified (#325), so the sign-in link at step 7 arrives nowhere before then; and the deep pass is
queued through a port nothing registers yet (#422), so `queueDeepPass` answers `not_wired`.

## 1. Turn test mode on

The dashboard's test-mode toggle. Every object below is created in test mode, and its ids
(`sk_test_…`, `price_…`, `whsec_…`) are test-mode ids: they do not exist in live mode, and live
keys and test keys are never mixed in one environment.

## 2. The product and the price

Product catalogue → add a product named `ReachKit`, then one recurring price on it:

| Field | Value | Read by |
|---|---|---|
| `unit_amount` | `4900` (€49.00) | `PRICE_EUR_CENTS` |
| `currency` | `eur` | `PRICE_CURRENCY` |
| `recurring.interval` | `month` | `PRICE_INTERVAL` |
| `tax_behavior` | `inclusive` — the dashboard's "price includes tax" | `PRICE_OBJECT_SPEC` |

Stripe Tax stays **off** (`automatic_tax: { enabled: false }` in `src/lib/account/checkout/params.ts`).

Copy the price id into `STRIPE_PRICE_ID`. `src/lib/account/checkout/price-object.ts` compares the
live price against those four fields at every boot and the deployment refuses to serve on a
mismatch, naming the field. All four are immutable on a Stripe price, so the fix is always a
**new** price built to this spec with `STRIPE_PRICE_ID` repointed at it — never an edit.

`createPrice(productId)` in `src/lib/account/checkout/ensure-price.ts` creates the same object from
the spec and returns its id; it refuses when the configured price already verifies, so there is
never a second price to split the customer base across.

## 3. The API key

Developers → API keys → the test-mode secret key (`sk_test_…`) → `STRIPE_SECRET_KEY`.

## 4. The webhook endpoint

Developers → webhooks → add an endpoint at `{app origin}/api/stripe/webhook`, subscribed to
exactly these seven events — the closed list in `src/lib/account/provisioning/events.ts`:

| Event | What it does |
|---|---|
| `checkout.session.completed` | opens the account — the only provisioning path |
| `customer.subscription.created` / `.updated` / `.deleted` | move `paid_through` and `plan_status` |
| `invoice.paid` / `invoice.payment_failed` | the same two columns |
| `checkout.session.expired` | received and deliberately acted on by nothing |

Any other event answers `400` with `unknown_event`, which Stripe records as a failed delivery — so
subscribing to more than these seven manufactures noise, not coverage.

The endpoint's signing secret (`whsec_…`) → `STRIPE_WEBHOOK_SECRET`. It is the whole trust
boundary: a wrong secret makes every delivery a `400` whose log line reads
`{"event":"stripe_webhook","outcome":"signature"}`.

## 5. The customer portal

Nothing is configured by hand. `src/lib/account/billing/portal.ts` creates its own portal
configuration from `PORTAL_FEATURES` the first time a customer presses the billing control: card
update on, customer update on for address, tax id and email, invoice history on, cancellation on
in `at_period_end` mode, plan switching off. Confirm those in the dashboard after the first press;
do not edit the configuration there, because the next process to start recreates it from the code.

## 6. Where the walk runs

Test-mode keys never go on the production target — `reachkit.app` and `dev.reachkit.app` are one
Vercel target holding live keys (`docs/RUNBOOK.md` §2). Two places will take them:

- **Locally.** `.env.local` with the three test-mode Stripe rows, `npm run dev`, and
  `stripe listen --forward-to localhost:3000/api/stripe/webhook`, whose printed `whsec_…` is the
  `STRIPE_WEBHOOK_SECRET` for that session. Localhost is not a real deployment, so the Inngest
  bindings are not demanded of it.
- **A preview deployment**, with the test-mode rows bound on the preview target. Git deployments
  are off, so it is created with the Vercel CLI, and `NEXT_PUBLIC_APP_URL` on that target must be
  the URL the preview actually answers on or the sign-in links point elsewhere.

## 7. The walk

1. Open `/pricing` and press Start. (`/scan/{domain}` states the same offer from the same card,
   but the report passes it no action, so its Start has no destination yet.)
2. Pay on Stripe's page with `4242 4242 4242 4242`, any future expiry, any CVC. The country is
   required; the VAT field may be left empty. Nothing else is asked, and no account exists yet.
3. The browser returns to the page you started from with `?checkout=complete`.
4. The webhook logs `{"event":"stripe_webhook","outcome":"provision"}`, then
   `{"event":"provision","outcome":"created"}`.
5. The `users` row carries the address, the customer id, `checkout_session_id` and a `paid_through`
   taken from the subscription; a `sites` row carries the scanned domain, or a null domain for a
   purchase with no report behind it.
6. A `magic-link` mail leaves for the paying address. It is late or absent before #325.
7. Opening the link lands on `/auth/confirm`, which sets the session and redirects a
   never-signed-in customer to `/setup`. A link lasts 24 hours and issuing a new one spends every
   older one.

## 8. The three checks after it

- **A second payment from the same address.** `provision` logs `second_purchase`: the subscription
  the second payment created is cancelled immediately in Stripe, one `account` mail says so, and
  no sign-in link and no deep pass are sent. There is no second subscription in the dashboard.
- **The portal.** `/app/settings` → the billing control → Stripe's portal → back to
  `/app/settings`, still signed in. The five features of §5 are the only ones offered.
- **The access gate.** `users.paid_through > now()` alone (`src/lib/account/billing/gate.ts`).
  Move the column back by hand in the database and the signed-in surfaces refuse; move it forward
  and they serve. `plan_status` changes nothing either way.

## 9. When a step does not happen

- Nothing opened after a payment: the 24-hour backstop provisions from the session that already
  paid and logs `provisioning_backstop_fired` — its firing means the webhook path failed.
- Paid but never signed in: the 15-minute chase writes again with a working link.
- The deployment 500s at the door: `docs/RUNBOOK.md` §7 — check 6 is this price.

When the walk has been run, the owner records it on issue #319 and in `docs/RUNBOOK.md` §11.
