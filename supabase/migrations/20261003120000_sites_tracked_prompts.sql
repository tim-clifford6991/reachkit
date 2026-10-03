-- sites.tracked_prompts — the buyer prompts a site's weekly pass asks.
--
-- Issue #1162 · SPEC §6 (owner, D19 final and D33 of 2026-10-03): the AI
-- measure is about 25 tracked buyer prompts per site, generated from the
-- structured market (`sites.market`) and stored with the site, asked on 2
-- engines × 2 runs a week. A four-week rate means something only while the
-- questions stay the same, so the set is kept here and not regenerated:
--
--   prompts     id, kind (category | use-case | persona | comparison |
--               problem | branded), text, addedAt, and `precheck` on a
--               prompt rotated in and not yet answered once
--   rotations   when prompts were rotated in and how many — at most a fifth
--               of the set in any thirteen weeks
--
-- Null is a site whose first weekly pass under D19 has not run. Written by
-- the weekly pass through `src/lib/market/prompts/store.ts`. The answers are
-- in that week's `scans.report`.
--
-- Rule 3a: the `sites` topic (`src/lib/db/topics.ts`).

alter table sites
  add column tracked_prompts jsonb,
  add constraint sites_tracked_prompts_is_object check (
    tracked_prompts is null or jsonb_typeof(tracked_prompts) = 'object'
  );

comment on column sites.tracked_prompts is
  'The buyer prompts this site''s weekly pass asks the AI engines, generated from sites.market, '
  'with when each was added and the rotations made (#1162, SPEC §6 D19/D33). Each week''s answers '
  'are in that week''s scans.report.';
