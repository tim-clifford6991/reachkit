-- Per-user MONTHLY cost rollup (hardening Phase 3b) — the persisted aggregation
-- behind the owner-only /app/diagnostics unit-economics table. User↔app linkage
-- is users.app_ids (uuid[]); scans carry the three cost columns
-- (cost_cents = LLM via pipeline_runs rollup; dataforseo/tavily = external).
-- A view (not a table): zero write-path risk, always consistent, cheap at this
-- scale; revisit as a materialized view or scans.user_id FK if it ever slows.
create or replace view user_spend_monthly as
select
  u.id                                        as user_id,
  u.email                                     as email,
  date_trunc('month', s.started_at)           as month,
  count(s.id)                                 as scans,
  coalesce(sum(s.cost_cents), 0)              as llm_cents,
  coalesce(sum(s.dataforseo_cost_cents), 0)   as dataforseo_cents,
  coalesce(sum(s.tavily_cost_cents), 0)       as tavily_cents,
  coalesce(sum(s.cost_cents + s.dataforseo_cost_cents + s.tavily_cost_cents), 0) as total_cents
from users u
left join lateral unnest(u.app_ids) as a(app_id) on true
left join scans s on s.app_id = a.app_id
group by u.id, u.email, date_trunc('month', s.started_at);

-- Owner/service-role read only — this is internal unit economics.
revoke all on user_spend_monthly from anon, authenticated;
