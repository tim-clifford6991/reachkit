-- Dedupe the public teardown index on the DERIVED DOMAIN, not app_id. Legacy
-- www/path URL variants create multiple apps rows for one site that all collapse
-- to the same /scan/<slug>; deduping per-app left duplicate slugs → duplicate
-- React keys, duplicate sitemap URLs, and an inflated count. Dedupe on the bare
-- host (latest completed scan wins) so one domain = one entry. Also lock the view
-- to security_invoker so it isn't anonymously bulk-enumerable via PostgREST
-- (only serverDb()/service-role reads it).
create or replace view public_scans with (security_invoker = on) as
select distinct on (regexp_replace(regexp_replace(lower(a.store_url), '^https?://(www\.)?', ''), '/.*$', ''))
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
order by
  regexp_replace(regexp_replace(lower(a.store_url), '^https?://(www\.)?', ''), '/.*$', ''),
  s.completed_at desc;
