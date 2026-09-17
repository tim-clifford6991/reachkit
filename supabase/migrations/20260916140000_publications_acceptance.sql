-- supabase/migrations/20260916140000_publications_acceptance.sql
--
-- SPEC §6 (owner, 2026-09-16, #795) — every published page carries its own
-- acceptance test, recorded when the publish attempt is claimed.
--
-- `structure.md` rule 3a: the bare `publications` topic — this is that
-- node's own column.
--
-- The weekly judgement read a page's test only through
-- `drafts -> opportunities`, so a publication whose opportunity test did
-- not come back was never judged. The claim now copies the test onto the
-- row it writes, and the judgement reads it from there first.
--
-- **Written once.** Like `opportunities.acceptance`, the test a page is
-- judged by is never rewritten: a null may be filled, a value may not
-- change.
--
-- Existing rows are filled from their opportunity, so no published page
-- starts without one.

alter table publications add column acceptance jsonb;

update publications p
set acceptance = o.acceptance
from drafts d
join opportunities o on o.id = d.opportunity_id
where d.id = p.draft_id
  and p.acceptance is null;

create or replace function publications_acceptance_is_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.acceptance is not null and new.acceptance is distinct from old.acceptance then
    raise exception
      'publications.acceptance is written once and never rewritten (publication %)', old.id
      using errcode = 'integrity_constraint_violation';
  end if;
  return new;
end;
$$;

create trigger publications_acceptance_immutable
  before update on publications
  for each row
  execute function publications_acceptance_is_immutable();
