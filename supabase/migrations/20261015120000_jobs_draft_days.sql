-- supabase/migrations/20261015120000_jobs_draft_days.sql
--
-- Issue 1455 — every draft day, per site, with its reason. reachkit.app
-- published nothing for two days and nothing said why: `draft/generate`
-- recorded `degraded generate:no_opportunity` in `job_runs`, and the next
-- hourly `skipped` overwrote it.
--
-- One row per site and publish date. The draft tick upserts it in that
-- site's due hour with how the day ended (`outcome`) and why (`reason`), so
-- a day that wrote no page keeps its cause after the next tick has run.
-- `missing_alerted_at` is when the owner was told that the date's publish
-- time passed with no draft. The claim is conditional on it being null, so
-- a date is told about once, however many ticks see it.
--
-- **RLS: enabled, no policy** — the `fetches` convention. Nothing a
-- customer holds reads or writes it; it is reachable only through
-- `dbAdmin()` (`service_role`, which bypasses RLS).
--
-- Not applied by the PR that adds it; applied after merge through the
-- Supabase connector (docs/PROCESS.md step 4).

create table draft_days (
  site_id uuid not null references sites (id) on delete cascade,
  publish_date date not null,
  outcome text,
  reason text,
  decided_at timestamptz,
  missing_alerted_at timestamptz,
  primary key (site_id, publish_date),
  constraint draft_days_outcome_known check (
    outcome is null or outcome in ('drafted', 'no_page', 'failed')
  )
);

alter table draft_days enable row level security;

comment on table draft_days is
  'One row per site and publish date (issue 1455): how the draft tick''s due hour ended and why, and when '
  'the owner was told the publish time passed with no draft. dbAdmin()-only; BUILD §10 default-deny; '
  'no anon/authenticated policy by design.';

grant select, insert, update, delete on draft_days to service_role;
