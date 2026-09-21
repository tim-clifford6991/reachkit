-- known_content — every page the site already has, whoever wrote it.
--
-- Issue #928 · SPEC §7 (2026-09-20): "**Known content.** Before a page is
-- planned or written ReachKit knows every page it wrote for the site, every
-- post on a connected WordPress (read through the connection when it is made
-- and every Monday — all posts, not only ours), and the main site's crawled
-- pages. A planned page that overlaps one of them becomes an **update** of
-- that page where the destination can publish to it; otherwise the topic is
-- skipped and the existing page is linked from related pages."
--
-- **Why a table and not three reads.** The three sources already exist —
-- `publications` and `drafts` are ours, `site_profiles.inventory` is the
-- crawl's, and a connected WordPress is a REST endpoint on somebody else's
-- host. The first two are readable at any time; the third is not. A network
-- read of a customer's site cannot stand inside the derivation that decides
-- whether tomorrow's page is a repeat: it would make that decision depend on
-- whether their host answered in the next two seconds, and the honest answer
-- to "is this a repeat" is never "we could not reach them, so no". So the
-- WordPress read happens when the connection is made and every Monday, is
-- written here, and every later reader reads one table.
--
-- The other two sources are written here too, in the same refresh, for one
-- reason: a rule that reads one index cannot be told a source is missing
-- because a caller forgot to join it.
--
-- **No body text.** A title, the page's own headings, an excerpt and an
-- address. That is what answers "is this topic already covered" and "what may
-- this page link to"; storing the body of every post on a customer's blog
-- would be a copy of their site held for questions nobody asks of it.
--
-- **Identity is the source's own.** `(site_id, source, ref)` is the key:
-- a publication or draft id for ours, the WordPress post id for theirs, the
-- URL for a crawled page. Nothing here invents an id, so a refresh that
-- re-reads the same post updates one row rather than adding a second.
--
-- **Two indexes, two jobs** (#928: "Similarity in Postgres with `pg_trgm`
-- and full-text search over title, headings and target search"). The
-- full-text index finds the rows that share a word with a planned page's
-- topic; the trigram index finds the rows whose title is spelled almost the
-- same, which is what catches a plural, a reordering and a reworded title
-- that shares no whole word with the search. A row either index offers is
-- then scored by `src/lib/known-content/similarity.ts` — the same trigram
-- set the `gin_trgm_ops` index is built on — and the threshold that decides
-- a repeat is one number, in `KNOWN_CONTENT.COVERED_MIN`, so the narrowing
-- and the decision can never be two policies.
--
-- Rule 3a: the `sites_content` sub-token (`src/lib/db/topics.ts`) — a fact
-- about what one site already holds, narrowing the `sites` topic. The
-- timestamp sorts after every migration on disk at implementation time; it
-- depends on `00000000000001_baseline.sql` for `sites` and on nothing else.

create extension if not exists pg_trgm;

create table known_content (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites (id),
  -- Where the page came from. `reachkit` is a page of ours (published or
  -- waiting), `wordpress` a post on a connected WordPress, `site` a page the
  -- crawl read off the main site.
  source text not null,
  ref text not null,
  -- Where a reader finds it. Null for a page of ours that is not live yet: a
  -- topic the site is about to cover is known content and is not a link
  -- target, and the difference is this column rather than a convention.
  url text,
  title text not null,
  -- The page's own headings, one per line. **Text and not `text[]`**: the
  -- full-text column below is generated, a generated expression must be
  -- immutable, and `array_to_string` is only stable — so an array here would
  -- have to be flattened by a trigger, which is a second writer that can
  -- disagree with the column it maintains. One line per heading is the same
  -- fact in a shape the database can index by itself.
  headings text not null default '',
  excerpt text,
  live boolean not null default true,
  published_at timestamptz,
  -- When the refresh last saw it. A source's rows are replaced whole on each
  -- refresh, so this is also how old the reading is.
  seen_at timestamptz not null default now(),
  constraint known_content_source check (source in ('reachkit', 'wordpress', 'site')),
  constraint known_content_identity unique (site_id, source, ref),
  -- Generous ceilings on text a customer's own site supplies: a title is a
  -- line, an excerpt is a paragraph. A page whose source hands back a
  -- document in place of a title is a source we misread, not a row to keep.
  constraint known_content_title_length check (char_length(title) <= 500),
  constraint known_content_excerpt_length check (excerpt is null or char_length(excerpt) <= 2000),
  constraint known_content_headings_length check (char_length(headings) <= 20000)
);
alter table known_content enable row level security;

-- The text the topic search reads: the title and the page's own headings.
-- `simple`, not `english`: the index is compared against a target search in
-- whatever language the site is written in, and stemming one side with an
-- English dictionary would make a Portuguese blog invisible to it.
alter table known_content
  add column search tsvector generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(headings, ''))
  ) stored;

