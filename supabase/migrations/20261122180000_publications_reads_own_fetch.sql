-- supabase/migrations/20261122180000_publications_reads_own_fetch.sql
--
-- SPEC §7 *Hosted reads are counts*, replay R1 (2026-11-22, #3208). Every AI answer fetch a hosted page counted in 28 days
-- fell on a day a ReachKit pass asked the AI apps about that site, so a fetch on such a day is filed as our own.
-- Expand-only: one check widens and the writer is replaced with the same signature, so a build that predates this
-- keeps writing what it wrote, and only the kind of a pass-day AI fetch changes.

alter table publication_reads
  drop constraint publication_reads_kind_known,
  add constraint publication_reads_kind_known check (
    kind in ('answer_fetch', 'own_fetch', 'index_fetch', 'referral', 'crawl', 'outbound')
  );

create or replace function record_publication_read(
  p_site_id uuid,
  p_publication_id uuid,
  p_day date,
  p_engine text,
  p_kind text,
  p_keep_days integer
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_kind text := p_kind;
begin
  -- A pass asks the AI apps about the site the day its scans row starts, and their fetches that day may be ours.
  if p_kind = 'answer_fetch' and exists (
    select 1
      from public.scans s
     where s.site_id = p_site_id
       and s.created_at >= p_day::timestamp at time zone 'UTC'
       and s.created_at < (p_day + 1)::timestamp at time zone 'UTC'
  ) then
    v_kind := 'own_fetch';
  end if;

  insert into public.publication_reads (site_id, publication_id, day, engine, kind, hits)
  select p.site_id, p.id, p_day, p_engine, v_kind, 1
    from public.publications p
   where p.id = p_publication_id
     and p.site_id = p_site_id
  on conflict (publication_id, day, engine, kind)
  do update set hits = public.publication_reads.hits + 1;

  delete from public.publication_reads
   where site_id = p_site_id
     and day < p_day - p_keep_days;
end;
$$;
revoke all on function record_publication_read(uuid, uuid, date, text, text, integer) from public;
revoke all on function record_publication_read(uuid, uuid, date, text, text, integer) from anon;
revoke all on function record_publication_read(uuid, uuid, date, text, text, integer) from authenticated;
grant execute on function record_publication_read(uuid, uuid, date, text, text, integer) to service_role;

comment on column publication_reads.kind is
  'Why: answer_fetch, own_fetch (an AI fetch on a day a ReachKit pass asked the AI apps about the site, never a '
  'customer''s count), index_fetch, crawl (a verified Googlebot), referral (a person opening the page, by source) or '
  'outbound (a click from the page to the business''s own site, booking, quote or phone link).';
