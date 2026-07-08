-- Per-scan external-API cost accounting.
--
-- `scans.cost_cents` already tracks Anthropic LLM spend (rolled from pipeline_runs).
-- DataForSEO and Tavily are the dominant per-user cost and were previously
-- untracked. These columns store each vendor's spend for the scan (in cents),
-- accumulated at the source (lib/scan/cost-context.ts) and flushed additively per
-- Inngest step. Per-user total spend = sum over the user's apps' scans of
-- (cost_cents + dataforseo_cost_cents + tavily_cost_cents).
--
-- DataForSEO returns real USD per request; Tavily is priced from its credit rules
-- (TAVILY_USD_PER_CREDIT). Default 0 so historical scans read as "not measured".

alter table public.scans
  add column if not exists dataforseo_cost_cents numeric not null default 0,
  add column if not exists tavily_cost_cents numeric not null default 0;

comment on column public.scans.dataforseo_cost_cents is
  'DataForSEO spend for this scan in cents (from each response envelope''s real USD cost).';
comment on column public.scans.tavily_cost_cents is
  'Tavily spend for this scan in cents (credits x TAVILY_USD_PER_CREDIT; Tavily returns no cost).';
