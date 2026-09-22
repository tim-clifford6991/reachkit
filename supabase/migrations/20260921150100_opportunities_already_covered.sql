-- issue #928 — `already_covered` joins the closed set of readiness reasons.
--
-- SPEC §7 (2026-09-20): "A planned page that overlaps one of them becomes an
-- **update** of that page where the destination can publish to it; otherwise
-- the topic is skipped and the existing page is linked from related pages."
-- The skip is this reason: a row whose topic the site already covers, and
-- whose covering page this site's destination cannot publish an update of —
-- a hosted-only site whose covering page is their own WordPress post, or a
-- page on a host this product does not write to.
--
-- Where the destination *can* publish to it the row is not this: it was
-- derived as the update itself (`src/lib/opportunities/derive/known.ts`), so
-- this reason is the second arm of one rule and not a second rule.
--
-- Readiness decides and stores it, as it does every other reason
-- (`src/lib/opportunities/readiness.ts`, issue 884's one-home ruling); the
-- calendar, the ranking and the daily job read the column.
--
-- Rewritten rather than added to, because a check constraint has no ALTER —
-- the shape `20260918120000_opportunities_outsized_reason.sql` used for the
-- seventh reason.
--
-- **Ships unapplied** (owner applies): until it is, a row whose topic the
-- site already covers cannot be written unready — `setReadiness` raises on
-- the constraint and the pass logs the failed step. Nothing is published
-- from such a row in the meantime: the ranking reads `ready`, and a row that
-- could not be updated keeps the answer it already had.
--
-- Rule 3a: the `opportunities` topic, the same one every migration above
-- carries. It depends on `20260912120000_opportunities_readiness.sql` for
-- the column and on `20260918120000_opportunities_outsized_reason.sql` for
-- the constraint it rewrites.
-- SPEC §7 (2026-09-20, #928): a planned page whose topic the site already
-- covers, where the destination cannot publish an update of the page that
-- covers it, is not ready and says so. The reason set is mirrored here and in
-- `UnreadyReason` (`src/lib/opportunities/types.ts`); this adds the eighth.
-- Rewritten rather than added to, because a check constraint has no ALTER —
-- the shape `20260918120000_opportunities_outsized_reason.sql` used for the
-- seventh reason.
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
    'destination_cannot_address', 'already_covered'
  )
);
