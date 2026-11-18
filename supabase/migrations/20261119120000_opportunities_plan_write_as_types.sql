-- The commit stores the type a row's research fills, any of the five a week plan writes.
-- It only widens the set: every row stored today still passes. RLS is unchanged.
alter table opportunities drop constraint if exists opportunities_week_plan_shape;
alter table opportunities add constraint opportunities_week_plan_shape check (
  (plan_place is null and planned_for is null and plan_write_as is null)
  or (
    plan_place is not null and plan_place >= 0
    and (plan_write_as is null or plan_write_as in ('listicle', 'how_to', 'qa', 'documentation', 'offering'))
  )
);
