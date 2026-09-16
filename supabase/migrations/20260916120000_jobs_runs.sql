-- supabase/migrations/20260916120000_jobs_runs.sql
--
-- Issue #799 — the job heartbeat. One row per job: when it last ran and
-- how that run ended, so the owner can see the scheduled jobs are firing
-- without the platform's dashboard or the deployment's log search.
--
-- Written by the one runner every invocation passes through
-- (`src/jobs/run.ts` → `src/jobs/heartbeat.ts`), upserted on `job_id`, so
-- the table never holds more rows than there are jobs. It is not a history:
-- the runtime log still carries one line per invocation.
--
-- `stale_alerted_at` is when the owner was last told this job had gone
-- quiet for twice its interval. A job is told about once per silence: the
-- claim is conditional on it being null or older than `last_run_at`, so
-- two ticks racing on two instances send one mail between them, and a job
-- that runs again and then goes quiet again is told again.
--
-- **RLS: enabled, no policy** — the `fetches` convention. Nothing a
-- customer holds reads or writes it; it is reachable only through
-- `dbAdmin()` (`service_role`, which bypasses RLS).
--
-- Not applied by the PR that adds it; applied after merge through the
-- Supabase connector (docs/PROCESS.md step 4).

create table job_runs (
  job_id text primary key,
  last_run_at timestamptz not null,
  last_outcome text not null,
  stale_alerted_at timestamptz,
  constraint job_runs_outcome_known check (
    last_outcome in ('ran', 'skipped', 'stopped', 'degraded', 'failed')
  )
);

alter table job_runs enable row level security;

comment on table job_runs is
  'The job heartbeat (issue #799): each job''s last run and its outcome, one row per job, written by '
  'the job runner. The stale-job alert reads it: a scheduled job quiet for twice its interval is '
  'told to OWNER_EMAILS once, and stale_alerted_at records that telling.';

grant select, insert, update, delete on job_runs to service_role;
