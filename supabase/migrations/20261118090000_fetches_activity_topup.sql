-- supabase/migrations/20261118090000_fetches_activity_topup.sql
--
-- SPEC §7 *Pages left* (owner, 2026-11-17, #2777): a short week's top-up buys
-- under its own cap, `CAPS.TOPUP_C`, and its ledger rows name the activity
-- `topup`, so the cost page and `npm run costs` show it apart from the weekly
-- pass (§6 *Every ledger row is attributable*).
--
-- Expand-only: one more allowed value. Every existing row already satisfies
-- the wider check. Before this file, a `topup` row is refused by the old check
-- and the writer keeps it under the scan's own activity (`src/lib/costs/ledger.ts`).

alter table public.fetches drop constraint if exists fetches_activity_known;
alter table public.fetches add constraint fetches_activity_known check (
  activity in ('free_scan', 'onboarding', 'weekly', 'topup', 'draft', 'rescore', 'smoke', 'test', 'box')
);
