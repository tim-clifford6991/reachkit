-- Enable Row Level Security on intel/cache tables that shipped without it.
--
-- Every application access path goes through the service-role client
-- (lib/db/client.ts), which BYPASSES RLS. Enabling RLS with NO policies therefore
-- leaves all server-side reads/writes unaffected while denying anon/authenticated
-- PostgREST access — the correct posture, because these tables are keyed by
-- subject_domain and hold each customer's full keyword-gap / demand / content /
-- distribution intel (cross-tenant leak) and search_cache is response-poisonable
-- straight into user-facing reports. Without RLS, anyone holding the anon key gets
-- full read+write the moment that key reaches a browser.
--
-- Idempotent: enabling RLS on an already-enabled table is a no-op (prod already had
-- it on distribution_profiles; local did not — this aligns both environments).

alter table if exists public.search_cache            enable row level security;
alter table if exists public.distribution_profiles   enable row level security;
alter table if exists public.domain_intel            enable row level security;
alter table if exists public.domain_content_page     enable row level security;
alter table if exists public.keyword_gap             enable row level security;
alter table if exists public.demand_pocket           enable row level security;
alter table if exists public.content_plan_item       enable row level security;
alter table if exists public.distribution_plan_item  enable row level security;
alter table if exists public.cohort_competitor       enable row level security;
