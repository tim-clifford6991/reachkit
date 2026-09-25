-- free_scan_listing — every finished free scan, as the gallery lists it.
--
-- Issue #1069 · SPEC §2 (2026-09-24, owner on #1058): "every finished free
-- scan appears, as its report already does, until its owner asks through
-- remove@reachkit.app; a removed or refused site appears in neither the
-- gallery nor the landing's logo strip."
--
-- **One row per domain: its newest finished free scan.** A correction or a
-- re-scan writes a new row; the listing shows the latest reading, as the
-- report address does. `failed` scans have no report and are not finished.
-- A site whose home page could not be read (`site_unreadable`) has no score
-- and nothing to show, and is refused a listing like a removed one.
--
-- **Removed is `domain_blocks`**, the one takedown list (REQ-002 c4). The
-- view reads it on every query, so a row written by hand takes the site out
-- of the gallery and the strip at once, with no cache to wait for.
--
-- **Only `service_role` reads it.** `scans`, `site_profiles` and
-- `domain_blocks` have no anon policy — the public report is served by
-- `dbAdmin()` from the server — and this view is `security_invoker`, so it
-- could never widen that; the grants say the same thing outright.
--
-- The category is the market profile's own (`categoryOf`,
-- `src/lib/scan/sections.ts`): absent where the market was not measured.
--
-- Rule 3a: the `scans` topic with the `gallery` sub-token
-- (`src/lib/db/topics.ts`). Depends on `20260924120000_sites_profile_logo.sql`.

create view free_scan_listing with (security_invoker = true) as
select distinct on (s.domain)
       s.domain,
       coalesce(nullif(btrim(p.site_name), ''), s.domain) as company,
       lower(coalesce(nullif(btrim(p.site_name), ''), s.domain)) as company_key,
       s.score,
       nullif(btrim(s.report #>> '{market,value,profile,category}'), '') as category,
       coalesce(s.finished_at, s.created_at) as scanned_at,
       (p.logo_image is not null) as has_logo
  from scans s
  left join site_profiles p on p.domain = s.domain
 where s.tier = 'free'
   and s.status in ('done', 'degraded')
   and s.report is not null
   and s.stopped_reason <> 'site_unreadable'
   and not exists (select 1 from domain_blocks b where b.domain = s.domain)
 order by s.domain, coalesce(s.finished_at, s.created_at) desc;

comment on view free_scan_listing is
  'The free-scans gallery (/scans) and the landing strip: each domain''s newest finished free scan, '
  'never a removed (domain_blocks) or unreadable site. Read by dbAdmin() only (#1069, SPEC §2).';

revoke all on free_scan_listing from anon, authenticated;
grant select on free_scan_listing to service_role;
