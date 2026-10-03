-- SPEC §0 "Knowledge base" · §5 (2026-09-29, issue 1133).
--
-- Two columns, on the two rows the profile already has, for the two owners
-- it already has:
--
--   site_profiles.knowledge      what a crawl read, one reading per page with
--                                the address it was read from. Derived and
--                                domain-keyed, replaced by the next read.
--   site_profile_edits.answers   the founder's answers to setup's five
--                                questions. Theirs and site-keyed; no read
--                                touches it.
--
-- No new table, so no new policy: each column is read and written under the
-- row's existing ones (20260912090000, 20260921120000).

alter table site_profiles
  add column knowledge jsonb not null default '{}'::jsonb,
  add constraint site_profiles_knowledge_is_object check (jsonb_typeof(knowledge) = 'object'),
  -- A hundred pages of bounded lists is well inside this; it is the bound
  -- on a writer that has gone wrong, not on a real reading.
  add constraint site_profiles_knowledge_bounded check (pg_column_size(knowledge) <= 1048576);

alter table site_profile_edits
  add column answers jsonb not null default '{}'::jsonb,
  add constraint site_profile_edits_answers_is_object check (jsonb_typeof(answers) = 'object'),
  add constraint site_profile_edits_answers_bounded check (pg_column_size(answers) <= 16384);
