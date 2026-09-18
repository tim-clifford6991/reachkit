-- issue 884 — `outsized` joins the closed set of readiness reasons.
--
-- SPEC §6's right-sizing law is decided where readiness is decided
-- (`src/lib/opportunities/readiness.ts`) and stored on the row, so the
-- database, the screens and the ranking cannot hold three answers to one
-- question. The column's check constraint is what mirrors the reason set in
-- `src/lib/opportunities/types.ts`; it is rewritten here rather than added
-- to, because a check constraint has no ALTER.
--
-- **Ships unapplied** (owner applies): until it is, a row whose right-sizing
-- reason is `outsized` cannot be written — `setReadiness` raises on the
-- constraint, `assessReadiness` propagates it, and the pass logs the failed
-- step. Nothing is published from an unassessed row in the meantime: the
-- ranking reads `ready`, and a row that could not be updated keeps the
-- answer it already had.
alter table opportunities drop constraint opportunities_unready_reason_closed;
alter table opportunities add constraint opportunities_unready_reason_closed check (
  unready_reason is null or unready_reason in (
    'not_assessed', 'cluster_suppressed', 'url_retired',
    'keyword_gate', 'format_not_allowed', 'no_grounding_fact',
    'outsized', 'destination_cannot_address'
  )
);
