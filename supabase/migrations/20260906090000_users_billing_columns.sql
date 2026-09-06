-- supabase/migrations/20260906090000_users_billing_columns.sql
--
-- BUILD §13 — the three additive `users` columns Checkout writes into, and
-- the two uniqueness constraints provisioning's replay key depends on.
-- Sub-token `users_billing` (`structure.md` rule 3a; `src/lib/db/topics.ts`
-- carries the row), so this file narrows BP-017's `users` topic and owns
-- exactly these columns.
--
-- §13, quoted: "collect the buyer's country (Stripe does automatically) and
-- VAT ID field on, so the records exist when registration is set up."
-- Nothing here validates either value. `vat_number` carries no check
-- constraint, no trigger and no normalising default on purpose — REQ-022
-- criterion 7's "whatever any registry would say about that number" must
-- not be defeated in the schema, where no caller could see it happen.
--
-- No `not null` on any of the three: a `users` row exists before
-- `recordCheckoutFacts` fills them, and a country Stripe did not report is
-- a null, never a guess.
--
-- ADR-051 point 2: no foreign key here, and none introduced by this file
-- carries `on delete cascade`.
--
-- `stripe_customer_id` is the baseline's column; this file adds only its
-- uniqueness, which is the half provisioning's second idempotency branch
-- needs and the baseline did not state.

alter table users add column billing_country text;
alter table users add column vat_number text;
alter table users add column checkout_session_id text;

comment on column users.billing_country is
  'ISO-3166-1 alpha-2 exactly as the payment vendor reported it: never re-cased, never mapped (REQ-022 c5).';
comment on column users.vat_number is
  'Verbatim as entered: never trimmed, uppercased, space-stripped or validated (REQ-022 c7).';
comment on column users.checkout_session_id is
  'The completed Checkout Session this account was opened from — provisioning''s replay key (REQ-024 c3).';

alter table users add constraint users_stripe_customer_id_key unique (stripe_customer_id);
alter table users add constraint users_checkout_session_id_key unique (checkout_session_id);
