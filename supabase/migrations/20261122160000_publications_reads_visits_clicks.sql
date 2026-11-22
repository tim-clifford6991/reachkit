-- supabase/migrations/20261122160000_publications_reads_visits_clicks.sql
--
-- SPEC §7 *Hosted reads are counts*, owner rulings 74, 76 and 77 (2026-11-22). A hosted page counts every person's
-- visit by its source, and the clicks from it to the business's own links. Expand-only: two checks widen and one is
-- added; no column, key, function or row changes, so a build that predates this keeps writing what it wrote.
--
-- `engine` gains `other` (a referrer that is neither Google nor an AI app; Bing is one of them) and `none` (no
-- referrer). It also gains the five links a click is named by, which only an `outbound` row may carry.

alter table publication_reads
  drop constraint publication_reads_engine_known,
  add constraint publication_reads_engine_known check (
    engine in (
      'chatgpt', 'perplexity', 'claude', 'gemini', 'copilot', 'google', 'bing',
      'other', 'none',
      'site', 'book', 'quote', 'call', 'link'
    )
  ),
  drop constraint publication_reads_kind_known,
  add constraint publication_reads_kind_known check (
    kind in ('answer_fetch', 'index_fetch', 'referral', 'crawl', 'outbound')
  ),
  -- A click is never a visit, and a link's name is never a source.
  drop constraint if exists publication_reads_outbound_paired,
  add constraint publication_reads_outbound_paired check (
    (kind = 'outbound') = (engine in ('site', 'book', 'quote', 'call', 'link'))
  );

comment on column publication_reads.engine is
  'Which source or link: an AI app, google or bing for a fetch, crawl or visit; other (another site) or none (opened '
  'directly) for a visit; site, book, quote, call or link for an outbound click. Training crawlers are never counted.';
comment on column publication_reads.kind is
  'Why: answer_fetch, index_fetch, crawl (a verified Googlebot), referral (a person opening the page, by source) or '
  'outbound (a click from the page to the business''s own site, booking, quote or phone link).';
