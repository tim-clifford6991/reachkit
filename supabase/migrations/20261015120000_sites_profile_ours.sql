-- supabase/migrations/20261015120000_sites_profile_ours.sql
--
-- Issue 1456 — a fact is never read off a page ReachKit wrote (SPEC §5,
-- 2026-10-15). The code now leaves those pages out of every reader of
-- facts (`src/lib/known-content/ours.ts`); this takes them out of what was
-- stored before it did, at 0¢ and from the rows themselves.
--
-- A page is ours where a publication of a site of that domain was delivered
-- at its address, or where it is on the host a live hosted destination
-- serves (`<label>.<domain>`; `content` where no label was stored). Two
-- spellings of one address share a key: no scheme, no `www.`, no query or
-- fragment, no trailing slash, no case — `addressKey` in that file.
--
-- 1. `site_profiles.knowledge.pages`: each page's reading goes with it, and
--    the base is merged from the pages that are left at read time.
-- 2. `known_content`: a page of ours is a `reachkit` row, never a `site` or
--    `wordpress` one.
--
-- `site_profiles.claims` and `.products` are one model reading of the whole
-- crawl, with no page beside each item, so which of them came off a page of
-- ours cannot be told from the row. They are read again, off the customer's
-- pages only, on the site's next paid pass.
--
-- Data only; no schema changes. Applied after merge through the Supabase
-- connector (docs/PROCESS.md step 4). Running it twice changes nothing.

with keyed as (
  select
    s.id as site_id,
    s.domain,
    lower(regexp_replace(regexp_replace(regexp_replace(p.live_url, '[?#].*$', ''), '^[a-z]+://(www\.)?', '', 'i'), '/+$', '')) as address,
    null::text as host
  from publications p
  join sites s on s.id = p.site_id
  where p.live_url is not null
  union all
  select
    s.id,
    s.domain,
    null,
    lower(regexp_replace(coalesce(nullif(trim(d.hostname), ''), 'content.' || s.domain), '^www\.', ''))
  from destinations d
  join sites s on s.id = d.site_id
  where d.kind = 'hosted' and d.deleted_at is null and s.domain is not null
),
ours as (
  -- A `www` label is the customer's own site once `www.` is dropped.
  select * from keyed where host is null or host <> lower(regexp_replace(domain, '^www\.', ''))
),
pages as (
  select
    sp.domain,
    e.page,
    e.ord,
    lower(regexp_replace(regexp_replace(regexp_replace(e.page ->> 'url', '[?#].*$', ''), '^[a-z]+://(www\.)?', '', 'i'), '/+$', '')) as address
  from site_profiles sp
  cross join lateral jsonb_array_elements(sp.knowledge -> 'pages') with ordinality as e(page, ord)
  where jsonb_typeof(sp.knowledge -> 'pages') = 'array'
),
marked as (
  select
    pages.*,
    exists (
      select 1 from ours o
      where o.domain = pages.domain
        and (o.address = pages.address or o.host = split_part(pages.address, '/', 1))
    ) as is_ours
  from pages
)
update site_profiles sp
set knowledge = jsonb_set(
  sp.knowledge,
  '{pages}',
  coalesce(
    (select jsonb_agg(m.page order by m.ord) from marked m where m.domain = sp.domain and not m.is_ours),
    '[]'::jsonb
  )
)
where exists (select 1 from marked m where m.domain = sp.domain and m.is_ours);

with keyed as (
  select
    s.id as site_id,
    s.domain,
    lower(regexp_replace(regexp_replace(regexp_replace(p.live_url, '[?#].*$', ''), '^[a-z]+://(www\.)?', '', 'i'), '/+$', '')) as address,
    null::text as host
  from publications p
  join sites s on s.id = p.site_id
  where p.live_url is not null
  union all
  select
    s.id,
    s.domain,
    null,
    lower(regexp_replace(coalesce(nullif(trim(d.hostname), ''), 'content.' || s.domain), '^www\.', ''))
  from destinations d
  join sites s on s.id = d.site_id
  where d.kind = 'hosted' and d.deleted_at is null and s.domain is not null
),
ours as (
  select * from keyed where host is null or host <> lower(regexp_replace(domain, '^www\.', ''))
)
delete from known_content k
where k.source in ('site', 'wordpress')
  and k.url is not null
  and exists (
    select 1 from ours o
    where o.site_id = k.site_id
      and (
        o.address = lower(regexp_replace(regexp_replace(regexp_replace(k.url, '[?#].*$', ''), '^[a-z]+://(www\.)?', '', 'i'), '/+$', ''))
        or o.host = split_part(lower(regexp_replace(regexp_replace(k.url, '[?#].*$', ''), '^[a-z]+://(www\.)?', '', 'i')), '/', 1)
      )
  );
