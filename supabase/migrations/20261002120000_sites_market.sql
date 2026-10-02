-- sites.market — the market and rivals ReachKit concluded for the site.
--
-- Issue #1185 · SPEC §0, §5 and §6 (owner, D28 of 2026-10-02): ReachKit
-- identifies and maintains each site's market and rivals itself, from
-- evidence, and re-checks them each pass; the founder may override them but
-- never has to. `sites.category` and `sites.competitors` stay what every pass
-- measures; this column is what they follow and why:
--
--   current             the concluded market — buyer, job, category with its
--                       synonyms, differentiators, not-our-market and the
--                       3–5 rivals — each with its one-line reason
--   adoptedAt           when `current` was adopted
--   pending             a differing market seen once, adopted only if the
--                       next pass concludes it again (the stability rule)
--   categoryOverridden  the founder set the category; no pass replaces it
--   rivalsOverridden    the founder set the rivals; no pass replaces them
--   lastChange          what the latest adoption changed, for the weekly mail
--
-- Null is a site no pass has concluded for yet. Written by the passes and by
-- setup through `src/lib/market/infer/stored.ts`; the founder's own saves
-- set the two override flags (`src/lib/market/changes/declared.ts`).
--
-- Rule 3a: the `sites` topic (`src/lib/db/topics.ts`).

alter table sites
  add column market jsonb,
  add constraint sites_market_is_object check (market is null or jsonb_typeof(market) = 'object');

comment on column sites.market is
  'The market and rivals ReachKit concluded for this site, with a reason for each, the pending '
  'conclusion the stability rule holds, and the founder''s overrides (#1185, SPEC §0/§5/§6 D28). '
  'sites.category and sites.competitors follow it unless the founder overrode them.';
