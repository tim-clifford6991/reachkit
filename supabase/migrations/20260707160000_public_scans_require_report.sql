-- A public teardown must actually have a renderable report. Legacy done scans
-- without a report_payload (completed pre-Phase-1) were being listed on
-- /teardowns but their /scan/<slug> page can't render → broken links. Require
-- report_payload IS NOT NULL so the index only lists scans that open.
create or replace view public_scans with (security_invoker = on) as
select distinct on (regexp_replace(regexp_replace(lower(a.store_url), '^https?://(www\.)?', ''), '/.*$', ''))
  s.app_id,
  s.id            as scan_id,
  s.score_total,
  s.completed_at,
  a.store_url,
  a.platform,
  s.report_payload #>> '{whatYouOffer,positioningMirror,gap}' as blurb
from scans s
join apps a on a.id = s.app_id
where s.status = 'done'
  and s.completed_at is not null
  and s.report_payload is not null
  and a.platform = 'web'
order by
  regexp_replace(regexp_replace(lower(a.store_url), '^https?://(www\.)?', ''), '/.*$', ''),
  s.completed_at desc;
