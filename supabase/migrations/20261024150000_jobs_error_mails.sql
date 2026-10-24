-- supabase/migrations/20261024150000_jobs_error_mails.sql
--
-- Issue 1958 — a failing job mails the owner once per job, error class and
-- Europe/Berlin day, decided here rather than by the mail vendor's key.
--
-- The runner (`src/jobs/run.ts` → `src/jobs/heartbeat.ts`) inserts the row
-- with `on conflict do nothing returning`; only the tick that inserted it
-- sends the mail, so two ticks racing on two instances send one. A send no
-- owner address accepted deletes its row, so the next tick tries again.
-- `error_name` is the error's class name, never its message. A few rows a
-- day; nothing prunes them.
--
-- **RLS: enabled, no policy** — the `fetches` convention. Nothing a
-- customer holds reads or writes it; it is reachable only through
-- `dbAdmin()` (`service_role`, which bypasses RLS).
--
-- Expand-only. Not applied by the PR that adds it; applied before the
-- deploy through the Supabase connector (docs/PROCESS.md step 4).

create table job_error_mails (
  job_id text not null,
  error_name text not null,
  day date not null,
  mailed_at timestamptz not null default now(),
  primary key (job_id, error_name, day)
);

alter table job_error_mails enable row level security;

comment on table job_error_mails is
  'One row per job, error class and Berlin day the owner was mailed about (issue 1958), claimed by the job runner. '
  'dbAdmin()-only; BUILD §10 default-deny; no anon/authenticated policy by design.';

revoke all on job_error_mails from anon, authenticated;
grant select, insert, delete on job_error_mails to service_role;