create index known_content_site on known_content (site_id);
create index known_content_search on known_content using gin (search);
create index known_content_title_trgm on known_content using gin (title gin_trgm_ops);

comment on table known_content is
  'One row per page the site already has, from all three sources: pages ReachKit published or has '
  'waiting, posts on a connected WordPress, and the main site''s crawled pages. Read before a page '
  'is planned (is this topic already covered?) and before one is written (what may it link to?). '
  'Issue #928, SPEC.md §7 2026-09-20.';

comment on column known_content.ref is
  'The page''s identity within its own source — publication or draft id, WordPress post id, or URL '
  'for a crawled page. Never an identity of our own, so a refresh updates rather than duplicates.';

comment on column known_content.live is
  'Whether a reader can open it now. A queued draft of ours and a WordPress post still in draft are '
  'known content and are not link targets.';

comment on column known_content.headings is
  'The page''s own headings, one per line. Text rather than an array so the generated full-text '
  'column can be immutable and no trigger is needed to maintain it.';

comment on column known_content.search is
  'Title and headings, for the full-text half of the topic search. Generated, so no writer can '
  'forget it and it cannot disagree with the columns it is made of.';

-- The narrowing read (#928). It returns the rows worth scoring for one
-- planned topic and scores nothing itself: the score and the threshold are
-- `src/lib/known-content/`'s, in one place, and a function that returned its
-- own verdict would be a second policy living in the database.
--
-- Two ways in, either of which qualifies a row: the full-text index, for a
-- topic that shares a word with the page; and the trigram index, for a title
-- spelled almost the same. `websearch_to_tsquery` because the input is a
-- search phrase a person could have typed, and it never raises on
-- punctuation the way `to_tsquery` does.
--
-- `security definer` is deliberate and is the same shape the other read
-- functions in this schema use: the caller is the service client, the site is
-- named by the caller, and the function reads one site's own rows.
create or replace function known_content_near(
  p_site_id uuid,
  p_query text,
  p_limit int default 25
)
returns setof known_content
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select k.*
    from known_content k
   where k.site_id = p_site_id
     and (
       k.search @@ websearch_to_tsquery('simple', p_query)
       or k.title % p_query
     )
   order by similarity(k.title, p_query) desc, k.published_at desc nulls last
   limit greatest(p_limit, 0);
$$;

comment on function known_content_near(uuid, text, int) is
  'The rows of one site''s known content worth scoring against a planned topic: those sharing a '
  'word with it (full-text) or spelled almost like it (trigram). Scoring and the repeat threshold '
  'are the application''s (src/lib/known-content), so the database holds no second policy.';

-- Derived, and written only by the pipeline through the service client — the
-- same footing as `site_profiles`, which carries no insert or update policy
-- for the same reason. The customer may read what we know about their own
-- site (Settings states how many pages it holds); nobody may write it from a
-- session, and no `anon` policy exists because a free scan's visitor owns no
-- site.
create policy known_content_select_own on known_content for select to authenticated
  using (
    exists (
      select 1
        from sites s
        join users u on u.id = s.user_id
       where s.id = known_content.site_id
         and s.user_id = auth.uid()
         and u.deleted_at is null
    )
  );

grant select, insert, update, delete on known_content to anon, authenticated, service_role;
grant execute on function known_content_near(uuid, text, int) to service_role;
