-- Per-RUN external spend, split out from the lifetime accumulator.
--
-- `dataforseo_cost_cents` / `tavily_cost_cents` are a LIFETIME accumulator for the
-- scan ROW: every cost-bearing flush lands there — the scan's own pipeline passes
-- AND all post-scan spend (interactive intel gathers + the weekly-refresh cron,
-- which flush onto the app's *latest* scan row). That correctly answers "what has
-- this app cost since?" and is what the soft cap reads — but a per-scan reader
-- (e.g. /app/diagnostics) misread it as "what did THIS scan cost", over-reporting
-- by all later interactions (root cause C-COST, 2026-07-17).
--
-- These two columns accumulate ONLY the scan's own pipeline-run spend (its free +
-- deep passes; `costedStep(..., { phase: "run" })`), so "what did this scan cost"
-- and "what has this app cost since" become distinct, answerable questions. The
-- lifetime columns and the cap's breach logic are UNCHANGED (invariant #2).
alter table public.scans
  add column if not exists run_dataforseo_cost_cents numeric not null default 0,
  add column if not exists run_tavily_cost_cents numeric not null default 0;

comment on column public.scans.run_dataforseo_cost_cents is
  'DataForSEO spend of THIS scan''s pipeline run(s) only (free + deep passes), in cents. Excludes post-scan intel/refresh spend, which lands only in the lifetime dataforseo_cost_cents. "What did this scan cost".';
comment on column public.scans.run_tavily_cost_cents is
  'Tavily spend of THIS scan''s pipeline run(s) only, in cents. Excludes post-scan spend (see run_dataforseo_cost_cents).';

-- NOTE: existing rows keep run_* = 0 (this data was never separated before). The
-- lifetime columns are NOT back-adjusted — they are correct as lifetime totals.
