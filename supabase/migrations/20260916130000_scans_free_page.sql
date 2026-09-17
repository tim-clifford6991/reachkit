-- supabase/migrations/20260916130000_scans_free_page.sql
--
-- SPEC §2 (issue 826) — the free first page is written once per report, not
-- once per lead. `leads` is unique per (scan, email), so a page stored on the
-- lead was a paid write for every address a visitor typed. The page now lives
-- on the scan that offered it, and every lead on that report is mailed the
-- same stored page.
--
-- `free_page_state`:
--   null      nobody has tried, or the last try failed to produce a page
--   'writing' one writer holds the scan (claimed at `free_page_claimed_at`)
--   'written' the page is stored below; later leads reuse it for nothing
--   'refused' the hard rules turned it down; later leads are told so and no
--             second write is attempted
--
-- The claim is a conditional update (`where free_page_state is null`), so two
-- ticks cannot both start a write. The check below is the one invariant the
-- application must not be trusted with: a `written` scan always carries its
-- page.
--
-- RLS is unchanged: `scans` has no `anon` policy, and the owning user's
-- select policy already covers the row. Written through `dbAdmin()` only.

alter table scans
  add column free_page_state text
    check (free_page_state in ('writing', 'written', 'refused')),
  add column free_page_claimed_at timestamptz,
  add column free_page_title text,
  add column free_page_markdown text,
  add constraint scans_free_page_written_has_page
    check (free_page_state is distinct from 'written'
      or (free_page_title is not null and free_page_markdown is not null));
