-- supabase/migrations/20261014130000_scans_rescore.sql
--
-- Issue 1433 — the re-score runs in production, where the data is. The owner's
-- ruling of 2026-10-14 (SPEC §2, issue 1426) fits every scoring, driver,
-- rival, market or profile change to every stored scan, at 0¢ and from
-- stored data. Reading production through a connector and typing the change
-- back was too slow and stopped part-way, so the `scan/rescore` job reads the
-- rows itself and writes the change here.
--
-- **`rescore_runs`** is the request and its answer. The master session
-- inserts a row (`mode` 'dry' or 'apply') through the Supabase connector; the
-- job's tick claims the oldest one not yet started, re-scores every stored
-- scan and site rival set, and writes the before and after (`summary`, the
-- markdown the CLI printed) and the totals back to the same row. Nothing a
-- customer holds reads or writes it.
--
-- **`report_md5(scans)`** is the stored report's checksum as a column the
-- job can select (`report_md5` beside `report`): the guard below compares
-- it, so a scan written after the job read it is left alone.
--
-- **`rescore_scan(...)`** is the guarded write the CLI's statements made:
-- each moved path set with `jsonb_set`, the replaced report kept under
-- `report.previous` and the scan's score, status and drivers under
-- `report.previousColumns` (the first originals, on a second re-score),
-- `rescoredAt` and `rescoredBy` (the deployed commit) stamped. False, and
-- nothing written, where the report's checksum is no longer `p_md5`.
--
-- Applied after merge through the Supabase connector (docs/PROCESS.md step 4).

create table rescore_runs (
  id uuid primary key default gen_random_uuid(),
  mode text not null default 'dry',
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  rescored_by text,
  scans_read integer,
  scans_changed integer,
  sites_moved integer,
  scans_written integer,
  scans_left integer,
  summary text,
  error text,
  constraint rescore_runs_mode_known check (mode in ('dry', 'apply'))
);

create index idx_rescore_runs_waiting on rescore_runs (requested_at) where started_at is null;

alter table rescore_runs enable row level security;

comment on table rescore_runs is
  'Re-score requests and their answers (issue 1433): inserted by the master session, claimed and answered by the '
  'scan/rescore job. dbAdmin()-only; BUILD §10 default-deny; no anon/authenticated policy by design.';

revoke all on rescore_runs from anon, authenticated;
grant select, insert, update, delete on rescore_runs to service_role;

create or replace function report_md5(s public.scans)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select md5(s.report::text);
$$;

revoke all on function report_md5(public.scans) from public;
revoke all on function report_md5(public.scans) from anon;
revoke all on function report_md5(public.scans) from authenticated;
grant execute on function report_md5(public.scans) to service_role;

create or replace function rescore_scan(
  p_id uuid,
  p_md5 text,
  p_changes jsonb,
  p_score integer,
  p_status text,
  p_drivers jsonb,
  p_at text,
  p_by text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  stored public.scans%rowtype;
  rewritten jsonb;
  change jsonb;
begin
  select * into stored from public.scans where id = p_id and md5(report::text) = p_md5 for update;
  if not found then
    return false;
  end if;
  rewritten := stored.report - 'previous' - 'previousColumns' - 'rescoredAt' - 'rescoredBy';
  for change in select value from jsonb_array_elements(p_changes) loop
    rewritten := jsonb_set(rewritten, array(select jsonb_array_elements_text(change->'path')), change->'value');
  end loop;
  update public.scans set
    report = rewritten || jsonb_build_object(
      'previous', coalesce(stored.report->'previous', stored.report),
      'previousColumns', coalesce(stored.report->'previousColumns',
        jsonb_build_object('score', stored.score, 'status', stored.status, 'drivers', stored.drivers)),
      'rescoredAt', p_at,
      'rescoredBy', p_by),
    score = p_score,
    status = p_status,
    drivers = p_drivers
  where id = p_id;
  return true;
end;
$$;

revoke all on function rescore_scan(uuid, text, jsonb, integer, text, jsonb, text, text) from public;
revoke all on function rescore_scan(uuid, text, jsonb, integer, text, jsonb, text, text) from anon;
revoke all on function rescore_scan(uuid, text, jsonb, integer, text, jsonb, text, text) from authenticated;
grant execute on function rescore_scan(uuid, text, jsonb, integer, text, jsonb, text, text) to service_role;
