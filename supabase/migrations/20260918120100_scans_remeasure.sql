-- supabase/migrations/20260918120100_scans_remeasure.sql
--
-- SPEC §5 (issue 855) and §6 (issue 837) — which pass an automatic
-- re-measure is measuring again, and the one rule that makes a second
-- delivery of the maintenance tick harmless (issue 886).
--
-- `account/maintenance` is a clock tick with no idempotency key. Of its
-- fifteen obligations, one starts a paid pass on its own: a site whose
-- newest deep pass a ceiling stopped is measured again. What stopped a
-- second delivery from starting a second pass is `remeasureAllowed()`
-- reading the site's own `scans` rows first — a pass claimed inside
-- `REMEASURE.runningHoldMin` is under way and the next start is refused.
-- That is exact for a delivery arriving after the first has claimed its
-- row, and it is a read-then-write for two that arrive together: both read
-- no running pass, both claim one, and the site is billed for two.
--
-- The bound that read enforces is a window on a clock, so it cannot be an
-- index: a `running` row is only under way for the length of the hold, and
-- a unique index over `(site_id) where status = 'running'` would go on
-- refusing a founder's own *measure again now* for ever behind one pass
-- that froze. The fact that does not decay is **which pass is being
-- measured again**: at most one automatic re-measure per cut-short pass.
-- Two ticks holding the same cut-short pass race on this column, one of
-- them wins, and the winner's row is then the site's newest deep pass — so
-- `sitesWithoutDeepPass()` stops naming the site at all.
--
-- Null for every pass that is not an automatic re-measure: the onboarding
-- pass, a weekly pass, a free scan, and the founder's own press in Settings
-- or the side panel, which is a person and is bounded by `REMEASURE.perDay`
-- rather than by this index.
--
-- The reference is to `scans` itself and carries no `on delete cascade`,
-- like every other foreign key in this schema (ADR-051 point 2).
--
-- Topic token `scans` (`src/lib/db/topics.ts`).

alter table scans add column if not exists remeasure_of uuid references scans (id);

create unique index if not exists scans_one_remeasure_per_pass
  on scans (remeasure_of)
  where remeasure_of is not null;
