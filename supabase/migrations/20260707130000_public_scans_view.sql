-- One public teardown per app: the latest completed WEB scan. Powers the
-- /teardowns index (search + pagination) and the sitemap. Read via the service
-- role (serverDb), so no RLS grant is required.
create or replace view public_scans as
select distinct on (s.app_id)
  s.app_id,
  s.id            as scan_id,
  s.score_total,
  s.completed_at,
  a.store_url,
  a.platform
from scans s
join apps a on a.id = s.app_id
where s.status = 'done'
  and s.completed_at is not null
  and a.platform = 'web'
order by s.app_id, s.completed_at desc;
