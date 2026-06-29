-- Content effectiveness: one row per classified organic page (Item 3).
-- Globally keyed by (domain, url) — shared across all users, computed once.
-- Persisted during gatherContentIntel so the next run reads from Supabase
-- instead of re-running the LLM classification calls.

create table if not exists domain_content_page (
  domain        text    not null,
  url           text    not null,
  title         text,
  content_type  text    not null default 'other',
  topic_cluster text,
  keyword_count integer not null default 0,
  etv           bigint  not null default 0,
  word_count    integer not null default 0,
  fetched_at    timestamptz not null default now(),
  primary key (domain, url)
);
