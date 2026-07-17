-- Record WHETHER the onboarding magic link was sent, instead of inferring it.
--
-- `provisionCheckoutUser` used to infer "this is a webhook redelivery, skip the
-- email" from `users.stripe_customer_id` already being bound. That proxy is
-- wrong: the sibling `customer.subscription.*` handler ALSO binds that column
-- (lib/billing/webhook.ts, defensive create) and explicitly defers the email to
-- the checkout handler — "No magic link is sent here — the
-- checkout.session.completed handler owns that". Stripe does not guarantee
-- event ordering, so on a subscription-first delivery the checkout handler saw
-- the bound column, concluded "redelivery", and sent nothing. Each half assumed
-- the other would send it: the user paid and could never log in.
--
-- "Did the account get created?" is poisoned the same way (the defensive create
-- calls ensureAuthUser too), so BOTH available proxies are unreliable. The fix
-- is to stop inferring and record the fact we actually care about.
--
-- Nullable + no default: NULL means "never sent" (the send-and-stamp trigger).
-- Backfill is deliberately omitted — every existing paid user has already been
-- through provisioning, and a NULL here only risks one extra login email on a
-- redelivery for an account that predates this column, which is the tolerable
-- side of the trade (a missing email is not).
alter table public.users
  add column if not exists onboarding_link_sent_at timestamptz;

comment on column public.users.onboarding_link_sent_at is
  'When the payment-first onboarding magic link was sent. NULL = never sent. Recorded, never inferred — see 20260717120000 migration header.';
