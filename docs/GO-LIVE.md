# The go-live gate — what must be true before a stranger pays

Two things stand between this product and a stranger paying for it, and neither has been exercised:
**production runs Stripe in test mode**, and **no mail has ever been seen in a real inbox**. This
page is the checklist for both, plus the rest of the gate, written to be worked through in order.

Operating the product afterwards is `docs/RUNBOOK.md`; what the product does is `docs/SPEC.md`.
Nothing here is read by the running app.

**Every row is marked.** **[owner]** is an act in a vendor dashboard — only the owner holds those
accounts, and nothing in this repository can do it. **[code]** is this repository's, and where a
row says *fixed in #889* the change is in the same PR as this page. **[protected]** is a row that
turned out to need nothing: it names what already protects it, so the next reader does not go
looking again.

---

## 1. Stripe: the switch from test mode to live

### 1.1 Where it stands

`STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID` and `STRIPE_WEBHOOK_SECRET` on the production target are the
test-mode values. Test-mode and live-mode objects are separate universes in Stripe: a test price id
does not exist in live mode, a test key cannot read a live object, and a test-mode webhook secret
verifies no live delivery. So **no real customer can pay today**, and the live path has never run.

The dogfood account carries `cs_test_…` and a test-mode `sub_…`, which is the same fact seen from
the database.

### 1.2 What must be re-created in live mode — nothing carries over

| Object | Who | Notes |
|---|---|---|
| The product `ReachKit` | **[owner]** | Product catalogue, live mode. A test-mode product is not visible in live mode. |
| One recurring price on it | **[owner]** | `unit_amount 4900` · `currency eur` · `recurring.interval month` · `tax_behavior inclusive` — the four fields `PRICE_OBJECT_SPEC` compares at every boot (`src/lib/account/checkout/price-object.ts`). All four are immutable on a Stripe price: a wrong one is fixed with a **new** price, never an edit. `createPrice()` in `ensure-price.ts` builds exactly this object from the spec if the owner would rather not type it. |
| The webhook endpoint | **[owner]** | `https://reachkit.app/api/stripe/webhook`, subscribed to exactly the seven event types in `src/lib/account/provisioning/events.ts`. Its signing secret is a **new** `whsec_…`. |
| The customer portal configuration | **[protected]** | Nothing to create. `src/lib/account/billing/portal.ts` creates its own configuration from `PORTAL_FEATURES` the first time a customer presses the billing control, in whichever mode it is running. Confirm it in the dashboard afterwards; do not edit it there, because the next process to start recreates it from the code. |
| Stripe Tax | **[owner]** | Stays **off**. `automatic_tax: { enabled: false }` is stated in `src/lib/account/checkout/params.ts` and asserted key-by-key by its test; §11 puts Stripe Tax outside the MVP. |

The customer's `cus_…` ids, subscriptions, invoices and the dogfood account do **not** carry over.
Whatever the test-mode dogfood holds, the first live payment is the first live customer.

### 1.3 The exact switch, in order

1. **[owner]** Create the live product and price (1.2). Copy the new `price_…`.
2. **[owner]** Create the live webhook endpoint (1.2). Copy the new `whsec_…`.
3. **[owner]** Developers → API keys, live mode → copy the live secret key.
4. **[owner]** In Vercel, on **both** targets (`docs/RUNBOOK.md` §3: every binding must exist on
   both, or a target cannot build), replace all three rows **together**:
   `STRIPE_SECRET_KEY` · `STRIPE_PRICE_ID` · `STRIPE_WEBHOOK_SECRET`.
   **The three move as one.** Any two of them crossed is a broken deployment, and two of the three
   crossings are silent without step 5's refusal.
5. **[owner]** Redeploy. A binding is read once, at module load, so an existing instance keeps the
   old value until it is replaced.
6. **[owner]** Watch the boot. The runtime log carries one line per invariant; the one to find is
   `{"event":"boot_invariants","check":"checkout","outcome":"checked"}`. Anything else is 1.5.
7. **[owner]** Stripe's dashboard, live mode → Settings → **Customer emails**: decide whether
   Stripe sends the paying customer their invoice and receipt. Stripe sends no customer email in
   test mode at all, so this is a setting the test-mode walk cannot have exercised, and ReachKit
   sends no receipt of its own — the only mail it sends after a payment is the sign-in link.

Do **not** switch one binding "to test it". Step 4 is atomic by intent.

### 1.4 What differs between the modes that the code must handle

