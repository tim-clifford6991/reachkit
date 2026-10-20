-- The first-14-days refund (owner D4, 2026-10-19): one row per refunded
-- first invoice, with the canonical domains of the account's sites, so
-- "once per web address" is read from stored rows and never from an email.
--
-- No foreign key to `users`, on purpose: the record must outlive the
-- 30-day purge, or deleting an account would reset the once-per-domain rule.
--
-- RLS: enabled, no policy. Read and written only through `dbAdmin()`.
-- Expand-only; applied before the deploy whose code reads it.

create table if not exists refunds (
  invoice_id text primary key,
  user_id uuid not null,
  domains text[] not null default '{}',
  refunded_at timestamptz not null default now()
);

create index if not exists refunds_user_id_idx on refunds (user_id);
create index if not exists refunds_domains_idx on refunds using gin (domains);

alter table refunds enable row level security;

comment on table refunds is
  'First-14-days refunds (owner D4): the refunded invoice, its account and the account''s canonical site '
  'domains. No FK to users so the once-per-domain rule survives the purge. dbAdmin()-only; no policy by design.';
