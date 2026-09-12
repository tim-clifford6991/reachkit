-- Issue #476 — SPEC §7: Autopilot is the only mode, and "the veto window
-- defaults to 24 h with a range of 1-7 days; there is no zero window, so
-- every draft has a veto path". The rows are brought to that floor first;
-- the constraint then makes a shorter window unrepresentable, so the clamp
-- in the settings parser can never be the only thing holding it.

update sites set mode = 'autopilot' where mode <> 'autopilot';

update sites set veto_hours = 24 where veto_hours < 24;

alter table sites
  add constraint sites_veto_hours_one_to_seven_days
  check (veto_hours >= 24 and veto_hours <= 168);
