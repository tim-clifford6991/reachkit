-- opportunities.page_type — honesty by page type.
--
-- Issue #1136 · SPEC §7 *Two pools of facts, honesty by page type* (owner,
-- 2026-09-29; D20, 2026-10-02). How the business may appear on a page
-- follows the page's type, so the type is stored on the row the page is
-- written for and the rule set is chosen per page:
--
--   product            anchored on the product — against a rival, a rival's
--                      alternatives, for an audience, its price, a problem
--                      it solves. The product is the subject.
--   market_comparison  the market compared. Favourable framing, never a
--                      self-ranked "#1 best".
--   answer             a question answered.
--
-- Set in code (`src/lib/opportunities/page-type.ts`) from the row's type,
-- search and source. Null is a row that writes no new page — the Improve
-- and Fix families — or one from before this migration, which the reader
-- derives from the same three values until the next pass stores it.
--
-- Rule 3a: the `opportunities` topic (`src/lib/db/topics.ts`).

alter table opportunities
  add column page_type text,
  add constraint opportunities_page_type_closed check (
    page_type is null or page_type in ('product', 'market_comparison', 'answer')
  );

comment on column opportunities.page_type is
  'SPEC §7 honesty by page type (2026-09-29, D20): product, market_comparison or answer. Null: no new page, or not yet stored.';
