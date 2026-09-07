-- supabase/migrations/20260907090000_scans_weekly_digest.sql
--
-- BUILD §12, §11 (issue #181) — the moment the Monday digest for this week
-- was accepted by the send seam, and the whole of "once per site-week".
--
-- `_scans_weekly.sql` gave the weekly pass its `week_start` and the partial
-- unique index that makes a second *measurement* of the same week
-- unrepresentable. This column is the same shape of fact about the
-- *telling*: one row per site-week already exists, so the digest's own
-- once-ness needs a stamp on that row and not a table of its own.
--
-- `structure.md` rule 3a: the bare `scans` topic, the same way
-- `*_scans_weekly.sql` and `*_scans_current.sql` are — this is that node's
-- own column, not a leaf beneath it.
--
-- **Nullable, and stamped only where the mail was accepted.** Null means
-- "not sent", and it is deliberately not a three-valued record of every
-- attempt:
--
--   · a send the seam refused — an owner-owed line that will not compose,
--     a customer whose switch is off, a vendor that would not take it —
--     leaves this null, so the next Monday tick offers the week again.
--     Recording a refusal here would burn the week: the one case that
--     matters is a line the owner has not written yet, and the mail must
--     go the moment they do.
--   · a send the seam accepted stamps it, and the row's own
--     `(site_id, week_start)` uniqueness is then what makes a re-run of the
--     tick send nothing.
--
-- The refusal is not lost by being absent here: the job reports it as its
-- own outcome and logs the reason, which is where an operator looks for
-- "why did Monday's mail not go out" — a column that said `failed` would
-- be a second, staler copy of that answer.
--
-- No index: every read of it is already keyed by `(site_id, week_start)`
-- through the index `_scans_weekly.sql` created, and this column is only
-- ever read on a row that lookup already found.

alter table scans
  add column digest_sent_at timestamptz null;

comment on column scans.digest_sent_at is
  'BUILD §12 (issue #181). When the Monday digest for this site-week was accepted by the send seam. Null means not sent — including sends the seam refused, which are retried on the next tick rather than burning the week.';
