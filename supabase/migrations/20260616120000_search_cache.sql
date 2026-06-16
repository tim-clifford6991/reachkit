-- Search cache (M4 hardening) — memoize expensive DataForSEO SERP calls.
--
-- Demand searches, "alternatives to X" lookups, and community-presence queries
-- repeat across reruns, weekly refreshes, and cohorts. Caching the responses
-- keyed by a hash of (kind, query, params) cuts DataForSEO credit burn sharply.
-- `created_at` drives TTL; callers ignore rows older than the window.

create table if not exists search_cache (
  key text primary key,
  response jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists search_cache_created_at_idx on search_cache (created_at);
