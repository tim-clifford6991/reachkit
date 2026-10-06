-- opportunities.unready_reason — `no_intent` joins the closed set.
--
-- Issue 1288 · SPEC §6 *Each page records its intent* (owner, D60,
-- 2026-10-06). A topic whose search has no measured volume and that no
-- tracked prompt is close to is not written: a page for it could reach
-- neither goal a verdict looks for. Readiness records that as the row's own
-- stored answer, so the ranking, the supply count and the screens read it as
-- they read every other reason a row is on file and not planned.
--
-- The set is mirrored in `UnreadyReason` (`src/lib/opportunities/types.ts`).
-- Rewritten rather than added to, because a check constraint has no ALTER.
-- It only widens the set: every row stored today still passes.
--
-- Rule 3a: the `opportunities` topic (`src/lib/db/topics.ts`).

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
    'resting',
    'no_intent'
  )
);
