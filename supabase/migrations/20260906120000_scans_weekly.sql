-- supabase/migrations/20260906120000_scans_weekly.sql
--
-- BUILD §11, REQ-065 (issue #41) — the week a scan belongs to, and the one
-- constraint that makes a second measurement of the same week
-- unrepresentable.
--
-- `week_start` is the **site-local Monday as a calendar date**, not an
-- instant: `date`, written once at insert by `claimWeek()` and never
-- recomputed on read. A customer who changes time zone changes no
-- already-measured week — an instant would slide the label into its
-- neighbour at the next render, which is exactly what REQ-065 c2 forbids
-- ("no value from an earlier week is presented as this week's").
--
-- Nullable, because it is a fact about weekly passes only: a free scan has
-- no site and no week, and a deep pass at onboarding is not a week's
-- measurement either. The partial unique index carries the same
-- restriction, so those rows are outside it and a domain may be scanned
-- freely as often as its own §6.4 window allows.
--
-- **The index, not the schedule, is what makes it once a week** (ADR-060
-- point 3). The weekly tick is hourly and every delivery is at-least-once,
-- so two ticks can arrive together; the claim insert is what they race on,
-- and this index decides it — one winner measures, the loser reads its own
-- rejection as "already measured". Nothing in application code re-checks
-- for a row first, which would leave a window between the read and the
-- write that both ticks could pass through.
--
-- No index on `week_start` alone: every read of it is keyed by the site
-- (`readWeekScan`) or by a set of sites (`weeksAlreadyStamped`), so this
-- one serves both and a second would only be written twice.
--
-- `structure.md` rule 3a: the file carries the bare `scans` topic, the same
-- way `*_scans_current.sql` does — this is that node's own column, not a
-- leaf beneath it.

alter table scans
  add column week_start date null;

create unique index scans_one_weekly_per_site_week
  on scans (site_id, week_start)
  where tier = 'weekly';
