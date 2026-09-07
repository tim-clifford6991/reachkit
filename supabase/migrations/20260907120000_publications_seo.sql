-- supabase/migrations/20260907120000_publications_seo.sql
--
-- BUILD §9 · REQ-060 criterion 4 (issue #156) — which SEO plugins the
-- destination's site actually wrote the page's title and description into,
-- so that the one written line criterion 4 requires has something to be
-- rendered from.
--
-- `structure.md` rule 3a: the bare `publications` topic, the same way
-- `*_publications_core.sql` is — this is that node's own column.
--
-- **A new column, and not `publications.verify`.** The archived plan
-- (WO-238) proposed carrying this inside "the publication row's existing
-- `verify` jsonb sibling field". That is the one place it must not go, and
-- the reason is a live index rather than a matter of taste:
-- `idx_publications_verify_due` is partial `where verify is null`, and
-- `dueNow()` selects on exactly that predicate. Writing an SEO answer into
-- `verify` at the moment of delivery would make the column non-null hours
-- before any check ran, drop the row out of the due index, and silently
-- retire every WordPress page from §9's 24-hour verification. `verify` is
-- owned by the verification node and holds one recorded check (`stored.ts`
-- is its only reader); this fact is written by the delivery, at a different
-- moment, by a different node.
--
-- **`text[]`, nullable, no default — three states, all three meant.**
--
--   · `null` — no delivery has recorded an answer here: a claimed row whose
--     delivery never landed, or a destination that has no such answer to
--     give. A destination ReachKit runs writes the page's metadata itself
--     and has no plugin to look for, so its rows stay null, which is what
--     keeps criterion 4's line off every hosted page.
--   · `'{}'` — **an answer, and the one criterion 4 is about**: the page was
--     delivered and the site wrote it into no SEO plugin. This is the row
--     that carries the line.
--   · `'{yoast}'`, `'{yoast,rankmath}'` — at least one plugin took the
--     fields. No line.
--
-- A `not null default '{}'` would erase the first state into the second and
-- put criterion 4's line on every page in the product, including the hosted
-- ones and the ones that were never delivered at all. That is why there is
-- no default.
--
-- **The members are not constrained here.** Which plugins exist is the
-- adapter's vocabulary (`src/lib/publish/destinations/wordpress/seo.ts`),
-- and a check constraint naming them would be a second, staler copy of a
-- closed list that lives in code — one that rejects a row rather than a
-- deploy when the two disagree. Nothing renders a member: every reader in
-- the product asks only whether the array is empty.
--
-- No index: it is read only on a publication row already found by
-- `draft_id`, and nothing selects publications *by* it.

alter table publications
  add column seo_written text[] null;

comment on column publications.seo_written is
  'BUILD §9 · REQ-060 c4 (issue #156). Which SEO plugins the destination''s site actually wrote the title and description into, read back from the destination''s own answer. Null means no delivery recorded an answer (never delivered, or a destination with no plugins to find, such as hosted). An empty array is an answer: delivered, and written into no plugin — the one case that carries criterion 4''s line on the page record.';
