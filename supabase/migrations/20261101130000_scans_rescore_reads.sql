-- supabase/migrations/20261101130000_scans_rescore_reads.sql
--
-- Expand-only: two functions, no table, column, index or policy.
--
-- **`rescore_scan(...)`**, same signature: `jsonb_set` leaves a path whose
-- parent is missing untouched and appends past an array's end, so each change
-- is read back and the call raises (nothing written) where it did not land.
-- The caller can then trust a `true` without downloading the row again. An
-- empty path replaces the whole report: the re-score sends one for a blob of
-- an older version, whose paths were found on the upgraded copy.
--
-- **`rescore_reports(...)`** is the re-score's read: the scan columns it
-- scores, the report without the copy a re-score kept, and the stored
-- report's checksum, a page at a time after `(created_at, id)`.
--
-- Not applied by the PR that adds it; applied through the Supabase
-- connector before the deploy whose code reads it (docs/PROCESS.md step 4).

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
  target text[];
begin
  select * into stored from public.scans where id = p_id and md5(report::text) = p_md5 for update;
  if not found then
    return false;
  end if;
  rewritten := stored.report - 'previous' - 'previousColumns' - 'rescoredAt' - 'rescoredBy';
  for change in select value from jsonb_array_elements(p_changes) loop
    target := array(select jsonb_array_elements_text(change->'path'));
    if cardinality(target) = 0 and jsonb_typeof(change->'value') = 'object' then
      rewritten := change->'value';
    else
      rewritten := jsonb_set(rewritten, target, change->'value');
    end if;
    if rewritten is null or rewritten #> target is distinct from change->'value' then
      raise exception 'rescore_scan: change at % did not land on scan %', change->'path', p_id;
    end if;
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

create or replace function rescore_reports(
  p_after_created_at timestamptz default null,
  p_after_id uuid default null,
  p_limit integer default 25
)
returns table (
  id uuid,
  domain text,
  created_at timestamptz,
  status text,
  score integer,
  drivers jsonb,
  report jsonb,
  report_md5 text,
  site_id uuid,
  is_current boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.id, s.domain, s.created_at, s.status, s.score, s.drivers,
         s.report - 'previous' - 'previousColumns' - 'rescoredAt' - 'rescoredBy',
         md5(s.report::text), s.site_id, s.is_current
    from public.scans s
   where s.report is not null
     and (p_after_created_at is null or (s.created_at, s.id) > (p_after_created_at, p_after_id))
   order by s.created_at, s.id
   limit p_limit;
$$;

revoke all on function rescore_reports(timestamptz, uuid, integer) from public;
revoke all on function rescore_reports(timestamptz, uuid, integer) from anon;
revoke all on function rescore_reports(timestamptz, uuid, integer) from authenticated;
grant execute on function rescore_reports(timestamptz, uuid, integer) to service_role;
