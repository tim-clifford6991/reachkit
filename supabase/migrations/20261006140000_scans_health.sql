-- supabase/migrations/20261006140000_scans_health.sql
--
-- Issue 1287 · SPEC §6 (owner, D58, 2026-10-06) — every measurement checks
-- its own health.
--
-- A paid pass ends by checking what it stored: no rival's brand volume is
-- polluted, every tracked prompt names only current rivals, the market has
-- a searched term with volume, and the mention rate states its sample size
-- and margin. The answers are kept here, on the pass's own row:
-- `{ at, checks: [{ check, pass, detail, items }] }`.
--
-- **Not inside `report`.** The report is stored before the pass re-checks
-- its rivals, and the checks are made against the rivals the pass leaves in
-- force; `store_current_report` is the report's one writer and stays so.
--
-- Null on a free scan and on every pass from before this shipped. A null is
-- never read as a failure: the headline numbers skip only a pass whose
-- stored health holds a failing check.
--
-- No index: it is read with one site's passes of five weeks, a handful of
-- rows, and with one week's weekly passes by the owner digest.

alter table scans
  add column health jsonb;

comment on column scans.health is
  'Issue 1287 (D58). The pass''s own health checks: { at, checks: [{ check, pass, detail, items }] }. Null where no check ran. A failing check keeps the headline numbers on the last healthy pass and is listed in the Monday owner digest; the pass''s data stays stored.';
