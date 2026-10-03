-- opportunities.rest_until — a topic stopped twice, or skipped, rests.
--
-- Issue #1179 · SPEC §7 *A stopped draft frees its date* (owner, D26,
-- 2026-10-02). A topic whose draft the generator stopped for the last time,
-- or whose stopped draft the founder skipped, is not offered again for
-- `TOPIC_REST_DAYS` (28). Before this the stopped topic stayed `queued`
-- behind its draft for good, and a skipped one went back to `open` with its
-- score unchanged: it ranked first again the next evening and failed the
-- same rules.
--
--   rest_until  the moment the topic may fill a day again. Null: it is not
--               resting. A moment in the past is the same as null and is
--               never cleared — readiness compares it to the clock.
--
-- And `resting` joins the closed set of readiness reasons, so the ranking,
-- the supply count and the screens read one stored answer, as they do for
-- every other reason a row is on file and not planned. The set is mirrored
-- in `UnreadyReason` (`src/lib/opportunities/types.ts`). Rewritten rather
-- than added to, because a check constraint has no ALTER.
--
-- Nothing changes on `drafts`: a stopped draft gives up its date by having
-- `scheduled_for` set to null, which `drafts_one_per_site_per_date` already
-- leaves out ("a row carrying no date is not a day's page").
--
-- Rule 3a: the `opportunities` topic (`src/lib/db/topics.ts`).

alter table opportunities add column rest_until timestamptz;

comment on column opportunities.rest_until is
  'SPEC §7 (D26, issue 1179): the topic is not offered for a day before this moment. Null or past: not resting.';

alter table opportunities drop constraint opportunities_unready_reason_closed;
alter table opportunities add constraint opportunities_unready_reason_closed check (
  unready_reason is null or unready_reason in (
    'not_assessed',
    'cluster_suppressed',
    'url_retired',
    'keyword_gate',
    'format_not_allowed',
    'no_grounding_fact',
    'outsized',
    'destination_cannot_address', 'already_covered',
    'low_fit',
    'resting'
  )
);
