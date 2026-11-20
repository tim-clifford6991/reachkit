-- scripts/eval-models/export/passes.sql: the model evaluation's pass cases (E3), reachkit.app only, and nothing but
-- the owner's own site. The owner runs it once in the Supabase SQL editor, read-only, and exports CSV.
--
-- One row per pass, the 3 latest deep or weekly passes: `doc`, the pass as `scripts/pass/export.sql` builds it (the
-- body below is that file's, with its scan `x` taken per pass rather than from :SCAN), and its `len` and `md5`, which
-- the evaluation's loader (`scripts/eval-models/cases.ts`) recomputes and refuses the file on any difference.
-- The site's two mail timestamps are left out too: the loader refuses any key that names mail.
-- Replay one with: npm run pass -- --site reachkit.app --replay <scan> --cases passes.csv --eval-site <site> ...
with picked as (
  select id from scans
  where site_id = '0bbcc532-e420-447c-9e81-f05ccbda27ff' and tier in ('deep', 'weekly') and status <> 'running'
  order by created_at desc limit 3
),
c as (
  select (select jsonb_build_object(
    'scan', to_jsonb(x),
    'site', (select to_jsonb(s) - 'user_id' - 'connected_mail_sent_at' - 'setup_done_mail_sent_at' from sites s where s.id = x.site_id),
    'siteProfile', (select to_jsonb(p) - 'logo_image' from site_profiles p where p.domain = x.domain),
    'siteProfileEdits', (select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb) from site_profile_edits e where e.site_id = x.site_id),
    'opportunities', (select coalesce(jsonb_agg(to_jsonb(o) order by o.created_at, o.id), '[]'::jsonb) from opportunities o where o.site_id = x.site_id),
    'drafts', (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'site_id', d.site_id, 'opportunity_id', d.opportunity_id, 'state', d.state, 'created_at', d.created_at) order by d.created_at), '[]'::jsonb) from drafts d where d.site_id = x.site_id),
    'destinations', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'site_id', t.site_id, 'kind', t.kind, 'hostname', t.hostname, 'health', t.health, 'deleted_at', t.deleted_at, 'created_at', t.created_at)), '[]'::jsonb) from destinations t where t.site_id = x.site_id),
    'otherScans', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'site_id', c.site_id, 'domain', c.domain, 'tier', c.tier, 'status', c.status, 'created_at', c.created_at, 'finished_at', c.finished_at, 'report', jsonb_build_object('questions', c.report->'questions', 'serps', c.report->'serps')) order by c.created_at), '[]'::jsonb)
      from scans c where c.id <> x.id and c.id in (select o.scan_id from opportunities o where o.site_id = x.site_id and o.family <> 'fix' and o.created_at < x.created_at and (o.status in ('open', 'queued', 'done') or o.status_changed_at >= x.created_at))),
    'fetches', (select coalesce(jsonb_agg(jsonb_build_object('scan_id', f.scan_id, 'source', f.source, 'cache_key', f.cache_key, 'policy_version', f.policy_version, 'cost_cents', f.cost_cents, 'reserved_cents', f.reserved_cents, 'created_at', f.created_at, 'duration_ms', f.duration_ms,
        'payload', case
          when f.source = 'dataforseo_labs/google/ranked_keywords' and f.payload->'total' is not null and jsonb_typeof(f.payload->'total') = 'number'
            then jsonb_build_object('total', f.payload->'total', 'rows', '[]'::jsonb, 'rowsTrimmed', jsonb_array_length(f.payload->'rows'))
          when f.source = 'serp/google/organic'
            then case when jsonb_typeof(f.payload) = 'object' then f.payload else '"read"'::jsonb end
          else f.payload end) order by f.created_at, f.id), '[]'::jsonb)
      from fetches f
      where (f.scan_id = x.id and f.source in ('dataforseo_labs/google/ranked_keywords', 'dataforseo_labs/google/keyword_overview', 'serp/google/organic', 'dataforseo_labs/google/keyword_suggestions', 'market-inference', 'market-terms', 'market-searches', 'rival-inference', 'opportunity-typing', 'topic-buyer-searches', 'topic-typed', 'topic-fit', 'topic-same-question'))
         or (f.scan_id <> x.id and f.source in ('dataforseo_labs/google/ranked_keywords', 'dataforseo_labs/google/keyword_overview', 'dataforseo_labs/google/keyword_suggestions', 'market-terms', 'market-inference', 'market-searches', 'rival-inference')
             and f.scan_id in (select id from scans where site_id = x.site_id)
             and f.created_at >= x.created_at - interval '30 days' and f.created_at < x.created_at)),
    'ledger', (select coalesce(jsonb_agg(jsonb_build_object('source', l.source, 'n', l.n, 'cents', l.cents) order by l.source), '[]'::jsonb)
      from (select f.source, count(*) n, sum(f.cost_cents) cents from fetches f where f.scan_id = x.id group by f.source) l)
  ))::text doc
  from picked, lateral (select * from scans where id = picked.id) x
)
select doc, length(doc) len, md5(doc) md5 from c;
