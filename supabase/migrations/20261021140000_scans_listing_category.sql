-- scans.listing_category: the market profile's category, stored once per row,
-- so the free-scans gallery never unpacks a whole report to list it.
--
-- A stored generated column cannot drift from `report`, and the table rewrite
-- that adds it fills every stored scan at 0¢. The view below keeps its
-- columns, order, filters, grants and `security_invoker`; only the category
-- now comes from the column. Expand-only: no writer names this column.
--
-- Rule 3a: the `scans` topic with the `gallery` sub-token
-- (`src/lib/db/topics.ts`). Depends on `20260924120100_scans_gallery.sql`.

-- A queued ACCESS EXCLUSIVE lock stalls every read of scans; give up instead.
set lock_timeout = '3s';

alter table scans add column if not exists listing_category text
  generated always as (nullif(btrim(report #>> '{market,value,profile,category}'), '')) stored;

create or replace view free_scan_listing with (security_invoker = true) as
select distinct on (s.domain)
       s.domain,
       coalesce(nullif(btrim(p.site_name), ''), s.domain) as company,
       lower(coalesce(nullif(btrim(p.site_name), ''), s.domain)) as company_key,
       s.score,
       s.listing_category as category,
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

revoke all on free_scan_listing from anon, authenticated;
grant select on free_scan_listing to service_role;

reset lock_timeout;
