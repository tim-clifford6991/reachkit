-- Why the weekly pass committed a row: its integer points, the parts they sum
-- from and the rule that placed it, `{points, parts: [{part, n}], rule}`.
-- Written with the commit and cleared with it; the daily job copies it to
-- `drafts.meta.why` when it writes the slot. Nullable, and nothing is
-- backfilled: the next Monday's commit fills it. RLS is unchanged.
alter table opportunities add column if not exists plan_reason jsonb;

alter table opportunities drop constraint if exists opportunities_plan_reason_shape;
alter table opportunities add constraint opportunities_plan_reason_shape check (
  plan_reason is null
  or (plan_place is not null and jsonb_typeof(plan_reason) = 'object' and jsonb_typeof(plan_reason -> 'points') = 'number' and jsonb_typeof(plan_reason -> 'parts') = 'array')
);
