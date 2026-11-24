-- scripts/pass/plan-export.sql — one weekly pass's plan inputs, by plain columns, for `node scripts/pass/plan.mjs`.
--
-- Read-only, through the Supabase connector, fetched and checked in chunks as `assemble.mjs` says
-- (`node scripts/pass/assemble.mjs <dir> --out <file>`). Replace :SCAN with the pass's scan id.
--
-- It holds no `fetches` row, no user id and no draft body: the scan's times and its report, the top tens
-- of the scans the site's topics came from, the site's market, every topic row of the site, its drafts
-- by date and state, and its publications by liveness. A topic's search names a customer's business, so the file
-- stays off the public repository; only the replay's anonymised golden is committed.
with x as (select id, site_id, created_at, finished_at, week_start from scans where id = ':SCAN'),
snap as (
  select jsonb_build_object(
    'scan', (select to_jsonb(x) from x),
    'site', (select jsonb_build_object('id', s.id, 'domain', s.domain, 'market', s.market) from sites s, x where s.id = x.site_id),
    'report', (select c.report from scans c, x where c.id = x.id),
    'reports', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'created_at', c.created_at, 'questions', c.report->'questions', 'serps', c.report->'serps') order by c.created_at), '[]'::jsonb)
      from scans c, x where c.id = x.id or c.id in (select o.scan_id from opportunities o where o.site_id = x.site_id and o.created_at < x.created_at)),
    'opportunities', (select coalesce(jsonb_agg(to_jsonb(o) order by o.created_at, o.id), '[]'::jsonb) from opportunities o, x where o.site_id = x.site_id),
    'drafts', (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'opportunity_id', d.opportunity_id, 'state', d.state, 'title', d.title, 'scheduled_for', d.scheduled_for, 'created_at', d.created_at) order by d.created_at), '[]'::jsonb) from drafts d, x where d.site_id = x.site_id),
    'publications', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'draft_id', p.draft_id, 'live_url', p.live_url, 'claimed_at', p.claimed_at, 'published_at', p.published_at, 'unpublished_at', p.unpublished_at) order by p.claimed_at, p.id), '[]'::jsonb) from publications p, x where p.site_id = x.site_id)
  ) j
)
-- The document's size and checksum, then each chunk, exactly as `export.sql`'s closing lines say.
select length(j::text) len, md5(j::text) md5 from snap;
