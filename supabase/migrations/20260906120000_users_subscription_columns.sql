-- supabase/migrations/20260906120000_users_subscription_columns.sql
--
-- BUILD §13 — the paid-through date that is the product's whole access
-- gate, the subscription it is advanced from, and the cancellation stamp.
-- Sub-token `users_subscription`, so this file narrows the `users` topic to
-- exactly these three columns and the one comment.
--
-- **Read ADR-050 before changing anything here.** "Active access is
-- `users.paid_through > now()` alone; `plan_status` is recorded and never
-- read by the gate." The four columns this file touches sit next to each
-- other on purpose and only one of them decides anything — which is why the
-- `plan_status` comment below exists at all: a reader of the schema meets
-- the landmine where they meet the column, not in a document they would
-- have had to know to open.
--
-- `paid_through` is `not null` because the gate has no third answer. A null
-- would have to mean either "no access" or "access we have not heard about
-- yet", and every caller would pick for itself. It carries `default now()`
-- rather than a nullable column so the row `recordCheckoutFacts` inserts is
-- legal before any subscription event has arrived: a brand-new account has
-- no access until `customer.subscription.created` advances the date, which
-- is seconds later and behind no customer-visible surface. The default is
-- kept, not dropped — dropping it would make provisioning's own insert
-- (`src/lib/account/store.ts`, which names the columns it writes and does
-- not name this one) fail on a constraint instead of opening an account.
--
-- The index is `hasActiveAccess`'s access path: the gate resolves a site to
-- its user through `sites.user_id` and reads this one column, three times
-- per unit of scheduled work.
--
-- `last_subscription_event_id` is what makes a replayed delivery a no-op
-- rather than a second write. It is deliberately a column on the row the
-- event moves and not a table of its own: the fact a replay must conflict
-- with is "this row has already seen that event", and a second table
-- holding the same fact is a second thing to keep true (the reasoning
-- `20260906090100_users_provisioning_keys.sql` records for the same
-- decision on the provisioning side). Every write behind it is a set-to-a
-- value besides — never an increment — so a replay that somehow reached the
-- write would still leave the same row.
--
-- ADR-051 point 2: no foreign key here, and nothing added by this file
-- cascades.

alter table users add column stripe_subscription_id text;
alter table users add column paid_through timestamptz not null default now();
alter table users add column cancelled_at timestamptz;
alter table users add column last_subscription_event_id text;

comment on column users.stripe_subscription_id is
  'The subscription paid_through is advanced from. Null before the first subscription event arrives (REQ-076 c8).';
comment on column users.paid_through is
  'THE access gate: access is this date being in the future, and nothing else (ADR-050). Stamped by onSubscriptionEvent, never computed at read time.';
comment on column users.cancelled_at is
  'When the customer cancelled. A record, never a gate: a cancelled account keeps access until paid_through passes (REQ-076 c3, c8).';
comment on column users.last_subscription_event_id is
  'The last vendor event applied to this row. A second delivery of that same event id changes nothing — the durable half of onSubscriptionEvent''s idempotence.';

-- ADR-050, verbatim, where a reader of the schema will meet it.
comment on column users.plan_status is
  'The record of what Stripe says; read by no gate (ADR-050). Access is users.paid_through > now() alone — a cancelled or past_due subscription with a future paid_through HAS access, and an active one with a past paid_through has none.';

create index users_paid_through_idx on users (paid_through);
