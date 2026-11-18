-- opportunities.unready_reason — `fit_unscored` joins the closed set.
--
-- SPEC §6 *Readiness holds only for harm*: a new page no fit call has scored
-- is held as not measured, never as `low_fit`, until the next pass scores it.
--
-- The set is mirrored in `UnreadyReason` (`src/lib/opportunities/types.ts`).
-- Rewritten rather than added to, because a check constraint has no ALTER.
-- It only widens the set: every row stored today still passes.

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
    'no_intent',
    'out_of_reach',
    'fit_unscored'
  )
);
