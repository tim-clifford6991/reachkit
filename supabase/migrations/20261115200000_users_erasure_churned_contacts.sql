-- supabase/migrations/20261115200000_users_erasure_churned_contacts.sql
--
-- The churn list (owner, 2026-11-15, #2706): the name and address of every
-- deleted account, kept past the 30-day purge so the owner can invite them
-- back later. The purge never names this table. The suppression list still
-- governs mailing: a later invite reads both.
--
-- One row per address; a second deletion of the same address refreshes it.
--
-- **RLS: enabled, no policy** — the `job_days` convention. Reachable only
-- through `dbAdmin()` (`service_role`, which bypasses RLS).
--
-- Expand-only: a new table old code never reads. Applied by hand before the
-- deploy whose code writes it (docs/RUNBOOK.md §9).

create table churned_contacts (
  email text primary key check (email = lower(email)),
  name text null,
  churned_at timestamptz not null default now(),
  reason text not null check (reason in ('account_deleted')),
  invited_at timestamptz null
);

alter table churned_contacts enable row level security;

comment on table churned_contacts is
  'Owner, 2026-11-15, #2706. Name and email of each deleted account, kept past the purge for a later owner-run invite. dbAdmin()-only; no anon/authenticated policy by design.';

revoke all on churned_contacts from anon, authenticated;
grant select, insert, update, delete on churned_contacts to service_role;
