-- Retire the write-only ("dead-write") intel tables.
--
-- Root-cause cleanup for the "two parallel data homes" confusion: every intel
-- gatherer used to write a typed table AND an in-memory cachedJson blob, but the
-- UI only ever reads the caches + scans.report_payload. These 7 tables were
-- upserted on every gather and never read back — pure write cost + schema noise.
--
-- KEPT (intentionally NOT dropped): `demand_intel`, which IS read back by
-- readDemandIntelFallback() as a cross-scan read-through cache (a JSON-cache miss
-- falls back to a fresher-than-TTL row before paying for a full gather).
--
-- DROP TABLE ... CASCADE also removes the tables' RLS policies + indexes.

drop table if exists public.keyword_gap cascade;
drop table if exists public.demand_pocket cascade;
drop table if exists public.content_plan_item cascade;
drop table if exists public.distribution_plan_item cascade;
drop table if exists public.cohort_competitor cascade;
drop table if exists public.domain_intel cascade;
drop table if exists public.domain_content_page cascade;
