-- llm_mention_reads.status — two more reasons a week was not bought.
--
-- Issue #1162 · SPEC §6 (owner, D32 of 2026-10-03): LLM Mentions is bought
-- only for a site whose own ranked footprint is 30 keywords or more, and
-- then monthly, not weekly. A week without it says so, so each skip is a
-- stored status beside the cap's:
--
--   skipped_footprint — the site ranks for fewer than 30 keywords
--   skipped_monthly   — it was bought inside the last four weeks
--
-- Rule 3a: the `sites_mentions` sub-token (`src/lib/db/topics.ts`).

alter table llm_mention_reads
  drop constraint llm_mention_reads_status_known,
  add constraint llm_mention_reads_status_known check (
    status in ('measured', 'zero', 'skipped_cap', 'skipped_footprint', 'skipped_monthly', 'failed')
  );

comment on column llm_mention_reads.status is
  'measured | zero | skipped_cap | skipped_footprint | skipped_monthly | failed. `zero` is a '
  'measurement — the engines answered nobody with this site that week. The two newer skips are '
  'D32''s: a site ranking for fewer than 30 keywords is not bought, and a site bought inside the '
  'last four weeks is not bought again (#1162).';
