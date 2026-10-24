-- The first-renewal refund (owner D10, 2026-10-19): one row per refunded
-- first renewal, so a re-delivered `invoice.paid` neither refunds nor mails
-- twice. Kept apart from `refunds`, whose rows end access and count toward
-- the once-per-web-address rule; this refund does neither.
--
-- No foreign key to `users`, on purpose: a money record outlives the purge.
--
-- RLS: enabled, no policy. Read and written only through `dbAdmin()`.
-- Expand-only; applied before the deploy whose code reads it.

create table if not exists renewal_refunds (
  invoice_id text primary key,
  user_id uuid not null,
  refunded_at timestamptz not null default now()
);

create index if not exists renewal_refunds_user_id_idx on renewal_refunds (user_id);

alter table renewal_refunds enable row level security;

comment on table renewal_refunds is
  'First-renewal refunds (owner D10): the refunded renewal invoice and its account, written once per invoice so a '
  're-delivery neither refunds nor mails twice. dbAdmin()-only; default-deny; no anon/authenticated policy by design.';
