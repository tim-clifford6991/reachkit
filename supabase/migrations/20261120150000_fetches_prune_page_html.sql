-- supabase/migrations/20261120150000_fetches_prune_page_html.sql
--
-- Expand-only: one new function; no column, row or constraint changed.
--
-- Raw page HTML is kept 30 days (owner, 2026-11-18, #2836): the fetch ledger
-- is most of the database, and at the plan's limit it goes read-only.
-- `prune_page_html` removes `html` from an own or rendered page read made
-- before `p_before` once that read's facts are kept in `fetch_facts`. The
-- rest of the row stays: the cost columns, and the payload's url, status,
-- bytes, readAt and headers, which the re-score reads to match a scan to its
-- home read. A read with no kept facts keeps its html at any age. At most
-- `p_limit` rows a call, so one statement stays short; it returns how many it
-- emptied, and a second call before `p_before` moves empties nothing.
--
-- Not applied by the PR that adds it; applied through the Supabase
-- connector before the deploy whose code calls it (docs/RUNBOOK.md §9).
create or replace function public.prune_page_html(p_before timestamptz, p_limit integer)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  emptied integer;
begin
  with due as (
    select f.id
    from public.fetches f
    where f.created_at < p_before
      and f.source in ('egress.safeFetch', 'on_page/instant_pages')
      and exists (select 1 from public.fetch_facts ff where ff.fetch_id = f.id)
      and (f.payload ? 'html' or coalesce(f.payload -> 0 ? 'html', false))
    limit p_limit
  )
  update public.fetches f
     set payload = case when jsonb_typeof(f.payload) = 'array'
                        then jsonb_set(f.payload, '{0}', (f.payload -> 0) - 'html')
                        else f.payload - 'html' end
    from due
   where f.id = due.id;
  get diagnostics emptied = row_count;
  return emptied;
end;
$$;

revoke all on function public.prune_page_html(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.prune_page_html(timestamptz, integer) to service_role;
