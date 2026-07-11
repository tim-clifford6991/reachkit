-- External soft cap (invariant #2, hardening Phase 3c): stamped when a scan's
-- cumulative DataForSEO + Tavily spend crossed its per-tier cap and the pipeline
-- degraded (skipped remaining external enrichment). Surfaced on /app/diagnostics.
alter table scans add column if not exists external_cap_hit_at timestamptz;
