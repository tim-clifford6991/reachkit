-- scripts/rescore/export.sql — what `npm run rescore` reads, as one JSON
-- document (issue 1426). Read-only: run it through the Supabase connector or
-- the SQL editor; this box holds no production database key.
--
-- It carries each stored scan's report narrowed to what the re-score reads
-- (`RescoreReport` in `src/lib/scan/rescore.ts`), the `scans` columns it
-- rewrites, the home read its on-page facts came from, each site's stored
-- rival set, and each site profile's name. Nothing it leaves out is needed,
-- and nothing is re-bought.
--
-- A home read's HTML is cut to what `challengeOf`
-- (`src/lib/measure/challenge.ts`) reads of it: nothing where
-- `couldBeChallenge` would not read it; else its title, and on a refusing
-- status the first text one of the refusal patterns matches. It is carried
-- whole only for a small page served with a 200 that one of the sparse-page
-- patterns matches, where the page's visible length decides. A pattern added
-- there is added to the two lists below. `exportedAt` is the newest scan's
-- time, so the document is the same in every chunk's call.
--
-- A Measured's value that is a list stays a list when it is empty: `jsonb_agg`
-- over no rows is null, which `jsonb_strip_nulls` would drop (issue 1431), so
-- each is coalesced to `[]`; one the report never stored stays absent.
--
-- `:WHERE` narrows the scans (`true` for all of them, `s.domain in (…)` for
-- a few). The document is `doc.j`; `scripts/pass/assemble.mjs` says how it is
-- fetched in checked chunks, and is given `--out <file>`.
with picked as (
  select s.* from scans s where s.report is not null and (:WHERE)
),
light as (
  select f.id, f.source, f.cache_key, f.created_at, f.payload,
         (f.payload->>'status')::int as status
  from fetches f
  where f.source in ('egress.safeFetch', 'on_page/instant_pages')
    and f.cache_key in (select 'https://' || domain || '/' from picked)
),
docs as (
  -- One stored document, and whether `couldBeChallenge` would read it: a
  -- refusing status, a header stating a mitigation, or a small page. Only
  -- those keep any of their HTML below.
  select x.*, case when x.candidate then x.doc->>'html' end as html
  from (
    select y.*, coalesce(y.status = 202 or y.status >= 400 or (y.doc->>'bytes')::int <= 100000
                 or y.doc->'headers' ?| array['cf-mitigated', 'x-vercel-mitigated', 'x-amzn-waf-action', 'x-sucuri-block'], false) as candidate
    from (
      select l.id, l.source, l.cache_key, l.created_at,
             case when l.source = 'egress.safeFetch' then l.payload else l.payload->0 end as doc,
             case when l.source = 'egress.safeFetch' then l.status else (l.payload->0->>'status')::int end as status
      from light l
    ) y
  ) x
),
slim as (
  -- The title is cut out by position, as `challengeOf`'s
  -- `<title[^>]*>([\s\S]*?)</title>` reads it.
  select d.id, d.source, d.cache_key, d.created_at, d.doc->>'readAt' as read_at,
    case when d.doc is null or jsonb_typeof(d.doc) <> 'object' then d.doc
    else (d.doc - 'html') || jsonb_build_object('html',
      case
        when not d.candidate then to_jsonb(''::text)
        when not (d.status = 202 or d.status >= 400) and d.html ~* '(incapsula incident id|captcha-delivery\.com|px-captcha|the requested url was rejected\. please consult with your administrator)'
          then to_jsonb(d.html)
        else to_jsonb(
          (select '<title>' || case when z.open = 0 or z.close = 0 then '' else substr(z.after, 1, z.close - 1) end || '</title>'
           from (select y.open, y.after, strpos(lower(y.after), '</title>') as close
                 from (select o.open, substr(d.html, o.open + strpos(substr(d.html, o.open), '>')) as after
                       from (select strpos(lower(d.html), '<title') as open) o) y) z)
          || case when d.status = 202 or d.status >= 400
               then coalesce(' ' || (regexp_match(d.html, '(captcha-delivery\.com|datadome|px-captcha|_pxappid|captcha\.px-cdn\.net|perimeterx|_incapsula_resource|incapsula incident id|sucuri website firewall|cloudproxy@sucuri|errors\.edgesuite\.net|awswaf|the requested url was rejected\. please consult with your administrator|/cdn-cgi/challenge-platform/|cf-error-details|cf_chl_opt|cf-browser-verification|checking your browser before accessing)', 'i'))[1], '')
               else '' end)
      end)
    end as doc
  from docs d
),
scan_rows as (
  select s.id, s.created_at,
    jsonb_build_object(
      'id', s.id,
      'createdAt', s.created_at,
      'status', s.status,
      'score', s.score,
      'drivers', s.drivers,
      'md5', md5(s.report::text),
      'rescoredAt', s.report->'rescoredAt',
      'report', jsonb_build_object(
        'version', s.report->'version',
        'domain', s.report->'domain',
        'tier', s.report->'tier',
        'complete', s.report->'complete',
        'stoppedReason', s.report->'stoppedReason',
        'verdict', s.report->'verdict',
        'blockedAgents', s.report->'blockedAgents',
        'onPage', s.report->'onPage',
        -- What Foundations, the verdict and the checks read of the rules: who
        -- is disallowed. The rule lists and sitemaps are most of a report.
        'robots', jsonb_set(s.report->'robots' #- '{value,rules}' #- '{value,crawlDelaySeconds}', '{value,sitemaps}', '[]'::jsonb, false),
        'ownRanked', s.report->'ownRanked',
        'ownRankedRows', (select coalesce(jsonb_agg(jsonb_build_object('position', r->'position')), '[]'::jsonb)
                          from jsonb_array_elements(coalesce(s.report->'ownRankedRows', '[]'::jsonb)) r),
        'sources', s.report->'sources',
        'rivals', s.report->'rivals',
        'presence', s.report->'presence',
        'coherence', s.report->'coherence',
        'siteIssues', case when jsonb_typeof(s.report->'siteIssues') = 'object' then '{}'::jsonb else 'null'::jsonb end,
        'measuredCategory', s.report->'measuredCategory',
        'marketPrompts', (select jsonb_agg(jsonb_build_object('prompt', p->'prompt', 'citedDomains', p->'citedDomains', 'namesSite', p->'namesSite', 'excerpt', p->'excerpt'))
                          from jsonb_array_elements(case when s.site_id is not null and s.is_current then coalesce(s.report->'marketPrompts', '[]'::jsonb) else '[]'::jsonb end) p),
        'market', jsonb_strip_nulls(jsonb_build_object('kind', s.report->'market'->'kind', 'reason', s.report->'market'->'reason', 'at', s.report->'market'->'at',
                    'value', case when s.report->'market'->'value' is null then null
                             else jsonb_build_object('profile', jsonb_build_object('category', s.report->'market'->'value'->'profile'->'category')) end)),
        'questions', jsonb_strip_nulls(jsonb_build_object('kind', s.report->'questions'->'kind', 'reason', s.report->'questions'->'reason', 'at', s.report->'questions'->'at',
                    'value', case when jsonb_typeof(s.report->'questions'->'value') = 'array' then
                              (select coalesce(jsonb_agg(jsonb_build_object('id', q->'id', 'text', '', 'phrasing', q->'phrasing',
                                'search', jsonb_build_object('keyword', q->'search'->'keyword', 'volume', q->'search'->'volume')) order by i), '[]'::jsonb)
                               from jsonb_array_elements(s.report->'questions'->'value') with ordinality x(q, i)) end)),
        'serps', (select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                    'kind', e->'kind', 'reason', e->'reason', 'because', e->'because', 'at', e->'at',
                    'value', case when e->'value' is null then null else jsonb_build_object(
                      'organic', (select coalesce(jsonb_agg(jsonb_build_object('position', o->'position', 'domain', o->'domain') order by j), '[]'::jsonb)
                                  from jsonb_array_elements(e->'value'->'organic') with ordinality y(o, j)),
                      'localPack', (select jsonb_agg(jsonb_build_object('domain', lp->'domain', 'title', lp->'title'))
                                    from jsonb_array_elements(coalesce(e->'value'->'localPack', '[]'::jsonb)) lp),
                      'reusedFrom', e->'value'->'reusedFrom',
                      'aiOverview', jsonb_strip_nulls(jsonb_build_object(
                        'present', e->'value'->'aiOverview'->'present',
                        'unread', e->'value'->'aiOverview'->'unread',
                        'referenceDomains', e->'value'->'aiOverview'->'referenceDomains',
                        'referenceUrls', e->'value'->'aiOverview'->'referenceUrls'))) end)) order by i), '[]'::jsonb)
                  from jsonb_array_elements(coalesce(s.report->'serps', '[]'::jsonb)) with ordinality x(e, i)),
        'rivalSizes', jsonb_strip_nulls(jsonb_build_object('kind', s.report->'rivalSizes'->'kind', 'reason', s.report->'rivalSizes'->'reason', 'at', s.report->'rivalSizes'->'at',
                    'value', case when jsonb_typeof(s.report->'rivalSizes'->'value') = 'array' then
                              (select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('domain', z->'domain', 'state', z->'state', 'band', z->'band'))), '[]'::jsonb)
                               from jsonb_array_elements(s.report->'rivalSizes'->'value') z) end)),
        'aiAnswers', case when jsonb_typeof(s.report->'aiAnswers') <> 'object' then 'null'::jsonb else jsonb_build_object(
          'measuredSearches', s.report->'aiAnswers'->'measuredSearches',
          'answeredSearches', s.report->'aiAnswers'->'answeredSearches',
          'customerCitations', s.report->'aiAnswers'->'customerCitations',
          'reusedFrom', s.report->'aiAnswers'->'reusedFrom',
          'coverage', s.report->'aiAnswers'->'coverage',
          'rivals', s.report->'aiAnswers'->'rivals',
          'rows', (select coalesce(jsonb_agg(jsonb_build_object('question', jsonb_build_object('search', w->'question'->'search'), 'cell', w->'cell',
                     -- The battery's two engines are bought answers the re-score keeps;
                     -- only a site's current scan carries them, as its rivals' evidence.
                     'engines', case when s.site_id is not null and s.is_current then w->'engines'
                                else (select coalesce(jsonb_agg(g order by k), '[]'::jsonb) from jsonb_array_elements(w->'engines') with ordinality v(g, k) where g->>'engine' = 'ai_overview') end) order by i), '[]'::jsonb)
                   from jsonb_array_elements(s.report->'aiAnswers'->'rows') with ordinality x(w, i))) end
      ),
      'home', (select jsonb_build_object('created_at', h.created_at, 'payload', h.doc)
               from slim h
               where h.source = 'egress.safeFetch' and h.cache_key = 'https://' || s.domain || '/'
                 and s.report->'onPage'->>'kind' <> 'unmeasured'
                 and h.read_at::timestamptz <= (s.report->'onPage'->>'at')::timestamptz
               order by h.read_at::timestamptz desc limit 1),
      'rendered', (select coalesce(jsonb_agg(jsonb_build_object('created_at', g.created_at, 'payload', jsonb_build_array(g.doc))), '[]'::jsonb)
                   from slim g where g.source = 'on_page/instant_pages' and g.cache_key = 'https://' || s.domain || '/')
    ) as j
  from picked s
),
doc as (
  select jsonb_build_object(
    'exportedAt', (select max(created_at) from picked),
    'scans', (select coalesce(jsonb_agg(j order by created_at, id), '[]'::jsonb) from scan_rows),
    'sites', (select coalesce(jsonb_agg(jsonb_build_object(
                'id', t.id, 'domain', t.domain, 'competitors', t.competitors,
                'rivals', t.market->'current'->'rivals', 'overridden', coalesce(t.market->'rivalsOverridden', 'false'::jsonb),
                'scanId', (select c.id from scans c where c.site_id = t.id and c.is_current and c.report is not null limit 1)) order by t.domain), '[]'::jsonb)
              from sites t),
    'profiles', (select coalesce(jsonb_agg(jsonb_build_object('domain', p.domain, 'siteName', p.site_name) order by p.domain), '[]'::jsonb)
                 from site_profiles p)
  ) j
)
select j from doc;
-- The document's size and checksum, and proof that the two stand-in
-- characters the chunks use are not in it:
--   , t as (select j::text raw from doc)
--   select length(raw) len, md5(raw) md5, position('¤' in raw) p1, position('¬' in raw) p2 from t;
-- Chunk :I of 10,000 characters, with `"` and `\` stood in for:
--   , t as (select j::text raw from doc)
--   select i, md5(substr(raw, i * 10000 + 1, 10000)) md5, translate(substr(raw, i * 10000 + 1, 10000), '"\', '¤¬') c
--   from t, generate_series(:I, :I) i;
