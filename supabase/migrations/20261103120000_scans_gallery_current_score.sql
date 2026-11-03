-- free_scan_listing.score: the domain's current scan's score, the one its
-- report at /scan/{domain} reads, so a card and its report state one number.
--
-- The newest free scan still decides what is listed, under which name and
-- date; a later own, weekly or corrected scan only moves the current row,
-- and the card read the free row's older score. Columns, order, filters,
-- grants and `security_invoker` are kept. `unique (domain) where is_current`
-- makes the join at most one row; no current row is no score, never 0.
--
-- Rule 3a: the `scans` topic with the `gallery` sub-token
-- (`src/lib/db/topics.ts`). Depends on `20261021140000_scans_listing_category.sql`.

set lock_timeout = '3s';

create or replace view free_scan_listing with (security_invoker = true) as
select distinct on (s.domain)
       s.domain,
       coalesce(nullif(btrim(p.site_name), ''), s.domain) as company,
       lower(coalesce(nullif(btrim(p.site_name), ''), s.domain)) as company_key,
       c.score,
       s.listing_category as category,
       coalesce(s.finished_at, s.created_at) as scanned_at,
       (p.logo_image is not null) as has_logo
  from scans s
  left join site_profiles p on p.domain = s.domain
  left join scans c on c.domain = s.domain and c.is_current
 where s.tier = 'free'
   and s.status in ('done', 'degraded')
   and s.report is not null
   and s.stopped_reason <> 'site_unreadable'
   and not exists (select 1 from domain_blocks b where b.domain = s.domain)
 order by s.domain, coalesce(s.finished_at, s.created_at) desc;

revoke all on free_scan_listing from anon, authenticated;
grant select on free_scan_listing to service_role;

reset lock_timeout;
