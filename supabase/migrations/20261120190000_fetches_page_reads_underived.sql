-- supabase/migrations/20261120190000_fetches_page_reads_underived.sql
--
-- Expand-only: one new read-only function; no column, row or constraint changed.
--
-- `page_reads_underived` lists the own or rendered page reads that
-- `prune_page_html` would empty but for a missing `fetch_facts` or
-- `fetch_text` row, with which of the two each has. The prune's tick derives
-- those rows from the read's own html first, so a read that never had facts
-- or text gets them before its html goes (owner, 2026-11-18, #2836; ruling 50).
-- At most `p_limit` rows a call.
--
-- Not applied by the PR that adds it; applied through the Supabase
-- connector before the deploy whose code calls it (docs/RUNBOOK.md §9).
create or replace function public.page_reads_underived(p_before timestamptz, p_limit integer)
returns table (id uuid, scan_id uuid, source text, cache_key text, has_facts boolean, has_text boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  select r.id, r.scan_id, r.source, r.cache_key, r.has_facts, r.has_text
  from (
    select f.id, f.scan_id, f.source, f.cache_key,
           exists (select 1 from public.fetch_facts ff where ff.fetch_id = f.id) as has_facts,
           exists (select 1 from public.fetch_text ft where ft.fetch_id = f.id) as has_text
    from public.fetches f
    where f.created_at < p_before
      and f.source in ('egress.safeFetch', 'on_page/instant_pages')
      and (f.payload ? 'html' or coalesce(f.payload -> 0 ? 'html', false))
  ) r
  where not (r.has_facts and r.has_text)
  limit p_limit;
$$;

revoke all on function public.page_reads_underived(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.page_reads_underived(timestamptz, integer) to service_role;
