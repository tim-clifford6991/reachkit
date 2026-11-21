-- supabase/migrations/20261121160000_jobs_draft_days_started_at.sql
--
-- Expand-only: one nullable column, no default, no backfill, no index, so no
-- row is read or rewritten. `started_at` is when the day's job first began
-- work on the date (its first step, before any vendor call), set only while
-- it is null, so a repeated run or a day decided again keeps the first stamp.
--
-- Locks: the `alter table` takes ACCESS EXCLUSIVE on `draft_days` for a
-- catalog-only change (no table scan); `comment on column` takes SHARE UPDATE
-- EXCLUSIVE. The lock timeout makes a busy table fail fast instead of queueing.
--
-- Applied by hand before the deploy whose code writes it (docs/RUNBOOK.md §9).
set lock_timeout = '3s';
alter table public.draft_days add column if not exists started_at timestamptz;

comment on column public.draft_days.started_at is
  'When the day''s job first began work on the date; claimed once, while null.';
