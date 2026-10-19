-- supabase/migrations/20261019140000_search_ladder.sql
--
-- Issue 1553 (owner 2026-10-19: "approved for all, following precisely the
-- seo master recommendations") — the SEO metrics review's R2. Every live
-- hosted host is verified in Google Search Console and Bing Webmaster Tools
-- under ReachKit's own account, and each page shows how far it has got
-- toward being found: published → crawled → indexed → impressions → best
-- place → cited. Three facts need a place to stand, and each goes on the
-- row it is about. No new table.
--
-- **`publication_reads` counts Googlebot and Bingbot too.** A verified
-- crawler fetch (its address inside the engine's published ranges) is
-- counted by day, page and engine under the new kind `crawl`, exactly as an
-- answer-engine fetch is: a count, no address, no agent string. The address
-- is checked and dropped before the write; it never reaches this table.
-- This amends SPEC §7 of 2026-09-20 ("Nothing else about a visit is kept")
-- by the owner's ruling on issue 1553.
--
-- **`publications.announced_at`** is when IndexNow last accepted the page's
-- address (200 or 202). Until issue 1511 only a log line kept it. A live
-- hosted page with none was never announced, and the weekly pass announces
-- it once; the stamp is what makes "once" true.
--
-- **`publications.search_reading`** is the page's newest weekly reading:
-- what Search Console and Bing said about it, whether a stored SERP held it
-- (issue 1538's `seen`), whether a stored AI answer cited it, and whether a
-- crawler was ever counted on it. One value, overwritten each week; the
-- ladder reads it and nothing else reads it.
--
-- **`destinations.search_verification`** is the host's standing with each
-- engine: the meta token the hosted index serves, which pooled Search
-- Console account holds the property, and when it was verified and its
-- sitemap submitted. A token is public by design: the page prints it.
--
-- RLS is each table's own: the owner reads their rows, the server writes.
--
-- Applied after merge through the Supabase connector (docs/PROCESS.md step 4).

alter table publication_reads
  drop constraint publication_reads_engine_known,
  add constraint publication_reads_engine_known check (
    engine in ('chatgpt', 'perplexity', 'claude', 'gemini', 'copilot', 'google', 'bing')
  ),
  drop constraint publication_reads_kind_known,
  add constraint publication_reads_kind_known check (
    kind in ('answer_fetch', 'index_fetch', 'referral', 'crawl')
  );

comment on column publication_reads.kind is
  'Why: answer_fetch (an engine fetching the page for a person''s question), index_fetch (an '
  'engine building the index it answers from), referral (a person arriving from an AI answer), '
  'or crawl (Googlebot or Bingbot from an address in the engine''s published ranges; issue 1553).';

alter table publications
  add column announced_at timestamptz null,
  add column search_reading jsonb null;

comment on column publications.announced_at is
  'When IndexNow last accepted this page''s address (issue 1553). Null: never announced.';
comment on column publications.search_reading is
  'The page''s newest weekly search reading (issue 1553): Search Console and Bing, seen, cited, crawled.';

alter table destinations
  add column search_verification jsonb null;

comment on column destinations.search_verification is
  'The hosted host''s Search Console and Bing Webmaster standing (issue 1553): meta token, account, verified and sitemap dates.';
