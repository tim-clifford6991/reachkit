-- supabase/migrations/20261115120000_scans_ref.sql
--
-- SPEC §2, Channel tag (owner D7, 2026-11-15) — the outreach channel's tag
-- on the landing link that started a free scan. Expand-only: one nullable
-- column. Stored scans keep null; there is nothing to retrofit from.
--
-- The route writes only a tag on `src/lib/analytics/ref.ts`'s allow-list;
-- the check refuses free text even where that code is bypassed.

alter table scans
  add column ref text check (ref is null or ref ~ '^[a-z]{1,16}$');

comment on column scans.ref is
  'Owner D7, 2026-11-15, #2689. The allow-listed outreach tag (?ref=) on the landing link that started this free scan, else null. Never read by admission, the bounds, cost attribution or the report.';
