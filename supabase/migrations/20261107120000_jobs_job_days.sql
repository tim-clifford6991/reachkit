-- supabase/migrations/20261107120000_jobs_job_days.sql
--
-- Each job's invocations, CPU and wall time, one row per job, UTC day and
-- site, so the platform's single CPU figure for `/api/jobs` can be split.
-- `site_id` is the per-subject run's site and null for a tick of its own;
-- it carries no foreign key, as `ops_events`. `cpu_ms` is the process's CPU
-- over the invocation: overlapping invocations on one instance each see the
-- others', so it is an upper bound and `wall_ms` is kept beside it.
--
-- Written only through `job_days_add`, one atomic increment per invocation,
-- so two invocations racing on one key both count. `account/maintenance`
-- deletes rows older than 35 days.
--
-- **RLS: enabled, no policy** — the `job_runs` convention. Reachable only
-- through `dbAdmin()` (`service_role`, which bypasses RLS).
--
-- Expand-only: old code never writes it. Applied before the deploy whose
-- code writes it, through the Supabase connector (docs/PROCESS.md step 4).

create table job_days (
  job_id text not null,
  day date not null,
  site_id uuid null,
  invocations bigint not null default 0,
  cpu_ms bigint not null default 0,
  wall_ms bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- A tick's own row has no site, and still has exactly one row a day.
create unique index job_days_key on job_days (job_id, day, site_id) nulls not distinct;
create index job_days_day_idx on job_days (day);

alter table job_days enable row level security;

comment on table job_days is
  'Each job''s invocations, CPU ms and wall ms per UTC day and site, added by job_days_add. '
  'dbAdmin()-only; BUILD §10 default-deny; no anon/authenticated policy by design.';

revoke all on job_days from anon, authenticated;
grant select, insert, update, delete on job_days to service_role;

create function job_days_add(p_job_id text, p_day date, p_site_id uuid, p_cpu_ms bigint, p_wall_ms bigint)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.job_days as d (job_id, day, site_id, invocations, cpu_ms, wall_ms, updated_at)
  values (p_job_id, p_day, p_site_id, 1, p_cpu_ms, p_wall_ms, now())
  on conflict (job_id, day, site_id) do update set
    invocations = d.invocations + excluded.invocations,
    cpu_ms = d.cpu_ms + excluded.cpu_ms,
    wall_ms = d.wall_ms + excluded.wall_ms,
    updated_at = excluded.updated_at;
$$;

revoke all on function job_days_add(text, date, uuid, bigint, bigint) from public;
revoke all on function job_days_add(text, date, uuid, bigint, bigint) from anon;
revoke all on function job_days_add(text, date, uuid, bigint, bigint) from authenticated;
grant execute on function job_days_add(text, date, uuid, bigint, bigint) to service_role;
