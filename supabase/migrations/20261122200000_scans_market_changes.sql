-- supabase/migrations/20261122200000_scans_market_changes.sql
--
-- SPEC §6 *Market changes* (owner ruling 90, 2026-11-22): what changed in a site's market, recorded by its weekly pass.
-- Expand-only: one new table, and the file re-runs cleanly.
--
-- One row per site and site-local week, inserted before the week's news is bought, so a second run of the same week
-- finds the row and buys nothing. `changes` is null until the pass stores what it found; a null week was not measured,
-- never an empty one. Each change in `changes` is a story at least two independent publishers reported within 30 days:
-- its title, its topic words, its claims (each with its address, publisher and date), and the weeks it was first and
-- last seen. At most five a week.

create table if not exists market_changes (
  site_id uuid not null references sites (id),
  week_start date not null,
  scan_id uuid not null references scans (id),
  changes jsonb,
  primary key (site_id, week_start),
  constraint market_changes_array check (changes is null or jsonb_typeof(changes) = 'array')
);

alter table market_changes enable row level security;

comment on table market_changes is
  'One row per site and week: the market changes its weekly pass recorded, each reported by two independent publishers '
  'within 30 days (SPEC §6, owner ruling 90). Null changes: the week was not measured.';

-- The customer's own weeks, and only their own.
drop policy if exists market_changes_select_own on market_changes;
create policy market_changes_select_own on market_changes for select to authenticated
  using (
    exists (
      select 1
        from sites s
        join users u on u.id = s.user_id
       where s.id = market_changes.site_id
         and s.user_id = (select auth.uid())
         and u.deleted_at is null
    )
  );

grant select on market_changes to authenticated;
grant select, insert, update, delete on market_changes to service_role;
