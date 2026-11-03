-- supabase/migrations/20261103180000_scans_rescore_reads_ids_first.sql
--
-- Expand-only: one function replaced, same signature, return table, volatility,
-- security, search_path and grants. No table, column, index, policy or row.
--
-- **`rescore_reports(...)`** picks the page's ids first and only then reads,
-- trims and checksums those rows. With `md5` and the trim in the same select
-- as the `order by ... limit`, Postgres detoasted and hashed every scan with
-- a report before its top-N sort, so each page cost the whole table and ran
-- into the statement timeout. Rows and their order are what they were.
--
-- No index: the id pick reads only `created_at`, `id` and whether `report` is
-- null, none of which detoasts, so a sequential scan of the table stays cheap.
--
-- Not applied by the PR that adds it; applied through the Supabase
-- connector before the deploy whose code reads it (docs/PROCESS.md step 4).

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
    from (select p.id
            from public.scans p
           where p.report is not null
             and (p_after_created_at is null or (p.created_at, p.id) > (p_after_created_at, p_after_id))
           order by p.created_at, p.id
           limit p_limit) page
    join public.scans s on s.id = page.id
   order by s.created_at, s.id;
$$;

revoke all on function rescore_reports(timestamptz, uuid, integer) from public;
revoke all on function rescore_reports(timestamptz, uuid, integer) from anon;
revoke all on function rescore_reports(timestamptz, uuid, integer) from authenticated;
grant execute on function rescore_reports(timestamptz, uuid, integer) to service_role;
