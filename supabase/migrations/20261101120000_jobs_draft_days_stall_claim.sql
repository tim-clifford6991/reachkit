-- supabase/migrations/20261101120000_jobs_draft_days_stall_claim.sql
--
-- Expand-only: one nullable column. `stall_alerted_at` is when the owner
-- was told a site has gone twice its cadence with no page delivered. It is
-- set on the row of the date the site's last page was delivered, and only
-- where it is still null, so a stall is told once and the next delivery
-- (a new date, a new row) starts the next one. The row is seeded the way
-- `missing_alerted_at`'s claim seeds it: no outcome, which no read takes
-- for a recorded day.
--
-- Not applied by the PR that adds it; applied through the Supabase
-- connector before the deploy whose code reads it (docs/PROCESS.md step 4).

alter table draft_days add column if not exists stall_alerted_at timestamptz;

comment on column draft_days.stall_alerted_at is
  'When the owner was told the site has had no page delivered since this date; claimed once, while null.';
