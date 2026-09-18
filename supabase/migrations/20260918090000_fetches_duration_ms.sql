-- supabase/migrations/20260918090000_fetches_duration_ms.sql
--
-- Issue 877 — how long a vendor call actually took, on the row that records
-- the call.
--
-- Issue 875 cut the free path's request abort to 5 s on a ruling made
-- without this number, and the first free scan after it aborted 5 of its 7
-- SERP calls and was billed for every one. Nobody could say what these calls
-- take: `fetches` carried what a call cost and how it failed, never how long
-- it ran, and the runtime log line that does carry it is kept for an hour.
--
-- So the elapsed milliseconds are stored beside the charge, for the answered
-- call and for the abandoned one alike — for an abandoned call it is the
-- time we waited before giving up, which is exactly the figure the next
-- abort value is chosen from (its p50 and p95 over a week of rows).
--
-- Nullable, and no backfill: every row written before this migration ran was
-- not timed, and `null` says that rather than inventing a zero. Integer
-- milliseconds — a call bounded by `VENDOR.requestAbortMs` never approaches
-- the type's range.
--
-- No index: the reads this serves are the owner's own aggregates over a
-- week, already keyed by `created_at` and `source`.
alter table public.fetches add column if not exists duration_ms integer;

comment on column public.fetches.duration_ms is
  'Issue 877: elapsed milliseconds of the vendor call this row records — for an abandoned call, how long we waited. Null on rows written before it was recorded.';
