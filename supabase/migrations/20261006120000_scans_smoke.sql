-- supabase/migrations/20261006120000_scans_smoke.sql
--
-- Issue 1286 · SPEC §6 (owner, D57, 2026-10-06) — a smoke test's scan is told
-- apart from a customer's free scan.
--
-- `scripts/smoke.sh` walks landing → scan → report on a live deployment and
-- spends one free pass each time. Those rows were indistinguishable from a
-- visitor's free scan, so production spend could not be split into the two.
-- The script says so in its request (`"smoke": true`) and the scan route
-- stores it here; the Monday owner digest reports the two on separate lines.
--
-- **A visitor can set it, and that is bounded.** Admission does not read it:
-- it buys no allowance and skips no limit. All it changes is which line of
-- the owner's cost report a scan's spend is counted on.
--
-- No index: it is read with a week's free scans, a handful of rows.

alter table scans
  add column smoke boolean not null default false;

comment on column scans.smoke is
  'Issue 1286 (D57). True where scripts/smoke.sh started this free scan. Read by the Monday owner digest to report smoke tests apart from customers'' free scans; never read by admission.';
