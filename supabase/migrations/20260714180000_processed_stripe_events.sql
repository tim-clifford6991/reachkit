-- Webhook idempotency ledger (launch P2). checkout.session.completed has
-- non-idempotent side effects (account create, magic-link email); this table
-- lets the handler run them exactly once per Stripe event.id (first insert wins;
-- a redelivery hits the primary-key conflict and is skipped).
--
-- Service-role only: the webhook writes it via serverDb(); no anon/authenticated
-- access. RLS on with no policies = deny-all to anon/authenticated (service role
-- bypasses RLS), matching the repo's defence-in-depth posture.
create table if not exists processed_stripe_events (
  event_id text primary key,
  processed_at timestamptz not null default now()
);

alter table processed_stripe_events enable row level security;
