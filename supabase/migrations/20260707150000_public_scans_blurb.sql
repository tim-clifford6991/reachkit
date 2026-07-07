-- Expose the positioning-gap one-liner so the teardown cards can show a real
-- description without fetching the whole report_payload per card.
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
  and a.platform = 'web'
order by
  regexp_replace(regexp_replace(lower(a.store_url), '^https?://(www\.)?', ''), '/.*$', ''),
  s.completed_at desc;
