-- supabase/migrations/20260922120000_publications_reads.sql
--
-- SPEC §6 (2026-09-20, #908) measure (d) · SPEC §7 (2026-09-20) — issue
-- #921. "On hosted blogs only: pages fetched by an answer engine for a
-- user's question, and visitors arriving from one, counted by day, page and
-- engine, shown as 'at least'. Training crawlers are not progress and are
-- not shown." §7 of the same date: "Hosted pages count answer-engine
-- fetches and answer-engine referrals — server-side, no cookie, no visitor
-- identity, no client script. Nothing else about a visit is kept."
--
-- **This table is the whole record of a visit, and it holds counts.** There
-- is no address column, no agent column, no IP column, no session column
-- and no timestamp finer than a day. A row says: on this day, this page of
-- this site was read this many times, by this engine, for this reason.
-- Nothing in it distinguishes one reader from another, because nothing in
-- it is about a reader — which is what makes "no visitor identity" a
-- property of the schema rather than a promise about the code above it.
--
-- **The roll-up is the table** (issue #921: "counts only … a daily
-- roll-up"). There is no per-hit row that a nightly job later folds up: the
-- writer increments the day's cell, so the roll-up cannot fall behind the
-- log and there is no second copy of the same fact to keep in step. One
-- customer's whole record is at most `pages × 5 engines × 3 kinds × the
-- retention window` rows, which is why no partitioning and no archive is
-- owed here.
--
-- **Retention is enforced by the writer, in the same statement.** A
-- separate sweep would be a thirteenth clock obligation for a table whose
-- rows carry nothing about a person; instead `record_publication_read`
-- deletes this site's rows older than the window it is handed, so a site
-- that is being read is a site whose record is being trimmed. The window
-- itself is one pin (`BLOG_READS_RETENTION_W`, `src/lib/config/
-- constants.ts`) and is passed in rather than typed here, so the product
-- has one number and not two. A site that stops being read keeps at most
-- one window of frozen counts; the account purge is what removes them
-- (`src/lib/account/lifecycle/purge.ts`).
--
-- **`engine` and `kind` are checked, not free text.** Both are closed sets
-- in `src/lib/publish/reads/classify.ts`, and a writer that invented a
-- sixth engine would otherwise draw a column nobody named on the card. The
-- check is the same closed set, spelled here so the database refuses it.
--
-- **The pair must agree.** The insert reads `publications` for the page and
-- requires it to belong to the site handed in, so a caller that paired one
-- customer's site with another's page writes nothing at all rather than
-- filing a read under the wrong blog. That is why this is a function and
-- not a PostgREST upsert.
--
-- **RLS: the owner reads, and nobody writes.** A customer may read their
-- own site's counts; no `authenticated` policy grants insert, update or
-- delete, because every row here is written by the server on a request the
-- customer never made. `service_role` keeps the full set.
--
-- `structure.md` rule 3: the `publications` topic (`src/lib/db/topics.ts`,
-- owner BP-045); `reads` narrows it and is not a second topic.

create table publication_reads (
  site_id uuid not null references sites (id),
  publication_id uuid not null references publications (id),
  day date not null,
  engine text not null,
  kind text not null,
  hits integer not null default 1,
  primary key (publication_id, day, engine, kind),
  -- The five AI apps the product can tell apart (`AI_BLOG_ENGINES`).
  constraint publication_reads_engine_known check (
    engine in ('chatgpt', 'perplexity', 'claude', 'gemini', 'copilot')
  ),
  -- Why the page was read (`BLOG_READ_KINDS`). A fetch is never added to a
  -- visitor, so the reason is part of the key rather than a flag beside it.
  constraint publication_reads_kind_known check (
    kind in ('answer_fetch', 'index_fetch', 'referral')
  ),
  -- A row exists because something was counted. Zero is not a reading, it
  -- is the absence of one, and a zero row would draw a bar for a day
  -- nothing happened.
  constraint publication_reads_hits_positive check (hits > 0)
);

alter table publication_reads enable row level security;

comment on table publication_reads is
  'One row per site, page, day, engine and reason: how many times an answer engine fetched a '
  'hosted page for someone''s question, how many times a search indexer fetched it, and how many '
  'visitors arrived from an AI answer. Counts only — no address, no agent string, no IP, no '
  'cookie and no time finer than a day, so nothing here identifies a reader (SPEC §6 and §7, '
  '2026-09-20, issue #921). Written by record_publication_read from the hosted route; read by '
  'the AI answers tab''s "AI engines on your blog" card.';
comment on column publication_reads.day is
  'The UTC day the read happened. The card states the window it draws; a day boundary that '
  'followed each site''s own zone would need a second read of the site on a path that must not '
  'delay a page.';
comment on column publication_reads.engine is
  'Which AI app: chatgpt, perplexity, claude, gemini or copilot. Training crawlers (GPTBot, '
  'ClaudeBot) are never counted and have no value here — §6(d), "training crawlers are not '
  'progress and are not shown".';
comment on column publication_reads.kind is
  'Why: answer_fetch (an engine fetching the page for a person''s question), index_fetch (an '
  'engine building the index it answers from), or referral (a person arriving from an AI answer, '
  'by referrer host or utm_source — always "at least", because most AI apps send neither).';

-- The customer's own counts, and only their own.
create policy publication_reads_select_own on publication_reads for select to authenticated
  using (
    exists (
      select 1
        from sites s
        join users u on u.id = s.user_id
       where s.id = publication_reads.site_id
         and s.user_id = auth.uid()
         and u.deleted_at is null
    )
  );

-- Reading the card is a filter on one site and one window; the primary key
-- leads with `publication_id`, which that read does not have.
create index idx_publication_reads_site_day on publication_reads (site_id, day);

grant select on publication_reads to authenticated;
grant select, insert, update, delete on publication_reads to service_role;

-- **One statement per hit, and it is the whole of the write.** A
-- read-modify-write from the route would be two round trips on a path whose
-- whole point is that it does not delay the response, and it would race
-- another request for the same cell.
--
-- `p_keep_days` is the retention window, handed in from the one pin so this
-- file carries no second copy of it. The delete is narrowed to the site the
-- hit belongs to: a request for one customer's page never scans another's
-- rows.
create or replace function record_publication_read(
  p_site_id uuid,
  p_publication_id uuid,
  p_day date,
  p_engine text,
  p_kind text,
  p_keep_days integer
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.publication_reads (site_id, publication_id, day, engine, kind, hits)
  select p.site_id, p.id, p_day, p_engine, p_kind, 1
    from public.publications p
   where p.id = p_publication_id
     and p.site_id = p_site_id
  on conflict (publication_id, day, engine, kind)
  do update set hits = public.publication_reads.hits + 1;

  delete from public.publication_reads
   where site_id = p_site_id
     and day < p_day - p_keep_days;
end;
$$;

revoke all on function record_publication_read(uuid, uuid, date, text, text, integer) from public;
revoke all on function record_publication_read(uuid, uuid, date, text, text, integer) from anon;
revoke all on function record_publication_read(uuid, uuid, date, text, text, integer) from authenticated;
grant execute on function record_publication_read(uuid, uuid, date, text, text, integer) to service_role;
