-- supabase/migrations/20260918120000_drafts_core_one_per_date.sql
--
-- SPEC §7 — "a date holds at most one asset" — held by the database rather
-- than by a read the generation engine makes first (issue 886).
--
-- `draft/generate` is a clock tick: it carries no payload, so it declares no
-- idempotency key, and every delivery of one hour's tick runs the body.
-- What already made a second delivery harmless is `generateDayPage`'s own
-- first question — does this site hold a draft for this date? — answered
-- `already_drafted`, which the tick reads as a day already done and which
-- costs no model call. That is exact for a delivery arriving after the
-- first run has written its row, and it is a read-then-write for two that
-- arrive together: both read no row, both write one, and the site holds two
-- pages for one day.
--
-- `*_scans_weekly.sql` states the shape this follows, for the same reason
-- and in its own words: "The index, not the schedule, is what makes it once
-- a week ... the claim insert is what they race on, and this index decides
-- it. Nothing in application code re-checks for a row first, which would
-- leave a window between the read and the write that both ticks could pass
-- through." The read stays, because it is what saves the second delivery's
-- spend; this index is what decides the two that raced past it. The loser's
-- insert raises, `src/lib/generate/store.ts` reads that as the date being
-- taken, and `generateDayPage` answers `already_drafted` — the same answer
-- the read would have given it.
--
-- **In any state**, matching the read it backs: a vetoed, stopped or
-- published draft still occupies its date, so `drafts.state` is not in the
-- index and no predicate narrows it.
--
-- Partial on `scheduled_for is not null`: a row carrying no date is not a
-- day's page and two of them are not a duplicate. Postgres never treats two
-- nulls as equal for uniqueness in any case; the predicate says so where it
-- can be read, and keeps those rows out of the index.
--
-- `idx_drafts_site_scheduled_for` is dropped rather than kept beside it:
-- every read it served is an equality on `(site_id, scheduled_for)` with a
-- date, which this index serves, and a second copy of one index is a second
-- thing to keep true.
--
-- Topic token `drafts`, sub-token `drafts_core` (`src/lib/db/topics.ts`).

create unique index if not exists drafts_one_per_site_per_date
  on drafts (site_id, scheduled_for)
  where scheduled_for is not null;

drop index if exists idx_drafts_site_scheduled_for;
