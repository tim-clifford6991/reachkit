-- opportunities.business_fit, opportunities.source — topics by business fit.
--
-- Issue #1134 · SPEC §0 *Business fit*, §6 *Topics by business fit*
-- (owner, 2026-09-29 and 2026-10-03). Every candidate carries a business
-- fit, judged once by the pass and stored on the row; readiness and the
-- ranking read the column and nothing downstream judges it again.
--
--   business_fit  0–3: 3 the offering is the answer, 2 it plainly helps,
--                 1 it can only be mentioned, 0 no relation. Null is a row
--                 no pass has judged — the Fix family, and rows from before
--                 this migration until the next pass reaches them.
--   source        where the topic came from, in the order §6 offers them:
--                 ai_gap, product, problem, category, best_x. Set in code.
--
-- And `low_fit` joins the closed set of readiness reasons: a target with
-- fit below 2 is never a day of supply. The set is mirrored in
-- `UnreadyReason` (`src/lib/opportunities/types.ts`). Rewritten rather than
-- added to, because a check constraint has no ALTER — the shape
-- `20260921150100_opportunities_already_covered.sql` used for the ninth.
--
-- Rule 3a: the `opportunities` topic (`src/lib/db/topics.ts`).

alter table opportunities
  add column business_fit smallint,
  add column source text,
  add constraint opportunities_business_fit_range check (
    business_fit is null or business_fit between 0 and 3
  ),
  add constraint opportunities_source_closed check (
    source is null or source in ('ai_gap', 'product', 'problem', 'category', 'best_x')
  );

comment on column opportunities.business_fit is
  'SPEC §0 business fit, 0–3, judged once by the pass that derived or last read the row. Null: not judged.';
comment on column opportunities.source is
  'Where the topic came from (SPEC §6, 2026-09-29): ai_gap, product, problem, category or best_x.';

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
    'low_fit'
  )
);
