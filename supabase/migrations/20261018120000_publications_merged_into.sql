-- supabase/migrations/20261018120000_publications_merged_into.sql
--
-- SPEC §7 (issue 1506, owner 2026-10-18: "follow all recommendations from
-- our seo master") — a live page whose topic no longer qualifies is merged
-- into another live page of its site, and its address answers 301 there.
--
-- A move (issue 1487) needs no column: the newer publication is an update
-- of the old address, and `addressOf` follows the update. A merge has no
-- such update. The page it goes into was written for its own search, long
-- before, and names nothing of the page merged into it. So the old rows
-- name it instead: **`merged_into`** is the publication the address now
-- answers with. It is written once, in the same statement that takes the
-- row out of the live set (`unpublished_at`), beside the state machine's
-- `published → unpublished` (reason `moved`). No unpublish outcome is
-- recorded, because the page was not taken down.
--
-- Null on every other row. ADR-080 decision 2 stands: no row is deleted,
-- and the pointer is never cleared. A merged page's address follows its
-- target wherever that page later moves, or answers 410 where the target
-- itself is taken down.
--
-- RLS is the table's own: the owner reads its rows, nobody else does.
--
-- Applied after merge through the Supabase connector (docs/PROCESS.md step 4).

alter table publications
  add column merged_into uuid null references publications (id),
  add constraint publications_merged_into_not_self check (merged_into is null or merged_into <> id),
  add constraint publications_merged_into_only_unpublished check (merged_into is null or unpublished_at is not null);