| Difference | State today |
|---|---|
| **SCA / 3-D Secure** | **[protected], with one window named.** A European card in live mode is challenged inside Stripe Checkout, before the session completes, so the ordinary case never reaches this product's code. Two checks stand behind it anyway: the webhook routes only `checkout.session.completed`, and `recordCheckoutFacts` refuses any session whose `status` is not `complete` and opens nothing (`src/lib/account/checkout/record.ts`) — "neither trusts the other to have checked". **The window:** where a first payment needs action *after* the session completes, the subscription arrives `incomplete`; `recordedStatus` files that as `past_due` and `openSubscription` stamps `paid_through` from the subscription's own period end, which is a month out. Access is `paid_through` alone (ADR-050), so that is a month of access on an unpaid first invoice. That sits inside the owner's standing deferral of dunning (below) and is **not** changed here — it is written down so the deferral is made with its consequence in view. |
| **Declines and dunning** | **[owner ruling, deliberately nothing.]** `invoice.payment_failed` records the status and returns: no retry, no downgrade, no revocation, and `src/lib/account/billing/events.ts` has a test that fails if any behaviour is added to that arm. Access holds until `paid_through` passes whether or not a renewal was paid. Stripe's own Smart Retries and its dunning emails are the whole of the recovery, and they are **[owner]** settings in the live dashboard. One mail does go out — the `payment-failed` retention mail — and it is sent by the retention tick reading `plan_status`, never by the webhook. |
| **VAT / Stripe Tax** | **[protected].** The price is `tax_behavior: inclusive` with Stripe Tax off: €49 is what the customer pays wherever they are, and the tax comes out of it rather than being added on top. That is the whole point of the inclusive ruling — switching tax on later must never raise an existing customer's bill. The VAT field is collected (`tax_id_collection: { enabled: true }`) and recorded **verbatim, unvalidated** (`record.ts`), so the records exist when registration is set up. |
| **The invoice the customer receives** | **[owner].** Stripe's, not ours — and Stripe sends no customer email in test mode, which is why this is invisible until live. See step 7 above. The billing portal's invoice history is on either way (`PORTAL_FEATURES`). |
| **Currency** | **[protected].** `currency: "eur"` is passed on every session and is the same wherever the buyer is; `PRICE_CURRENCY` is one pin in `src/lib/config/constants.ts` and the boot compares the live price against it. |
| **The €49 price object** | **[protected].** `PRICE_OBJECT_SPEC` is built from the pins, not from four literals, and `assertPriceMatchesSpec` compares the live object field by field at every boot. |

### 1.5 What the boot invariant does when a live key meets a test price id

**This was the one illegible failure, and it is fixed in #889.**

*Before:* `stripe().prices.retrieve()` answered `resource_missing`, which is not a
`PriceObjectMismatch`, so `src/instrumentation.ts` logged
`{"event":"boot_invariants","check":"checkout","outcome":"unchecked","reason":"StripeInvalidRequestError"}`
**and the deployment served.** A live key crossed with a test price id — the exact half-switched
state step 1.3 warns about — produced one log line naming an error class, indistinguishable from a
Stripe outage, on a deployment whose every screen rendered and whose Start button failed for every
visitor. The first sign of it would have been a stranger pressing Start and getting nothing.

*Now:* the vendor's `resource_missing` is told apart from a vendor that could not be read at all.
It throws `PriceObjectUnknown`, the boot refuses, `OWNER_EMAILS` is told, and the message names the
mode of the configured key — derived from the key's own prefix, never the key itself:

> Stripe answered that the price behind STRIPE_PRICE_ID does not exist. The configured
> STRIPE_SECRET_KEY is a live-mode key, and a price created in the other mode is not reachable with
> it — test-mode and live-mode objects are separate.

A vendor that genuinely could not be read is unchanged: logged `unchecked`, and the deployment
serves. A read that did not happen establishes nothing, and a hard dependency on one Stripe
round-trip would turn a Stripe outage into an outage of screens that take no payment.

**Two crossings the boot still does not catch, and what does catch them.**

| Crossing | What happens |
|---|---|
| Live key, live price, **test** `STRIPE_WEBHOOK_SECRET` | The boot passes — the webhook secret is not a vendor object and nothing can verify it before a delivery arrives. The first live payment's webhook answers `400` and logs `{"event":"stripe_webhook","outcome":"signature"}`, so **the account never opens**. It is caught by the 24-hour provisioning backstop, which provisions from the session that already paid and logs `provisioning_backstop_fired` — a line whose firing *means the webhook path failed*. That is a day's delay for a paying customer, so it is step 6's line to watch on the first real payment (1.6), not something to discover later. |
| Test key, test price, live webhook secret | Same shape in reverse; same detection. |

