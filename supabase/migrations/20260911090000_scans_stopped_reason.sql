-- Issue #479 — a pass that could not read the customer's own site ends
-- saying so. `stopped_reason` gains `site_unreadable`: the first stage's
-- home-document read was refused (too large, no answer, blocked …), so
-- nothing downstream was attempted, and the pass is no longer recorded as
-- `complete` with every factor `not_attempted` (cal.com, M3 run 5).
--
-- The column and its check were added by `20260904110000_scans_current.sql`
-- as a column constraint, which Postgres names `scans_stopped_reason_check`.
-- Replaced, not amended: a check constraint has no `alter … add value`.

alter table scans drop constraint scans_stopped_reason_check;

alter table scans
  add constraint scans_stopped_reason_check
  check (stopped_reason in ('complete', 'time_ceiling', 'spend_ceiling', 'site_unreadable', 'failed'));
