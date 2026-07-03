-- Structured persistence for the demand layer's assembled output.
--
-- Today `gatherDemand` (lib/scan/demand/gather.ts) lives ENTIRELY behind a 7-day
-- `cachedJson` (generic `search_cache` blob keyed by a string). When that entry
-- expires it silently re-triggers the full (expensive: LLM ICP inference, keyword
-- ideas, review mining, community discovery) gather AND loses all history — there's
-- no queryable row to fall back to. This table gives the assembled DemandIntel a
-- typed, queryable home so a JSON-cache miss can degrade to "reassemble from a
-- fresher-than-TTL row" instead of "recompute everything from scratch".
--
-- Mirrors the pattern from 20260629140000_intel_structured_tables.sql: scalar
-- columns for queryable/indexable values, jsonb for genuinely nested/variable
-- structures, composite PK keyed by subject_domain + cohort_key, a fetched_at
-- timestamptz, IF NOT EXISTS so re-runs are safe. RLS enabled with NO public
-- policies (service-role client bypasses RLS by design — see
-- 20260702120000_intel_tables_rls.sql for the rationale).
--
-- cohort_key = sorted, comma-joined competitor domains supplied by the caller.
-- An empty string ("") means the default auto-discovered cohort.

create table if not exists demand_intel (
  subject_domain  text        not null,
  cohort_key      text        not null default '',
  category        text,
  icp             jsonb,
  search_demand   jsonb,
  community       jsonb,
  buyer_insights  jsonb,
  fetched_at      timestamptz not null default now(),
  primary key (subject_domain, cohort_key)
);

alter table if exists public.demand_intel enable row level security;
