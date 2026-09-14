-- supabase/migrations/20260914120000_sites_autopilot.sql
--
-- SPEC §7 (2026-09-11), issue #476 — Autopilot is the only mode, and the
-- veto window is 1–7 days with no zero window.
--
-- Existing rows stay autopilot: any site recorded as copilot while the
-- choice was still offered becomes autopilot, and a window shorter than a
-- day becomes the one-day floor. The check constraint then makes a shorter
-- window unrepresentable, so no writer — the settings save, a script, a
-- hand edit — can store one again. The application reads the same floor
-- (`governingVetoHours`, `src/lib/publish/settings/veto.ts`).
--
-- `sites.mode` and its own check stay: the publish machine still reads the
-- column, and setup writes `autopilot` through `apply_setup_choice`.
--
-- Rule 3: the filename carries the `sites` topic token.

update sites set mode = 'autopilot' where mode <> 'autopilot';

update sites set veto_hours = 24 where veto_hours < 24;

alter table sites
  add constraint sites_veto_hours_floor check (veto_hours >= 24);
