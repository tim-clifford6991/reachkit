-- supabase/migrations/20260906120400_sites_settings.sql
--
-- BUILD §9 · §4.7 (issue #46) — saving the four publishing settings, in one
-- statement with every draft they re-deadline.
--
-- `structure.md` rule 3a: the filename carries the `sites_settings`
-- sub-token, which narrows the `sites` topic and is owned by the publishing
-- settings leaf (`src/lib/db/topics.ts`). It adds no column — every one of
-- the four values already exists (`mode`, `veto_hours` and `publish_time`
-- on the baseline, `timezone` on `00000000000004_sites_timezone_column`).
--
-- **Why a function at all.** REQ-073 c4 makes a saved change apply to every
-- draft not yet published. The only client any code may hold is a PostgREST
-- client, where each `.from(...)` is its own HTTP request and its own
-- implicit transaction — so a save written as N+1 requests can be
-- interrupted between them and leave the settings changed for the site and
-- unchanged for half its drafts, which is exactly the half-applied state
-- c4 forbids.
--
-- **The rule stays in TypeScript.** `newVetoDeadline`
-- (`src/lib/publish/settings/apply.ts`) is REQ-073 c4's four rules and this
-- function re-implements none of them: it is handed the deadlines that
-- function already computed, one per draft, and applies them. A copy of the
-- rule in PL/pgSQL would be the second copy that drifts.
create or replace function save_publishing_settings(
  p_site_id uuid,
  p_mode text,
  p_veto_hours integer,
  p_publish_time time,
  p_timezone text,
  -- `[{ "draft_id": uuid, "veto_deadline": timestamptz, "clear_told": bool }]`
  p_drafts jsonb
) returns integer
language plpgsql
as $$
declare
  touched integer;
begin
  update sites set
    mode = p_mode,
    veto_hours = p_veto_hours,
    publish_time = p_publish_time,
    -- A null zone is never written over a stated one by this path: the
    -- caller always passes the zone in force, so `p_timezone` is the
    -- customer's own value whether or not this save changed it.
    timezone = p_timezone
  where id = p_site_id;

  with rows as (
    select
      (entry ->> 'draft_id')::uuid as draft_id,
      (entry ->> 'veto_deadline')::timestamptz as veto_deadline,
      (entry ->> 'clear_told')::boolean as clear_told
    from jsonb_array_elements(coalesce(p_drafts, '[]'::jsonb)) as entry
  )
  update drafts set
    veto_deadline = rows.veto_deadline,
    -- REQ-057 c8: the telling is re-opened, never sent from here. Clearing
    -- the record is what makes `customer_told` hold the page until the
    -- customer has been told again on the pair now in force.
    told = case when rows.clear_told then null else drafts.told end
  from rows
  where drafts.id = rows.draft_id and drafts.site_id = p_site_id;

  get diagnostics touched = row_count;
  return touched;
end;
$$;
