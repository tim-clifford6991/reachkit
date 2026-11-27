-- supabase/migrations/20261127120000_jobs_box_trigger_claims.sql
--
-- The box's trigger claims each numbered re-run or test write as one `ops_events` row of kind
-- `box_trigger` before it sends: the partial unique index makes a second claim of the same
-- `(site_id, code)` unrepresentable, and `box_trigger_claim` is the one write that claims, so two
-- concurrent calls send once. The route answers 503 while this function is absent, so it refuses
-- every call until this migration is applied.
--
-- Expand-only: a new index and a new function; old code reads neither.

create unique index ops_events_box_trigger_claim_idx on ops_events (site_id, code) where kind = 'box_trigger';

create or replace function box_trigger_claim(p_site uuid, p_code text, p_read text, p_at timestamptz)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  claimed bigint;
begin
  insert into public.ops_events (at, kind, read, site_id, code)
  values (p_at, 'box_trigger', p_read, p_site, p_code)
  on conflict (site_id, code) where kind = 'box_trigger' do nothing
  returning id into claimed;
  return claimed is not null;
end;
$$;

revoke all on function box_trigger_claim(uuid, text, text, timestamptz) from public;
revoke all on function box_trigger_claim(uuid, text, text, timestamptz) from anon;
revoke all on function box_trigger_claim(uuid, text, text, timestamptz) from authenticated;
grant execute on function box_trigger_claim(uuid, text, text, timestamptz) to service_role;
