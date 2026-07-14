-- WS3 follow-up: pin an action to a specific calendar day.
--
-- The plan is a deterministic rolling schedule computed from the board (pacing
-- across the week). "Generate more actions for today" is an explicit founder
-- override — those actions must land on TODAY, not be paced out across the
-- week. `scheduled_for` records that pin: when set, the plan builder places the
-- action on exactly that day (bypassing the pacer); when null, the action
-- paces as before. Back-compat: every existing row is null → unchanged.
alter table actions add column if not exists scheduled_for date;
