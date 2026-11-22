-- supabase/migrations/20261122170000_publications_weeks.sql
--
-- SPEC §7 *Hosted reads are counts*, owner ruling 77 (2026-11-22): each hosted page keeps 13 months of weekly counts.
-- Expand-only: one new table. `publication_reads` and its 28 days of daily rows are unchanged.
--
-- One row per page and closed UTC week (Monday to Sunday, as the daily rows are UTC days), written by the weekly pass
-- from the daily rows once all seven days are past, so a retry or a catch-up writes nothing new. A week no pass saw has
-- no row: a reader draws it as a gap, never as 0. The weekly pass trims rows older than 57 weeks.
--
-- `counts` is the week's daily cells summed, keyed `kind:engine` over the two closed sets `publication_reads` checks,
-- integers only. `reading` is the page's Google reading the week's own pass took (indexed, 28-day impressions and
-- clicks, place and its source, the AI apps whose answer linked it); null on a week only a catch-up wrote.
-- Counts only: nothing here identifies a visitor, and the week is the finest grain kept past 28 days.

create table publication_weeks (
  publication_id uuid not null references publications (id),
  site_id uuid not null references sites (id),
  week_start date not null,
  counts jsonb not null default '{}'::jsonb,
  reading jsonb,
  primary key (publication_id, week_start),
  constraint publication_weeks_monday check (extract(isodow from week_start) = 1),
  constraint publication_weeks_counts_object check (jsonb_typeof(counts) = 'object')
);

alter table publication_weeks enable row level security;

comment on table publication_weeks is
  'One row per hosted page and closed UTC week (from Monday): the week''s counts from publication_reads and the Google '
  'reading of the pass that week, kept 57 weeks (SPEC §7, owner ruling 77). Counts only, no visitor identity. A week '
  'with no row was not measured.';

-- The customer's own weeks, and only their own.
create policy publication_weeks_select_own on publication_weeks for select to authenticated
  using (
    exists (
      select 1
        from sites s
        join users u on u.id = s.user_id
       where s.id = publication_weeks.site_id
         and s.user_id = (select auth.uid())
         and u.deleted_at is null
    )
  );

-- The trim and the readers filter on one site and a range of weeks.
create index idx_publication_weeks_site_week on publication_weeks (site_id, week_start);

grant select on publication_weeks to authenticated;
grant select, insert, update, delete on publication_weeks to service_role;
