-- Supply-layer domain intel: typed per-domain metrics from the two-lens computation.
--
-- Scalar metrics are typed columns (bigint/integer/real) so they are queryable and
-- indexable. The small variable-key maps (referrer_categories, traffic_sources,
-- growth_activities) stay jsonb — their keys vary by domain and would not benefit
-- from normalization at this scale.
--
-- Keyed by domain (primary key) — shared globally across all users. A popular
-- competitor is computed once and reused by every cohort that includes it.

create table if not exists domain_intel (
  domain                  text        primary key,
  organic_etv             bigint      not null default 0,
  organic_keywords        integer     not null default 0,
  paid_etv                bigint      not null default 0,
  paid_keywords           integer     not null default 0,
  referring_domains       integer     not null default 0,
  branded_search_volume   integer     not null default 0,
  top_pages_count         integer     not null default 0,
  quality_share           real        not null default 0,
  referrer_categories     jsonb       not null default '{}'::jsonb,
  traffic_sources         jsonb       not null default '{}'::jsonb,
  growth_activities       jsonb       not null default '{}'::jsonb,
  fetched_at              timestamptz not null default now()
);
