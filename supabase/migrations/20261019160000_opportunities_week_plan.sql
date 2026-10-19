-- Issue 1559: the week a weekly pass commits.
--
-- The weekly pass ends by committing the site's next seven pages, one a
-- day, and three spares (`planWeek`). The daily job writes the row planned
-- for its date, and takes a spare where that page cannot be written; it no
-- longer re-ranks the open pool every evening. A row in the week holds its
-- place (0 first), the date it is planned for (none for a spare), and the
-- type it is written as where the plan answers a listicle over D52's cap as
-- a Q&A. A new commit clears the site's last one first.
--
-- No row is retrofitted: a site with no commit is committed on demand, once,
-- by its next evening run, from the rows it holds. 0¢.
alter table opportunities add column if not exists planned_for date;
alter table opportunities add column if not exists plan_place smallint;
alter table opportunities add column if not exists plan_write_as text;

alter table opportunities drop constraint if exists opportunities_week_plan_shape;
alter table opportunities add constraint opportunities_week_plan_shape check (
  (plan_place is null and planned_for is null and plan_write_as is null)
  or (plan_place is not null and plan_place >= 0 and (plan_write_as is null or plan_write_as = 'qa'))
);

create index if not exists opportunities_week_plan_idx
  on opportunities (site_id, plan_place)
  where plan_place is not null;
