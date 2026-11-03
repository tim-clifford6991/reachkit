-- supabase/migrations/20261103150000_jobs_ops_events.sql
--
-- A durable count of operational failures the runtime log keeps for under an
-- hour: one row per failed Settings read (`kind = 'settings_read_failed'`),
-- written fire-and-forget by `src/lib/ops/events.ts` and counted by the daily
-- check. `code` is a short class such as `timeout`, never a message or stack;
-- no address or name is stored. `site_id` carries no foreign key, so the
-- purge deletes a site's rows by value (ADR-051, no cascade).
--
-- **RLS: enabled, no policy** — the `job_error_mails` convention. Reachable
-- only through `dbAdmin()` (`service_role`, which bypasses RLS).
--
-- Expand-only: old code never writes it. Applied before the deploy through
-- the Supabase connector (docs/PROCESS.md step 4).

create table ops_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  kind text not null,
  read text not null,
  site_id uuid null,
  code text not null check (char_length(code) <= 40)
);

create index ops_events_kind_at_idx on ops_events (kind, at);

alter table ops_events enable row level security;

comment on table ops_events is
  'One row per operational failure the runtime log would lose, counted by the daily check. '
  'dbAdmin()-only; BUILD §10 default-deny; no anon/authenticated policy by design.';

revoke all on ops_events from anon, authenticated;
grant select, insert, delete on ops_events to service_role;