### 1.6 The first real payment — what to watch, in order

**[owner]**, one payment on a real card, watching the production runtime log:

1. `{"event":"stripe_webhook","outcome":"provision","type":"checkout.session.completed"}` — the
   delivery verified. `"outcome":"signature"` instead means the webhook secret is crossed (1.5).
2. `{"event":"provision","outcome":"created"}` — the account opened.
3. The `users` row: the paying address, `stripe_customer_id`, `checkout_session_id`, and a
   `paid_through` about a month out. A `paid_through` still on the column's default means
   `openSubscription` could not read the subscription — look for
   `{"event":"billing_open_subscription","outcome":"vendor"}`.
4. The `magic-link` mail, in a real inbox. This is where §2 stops being a separate section: a live
   payment whose sign-in link lands in spam is a customer who paid and cannot get in.
5. The deep pass, queued and never awaited — the link is issued first on purpose, because the link
   is owed in 60 seconds and a pass is minutes of vendor work.
6. `{"event":"provisioning_backstop_fired"}` **must not appear.** If it does, steps 1–2 did not
   happen and the payment was rescued a day late.

### 1.7 Refunding it cleanly

A refund is three acts, and **two of them are not automatic**, because no refund event is in the
subscribed seven and `users.paid_through` never moves backwards from a vendor event (that rule is
what stops an out-of-order redelivery taking access from somebody who has it).

1. **[owner]** Refund the charge in the Stripe dashboard.
2. **[owner]** Cancel the subscription in the dashboard, so nothing renews. Cancelling through the
   product's own portal sets `cancel_at_period_end` and deliberately keeps access to the paid-through
   date, which is not what a refund means.
3. **[owner]** Move `users.paid_through` back to `now()` in the Supabase SQL editor. Nothing else
   does: `endSubscriptionNow()` is the one writer that moves the gate backwards and it is reached
   only by account deletion. Until this is done, a refunded customer keeps access for the month
   they were refunded.

Deleting the account instead does all three properly — the vendor is stopped first, then the gate
moves — but it also purges the customer's data, which a refund does not ask for.

---

## 2. Mail

### 2.1 Domain authentication for `reachkit.app` in Resend

**[owner]**, in Resend → Domains → `reachkit.app`, and then in the DNS zone. Nothing here is code:
`src/lib/mail/vendor/resend.ts` makes one API call and holds no DNS knowledge.

| Record | What to check | Where |
|---|---|---|
| **DKIM** | Resend's `resend._domainkey` TXT record is published and Resend shows the domain **Verified**. Unverified, every send is refused by the vendor and the product logs `{"event":"mail_send","outcome":"rejected"}`. | Resend's own domain page; `dig TXT resend._domainkey.reachkit.app` |
| **SPF** | The TXT record on Resend's return-path subdomain (`send.reachkit.app` by default) includes `include:amazonses.com` exactly as Resend states it. Not on the root — a second `v=spf1` record on one name is a permanent error, and a root SPF that does not name the sender fails alignment. | `dig TXT send.reachkit.app` |
| **Return-path (bounces)** | The MX record on that same subdomain, pointing at Resend's feedback host. **This is what makes SPF align with the From domain**, which is what DMARC checks. Skipping it is the usual cause of "DKIM passes, DMARC still fails". | `dig MX send.reachkit.app` |
| **DMARC** | A `_dmarc.reachkit.app` TXT record exists. Start at `v=DMARC1; p=none; rua=mailto:<an address the owner reads>` for the first week — a policy that reports before it quarantines — and move to `p=quarantine` once the reports are clean. Gmail's and Yahoo's sender rules ask every sender for SPF *or* DKIM with a valid forward-confirmed reverse DNS, and ask a bulk sender (5,000 a day to Gmail) for both, for DMARC with alignment, and for one-click unsubscribe. ReachKit is nowhere near bulk volume, so what is at stake here is the spam folder rather than a refusal — which is exactly what §2.3 measures. | `dig TXT _dmarc.reachkit.app` |
| **`MAIL_FROM` is a mailbox somebody reads** | `hello@reachkit.app` must receive mail, not only send it. `optout.invalid` tells a reader "Reply to any ReachKit email with \"stop\" and we'll stop by hand" — a sentence that is false if nobody reads the mailbox. | Send it a mail and read it |

