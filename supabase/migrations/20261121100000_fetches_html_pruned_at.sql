-- supabase/migrations/20261121100000_fetches_html_pruned_at.sql
--
-- Expand-only: one nullable column, two new functions; no row or payload changed.
--
-- The prune needs only to know whether it has dealt with a read, so a null
-- `html_pruned_at` is every existing row's right answer: no backfill, and no
-- filter ever reads `payload` (docs/RUNBOOK.md, Changing a large table).
-- `fetches_html_due` walks `idx_fetches_html_due` (the next migration) and
-- sizes a payload from its toast pointer; `fetches_html_prune` detoasts only
-- the rows it is given.
--
-- Applied by hand before the deploy whose code calls it (docs/RUNBOOK.md §9).
set lock_timeout = '3s';
alter table public.fetches add column if not exists html_pruned_at timestamptz;

create or replace function public.fetches_html_due(p_before timestamptz, p_limit integer)
returns table (id uuid, scan_id uuid, source text, cache_key text, stored_bytes integer, has_facts boolean, has_text boolean)
language sql
stable
security invoker
set search_path = ''
set statement_timeout = '5s'
as $$
  select f.id, f.scan_id, f.source, f.cache_key, pg_column_size(f.payload),
         exists (select 1 from public.fetch_facts ff where ff.fetch_id = f.id),
         exists (select 1 from public.fetch_text ft where ft.fetch_id = f.id)
  from public.fetches f
  where f.source in ('egress.safeFetch', 'on_page/instant_pages')
    and f.html_pruned_at is null
    and f.created_at < p_before
  order by f.created_at
  limit least(p_limit, 25);
$$;

create or replace function public.fetches_html_prune(p_ids uuid[])
returns integer
language plpgsql
security invoker
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  emptied integer;
begin
  update public.fetches f
     set payload = case when jsonb_typeof(f.payload) = 'array'
                        then f.payload #- '{0,html}'
                        else f.payload - 'html' end,
         html_pruned_at = now()
   where f.id = any(p_ids)
     and f.html_pruned_at is null
     and exists (select 1 from public.fetch_facts ff where ff.fetch_id = f.id)
     and exists (select 1 from public.fetch_text ft where ft.fetch_id = f.id);
  get diagnostics emptied = row_count;
  return emptied;
end;
$$;

revoke all on function public.fetches_html_due(timestamptz, integer) from public, anon, authenticated;
revoke all on function public.fetches_html_prune(uuid[]) from public, anon, authenticated;
grant execute on function public.fetches_html_due(timestamptz, integer) to service_role;
grant execute on function public.fetches_html_prune(uuid[]) to service_role;
