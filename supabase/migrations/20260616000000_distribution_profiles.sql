-- Deep domain profiling (M2) — shared distribution-profile cache.
--
-- Domain-keyed and SHARED ACROSS USERS: a popular competitor is profiled once
-- and reused by every scan that references it (the margin lever). `crawled_at`
-- drives cache freshness — callers re-profile when a row is older than the TTL.

create table if not exists distribution_profiles (
  domain text primary key,
  profile jsonb not null,
  crawled_at timestamptz not null default now()
);

-- Freshness lookups ("is the cached profile recent enough?").
create index if not exists distribution_profiles_crawled_at_idx
  on distribution_profiles (crawled_at);