Issue #325 (closed) got the domain to sending. DMARC and the return-path alignment are established
as of the dated line below. What §2.3 measured, the day before that line, was rendering.

2026-09-23  **DMARC published, report-only** (owner ruling, #1043). Cloudflare now holds the TXT record
`_dmarc.reachkit.app` = `v=DMARC1; p=none; rua=mailto:hello@reachkit.app; fo=1`. Before this the name
fell through to the wildcard CNAME. `dig TXT _dmarc.reachkit.app` returns that string from the
authoritative server, from `1.1.1.1` and from `8.8.8.8`. One mail was sent through Resend from and to
`hello@reachkit.app`. Cloudflare Email Routing (MX `route{1,2,3}.mx.cloudflare.net`) forwarded it to
the owner's inbox, where it arrived in the Inbox and not in spam. Gmail recorded DKIM pass for
`d=reachkit.app` (selector `resend`), SPF pass for `send.reachkit.app` and `dmarc=pass (p=NONE)` for
`header.from=reachkit.app`, which means the return path aligns. **Next:** read the first week's aggregate reports at `hello@` and move to `p=quarantine` if every
source aligns. That is #1048. It is `later`, not on the Launch milestone: `p=none` already passes.

### 2.2 One-click unsubscribe, and the suppression list

**Established from the code, and one half was missing.**

| | State |
|---|---|
| The suppression store | **[protected].** `email_suppressions` is in the schema and applied (`supabase/migrations/20260905120100_suppressions_email.sql`): `email` primary key, forced lower-case by a check constraint, RLS on with no policy so it is reachable only through `dbAdmin()`. The write is idempotent on that key, so applying the same link twice succeeds twice. |
| The seam that reads it | **[protected], and it fails closed.** `sendEmail` consults exactly one store, chosen by the sending kind's own register row. With no store wired, the reader answers `unreadable` and the mail is **not** sent — "we cannot tell" is never treated as "not opted out". |
| The opt-out link in the body | **[protected].** Six kinds carry it — `first-page`, `first-page-unavailable`, `nurture`, `inactivity`, `veto-reminder`, `win-back` — as an absolute `https://reachkit.app/opt-out/{token}`, signed over the normalised address, with no expiry encoded, applying on arrival. |
| **The `List-Unsubscribe` headers** | **Missing. Fixed in #889.** The Resend request carried `from`, `to`, `subject` and the two bodies and **no headers at all**, so no mail this product has ever sent could be unsubscribed from by a mail client's own control — only by finding the link in the body. Now every mail carrying a stop control also carries `List-Unsubscribe: <https://reachkit.app/api/opt-out/{token}>` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`, and `POST /api/opt-out/{token}` applies the same token to the same store on that one POST, with no session and no confirmation (RFC 8058). A mail with no stop control — the sign-in link is the credential — sends neither header. |
| The three per-kind toggles | **A gap, and it is the owner's call, not a defect.** `weekly`, `published` and `draft-ready` are stopped by the customer's own switches in Settings and carry **no** stop control in the mail: `unsubscribeTokenFor` has no caller and there is no `/unsubscribe/{token}` route. Those three go only to paying, signed-in customers who can reach Settings, so no bulk-sender rule is broken — but a reader who presses their client's Unsubscribe on a Monday digest will find nothing there. Wiring it is one route and one call site over the token module that already exists; it is left out of #889 because #889 does not widen. |

Nothing above merges the two mechanisms, and nothing may: an address-wide unsubscribe that reached
`magic-link` would lock a paying customer out of the product with no recovery channel.

### 2.3 The inbox test

**Done for rendering, 2026-09-22 (#339, closed).** The owner confirmed that all sixteen kinds, sent
once to the owner's inbox, render in Gmail and Apple Mail. Two limits of that run stay true:

- The send bypassed `sendEmail`, so those messages did not carry `List-Unsubscribe`. The headers
  themselves are on `main` since #889 (§2.2). A later send through `sendEmail` is what shows the
  client's own Unsubscribe control. That is not a second open issue until a send is made.
- The imprint placeholder was in every footer. That is #335, not a mail issue.

The render check ran the day before DMARC was published. DMARC is the dated line in §2.1. Moving
`p=none` to `p=quarantine` is #1048, and it is not on the launch queue.

---

## 3. The rest of the gate

Everything else that must be true before a stranger pays. **This table is the only launch status.**
`README.md` points here and does not keep its own. Rewritten 2026-09-23, after #885, #887, #888,
#889, #339, #542, #1019 and #1043 had closed and the table still described them as in flight.

| # | Must be true | State | Whose |
|---|---|---|---|
| 1 | **Stripe is live** | Not done. Production is still test mode (§1). The boot refusal for a crossed price is on `main` (#889, closed). The switch itself is **#1042**, `blocked-on-owner`. | **[owner]** |
| 2 | **Mail reaches a real inbox** | Rendering is done (#339, closed 2026-09-22, §2.3). DMARC is published, report-only (#1043, closed 2026-09-23, §2.1). Tightening to `p=quarantine` is #1048 and is not on the launch queue. | **[protected]**, except #1048 |
| 3 | **The legal pages carry real bodies** | `/privacy` and `/terms` have full written bodies. All three still carry `[[imprint: owner fills legal entity, address, VAT id]]`, and `/imprint` is little more than that placeholder. The same placeholder was in the footer of the mail the owner read on 2026-09-22. **#335**, `blocked-on-owner`. | **[owner]** |
| 4 | **There is a way back from data loss** | The recovery runbook is written and roll-forward-only is the ruling (#887, closed). The project is still on the Supabase Free plan: **no PITR and no recorded restore drill**. **#334**, on the Launch milestone, not `later`. The procedure is `docs/RUNBOOK.md` §9. | **[owner]** |
| 5 | **A hosted page is reachable on the internet** | The publish chain was proved with doubles: in review, live, taken down, a hostname that changes, a body that cannot carry markup (#888, closed). That proof published nothing. Production has no `VERCEL_API_TOKEN`, so no hosted host is attached. `content.reachkit.app` answers `DEPLOYMENT_NOT_FOUND`. **#1045.** | **[owner]** token, then the product's own Check |
| 6 | **One site cannot spend the whole product's day** | **[protected].** The per-site cap and the free-scan bounds are on `main` (#885, closed). The numbers are drafted defaults the owner may correct; that correction is not an open defect. | — |
| 7 | **A paying customer can get in** | A magic link was walked on `dev.reachkit.app` on 2026-09-22: it arrived, signed in, and a second use was refused (#542, closed). Dev and production share one Supabase project and one sending domain. The production host has not been walked; that is part of **#1044**. The mail's "15 minutes" sentence was wrong and is fixed on `main` (#1019, #1014, both closed by #1022). | **[owner]** for the production host |
| 8 | **No `TODO(copy)` renders on the paying path** | **[protected].** No registry value is the marker (`TODO_COPY_MARKER` remains the string the audit refuses). `sendEmail` refuses a mail that contains it. | — |

The open Launch issues are the rows still marked not done: #1045, #1042, #335, #334, #1044, and #1025
while the Round 7 sign-in split is still the screen the walk waits on. Anything labeled `later` or
`parked` waits behind them (`docs/PROCESS.md`).

---

## 4. What turned out to need nothing

Collected so the next reader does not re-establish it:

- **The price object is checked at every boot**, field by field, against a spec built from the pins
  — and, since #889, a price that does not exist refuses the boot too.
- **The webhook's trust boundary is one place.** `POST /api/stripe/webhook` verifies nothing and
  hands raw bytes to `handleStripeWebhook`; verification strictly precedes parsing, over the bytes
  received, with no `JSON.parse` or string round-trip in front of it.
- **A replayed delivery and a second purchase are database constraints**, not handler logic:
  `users.checkout_session_id` and `lower(users.email)`. A race between two deliveries is decided by
  the database.
- **A second payment from the same address** cancels the second subscription at once, mails the
  buyer once, and sends no second sign-in link and no second deep pass.
- **The customer portal configures itself** from `PORTAL_FEATURES` on first use, in whichever
  Stripe mode it is running.
- **`paid_through` never moves backwards from a vendor event**, so an out-of-order redelivery
  cannot take access from somebody who has it. (Which is also why a refund needs §1.7's step 3.)
- **The suppression seam fails closed**, and the two stop mechanisms are two stores, two token
  formats and two signing keys, permanently.
- **Mail logs carry no address and no body** — the recipient is a truncated digest, enough to
  correlate two sends and not enough to reach anyone.
- **A refused boot tells `OWNER_EMAILS`** with the check and the error's class, never its message,
  and is rethrown afterwards: telling the owner never lets the deployment start.
