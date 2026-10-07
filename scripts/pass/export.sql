-- scripts/pass/export.sql — one stored pass as one JSON document, for
-- `npm run pass -- --replay <scanId>` (SPEC §6, D64, issue 1301).
--
-- This box holds no production database key, so a pass is exported through
-- the Supabase connector, read-only, and committed under
-- `scripts/pass/snapshot/<first 8 of the scan id>.json`. Replace :SCAN with
-- the scan's id. The statement below builds the document as `snap.j`;
-- `scripts/pass/assemble.mjs` says how it is fetched in checked chunks.
--
-- What it holds: the scan row with its report; the site's row (without its
-- owner), profile (without the logo), founder edits, topics, and which
-- topics were drafted; the questions and top tens of the earlier scans the
-- site's topics came from; and the `fetches` rows the replayed steps read —
-- this pass's model answers, keyword volumes and rival sizings (a sizing
-- keeps its total and drops its hundred rows), its Google SERP reads as
-- outcomes only, and the site's sizings, keyword and market reads of the
-- thirty days before it, which the pass was served from the cache. Since
-- D65 (issue 1303) it also holds the suggestions the pass's seeds bought,
-- so the measured searches are chosen again, and the rival conclusions of
-- the thirty days before, which name a rival the pass dropped. `ledger` is
-- every source's count and cost for the pass.
with x as (select * from scans where id = ':SCAN'),
snap as (
  select jsonb_build_object(
    'scan', (select to_jsonb(x) from x),
    'site', (select to_jsonb(s) - 'user_id' from sites s, x where s.id = x.site_id),
    'siteProfile', (select to_jsonb(p) - 'logo_image' from site_profiles p, x where p.domain = x.domain),
    'siteProfileEdits', (select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb) from site_profile_edits e, x where e.site_id = x.site_id),
    'opportunities', (select coalesce(jsonb_agg(to_jsonb(o) order by o.created_at, o.id), '[]'::jsonb) from opportunities o, x where o.site_id = x.site_id),
    'drafts', (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'site_id', d.site_id, 'opportunity_id', d.opportunity_id, 'state', d.state, 'created_at', d.created_at) order by d.created_at), '[]'::jsonb) from drafts d, x where d.site_id = x.site_id),
    'destinations', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'site_id', t.site_id, 'kind', t.kind, 'hostname', t.hostname, 'health', t.health, 'deleted_at', t.deleted_at, 'created_at', t.created_at)), '[]'::jsonb) from destinations t, x where t.site_id = x.site_id),
    'otherScans', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'site_id', c.site_id, 'domain', c.domain, 'tier', c.tier, 'status', c.status, 'created_at', c.created_at, 'finished_at', c.finished_at, 'report', jsonb_build_object('questions', c.report->'questions', 'serps', c.report->'serps')) order by c.created_at), '[]'::jsonb)
      from scans c, x where c.id <> x.id and c.id in (select o.scan_id from opportunities o where o.site_id = x.site_id and o.family <> 'fix' and o.created_at < x.created_at and (o.status in ('open', 'queued', 'done') or o.status_changed_at >= x.created_at))),
    'fetches', (select coalesce(jsonb_agg(jsonb_build_object('scan_id', f.scan_id, 'source', f.source, 'cache_key', f.cache_key, 'policy_version', f.policy_version, 'cost_cents', f.cost_cents, 'reserved_cents', f.reserved_cents, 'created_at', f.created_at, 'duration_ms', f.duration_ms,
        'payload', case
          when f.source = 'dataforseo_labs/google/ranked_keywords' and f.payload->'total' is not null and jsonb_typeof(f.payload->'total') = 'number'
            then jsonb_build_object('total', f.payload->'total', 'rows', '[]'::jsonb, 'rowsTrimmed', jsonb_array_length(f.payload->'rows'))
          when f.source = 'serp/google/organic'
            then case when jsonb_typeof(f.payload) = 'object' then f.payload else '"read"'::jsonb end
          else f.payload end) order by f.created_at, f.id), '[]'::jsonb)
      from fetches f, x
      where (f.scan_id = x.id and f.source in ('dataforseo_labs/google/ranked_keywords', 'dataforseo_labs/google/keyword_overview', 'serp/google/organic', 'dataforseo_labs/google/keyword_suggestions', 'market-inference', 'market-terms', 'market-searches', 'rival-inference', 'opportunity-typing', 'topic-buyer-searches', 'topic-typed', 'topic-fit', 'topic-same-question'))
         or (f.scan_id <> x.id and f.source in ('dataforseo_labs/google/ranked_keywords', 'dataforseo_labs/google/keyword_overview', 'dataforseo_labs/google/keyword_suggestions', 'market-terms', 'market-inference', 'market-searches', 'rival-inference')
             and f.scan_id in (select id from scans where site_id = x.site_id)
             and f.created_at >= x.created_at - interval '30 days' and f.created_at < x.created_at)),
    'ledger', (select coalesce(jsonb_agg(jsonb_build_object('source', l.source, 'n', l.n, 'cents', l.cents) order by l.source), '[]'::jsonb)
      from (select f.source, count(*) n, sum(f.cost_cents) cents from fetches f, x where f.scan_id = x.id group by f.source) l)
  ) j
)
-- The document's size and checksum, and proof that the two stand-in
-- characters the chunks use are not in it:
--   , t as (select j::text raw from snap)
--   select length(raw) len, md5(raw) md5, position('¤' in raw) p1, position('¬' in raw) p2 from t;
-- Chunk :I of 10,000 characters, with `"` and `\` stood in for so the
-- connector's own escaping cannot corrupt a copy:
--   , t as (select j::text raw from snap)
--   select i, md5(substr(raw, i * 10000 + 1, 10000)) md5, translate(substr(raw, i * 10000 + 1, 10000), '"\', '¤¬') c
--   from t, generate_series(:I, :I) i;
