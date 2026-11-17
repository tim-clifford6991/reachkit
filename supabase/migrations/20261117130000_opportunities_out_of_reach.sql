-- opportunities.unready_reason — `out_of_reach` joins the closed set.
--
-- SPEC §7 *Readiness holds only for harm* (owner, 2026-11-17): a new
-- comparison or listicle page waits while the site holds no unbranded place
-- of 20 or better on its market. Readiness records that as the row's own
-- stored answer, as it records every other reason a row is not planned.
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
    'out_of_reach'
  )
);
