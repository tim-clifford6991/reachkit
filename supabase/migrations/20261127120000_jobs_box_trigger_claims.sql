-- supabase/migrations/20261127120000_jobs_box_trigger_claims.sql
--
-- The box's trigger claims each numbered re-run or test write as one `ops_events` row of kind
-- `box_trigger` before it sends: the partial unique index makes a second claim of the same
-- `(site_id, code)` unrepresentable, and `box_trigger_claim` is the one write that claims: it counts the
-- day's claims and inserts under one lock, so two concurrent calls neither pass the cap nor send one key twice. The route answers 503 while this function is absent, so it refuses
-- every call until this migration is applied.
--
-- Expand-only: a new index and a new function; old code reads neither.

create unique index ops_events_box_trigger_claim_idx on ops_events (site_id, code) where kind = 'box_trigger';

create or replace function box_trigger_claim(p_site uuid, p_code text, p_read text, p_at timestamptz, p_cap integer)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  claimed bigint;
  kind_of text := split_part(p_code, ':', 1);
begin
  -- One claimer per site and kind at a time, so the count and the insert are one step and two calls cannot pass the cap.
  perform pg_advisory_xact_lock(hashtextextended(p_site::text || ':' || kind_of, 0));
  if (select count(*) from public.ops_events
        where kind = 'box_trigger' and site_id = p_site and code like kind_of || ':%'
          and at >= date_trunc('day', p_at at time zone 'UTC') at time zone 'UTC') >= p_cap then
    return 'capped';
  end if;
  insert into public.ops_events (at, kind, read, site_id, code)
  values (p_at, 'box_trigger', p_read, p_site, p_code)
  on conflict (site_id, code) where kind = 'box_trigger' do nothing
  returning id into claimed;
  return case when claimed is null then 'held' else 'claimed' end;
end;
$$;

revoke all on function box_trigger_claim(uuid, text, text, timestamptz, integer) from public;
revoke all on function box_trigger_claim(uuid, text, text, timestamptz, integer) from anon;
revoke all on function box_trigger_claim(uuid, text, text, timestamptz, integer) from authenticated;
grant execute on function box_trigger_claim(uuid, text, text, timestamptz, integer) to service_role;
