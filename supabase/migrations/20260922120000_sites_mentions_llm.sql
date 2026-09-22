-- llm_mention_reads · llm_mentions — what the answer engines already answer
-- with this site, bought once a week.
--
-- Issue #1004 · SPEC §6 (2026-09-22): "buy DataForSEO LLM Mentions
-- **weekly**, per site, as part of the Monday pass … one request per site,
-- 100-row cap, stored whole (raw JSON + a normalised `llm_mentions` table:
-- site, week, question, engine, cited url, ai_search_volume, first/last
-- seen). Cost recorded against the weekly cap (`CAPS`); the pass skips the
-- call if the cap would be exceeded and says so."
--
-- **Two tables, because a week has two facts in it.** The read is what
-- happened on one Monday — it was bought, or it was skipped, or it failed,
-- and it cost this much and the vendor holds this many rows in all. The
-- mentions are what came back. Collapsing them would lose the distinction
-- SPEC §6 of this date turns into two different screens: "a week with no
-- rows is a measured zero (a written line), not a blank card; a site never
-- queried draws no card." A measured zero is a `llm_mention_reads` row with
-- `status = 'zero'` and no `llm_mentions` rows; a site never queried has no
-- read row at all. With one table those two are the same empty query.
--
-- **The raw response is not copied here.** `fetches` is already "the
-- ledger-cache-raw-store in one" (`src/lib/costs/ledger.ts`): every LLM
-- Mentions call goes through `CostContext.recordFetch`, which stores the
-- parsed rows whole in `fetches.payload` under the call's own cache key,
-- and the parser drops nothing the vendor sends that the product may show.
-- A third copy of the same bytes on this row would be a second home for one
-- fact, and it would outlive the ledger row the purge removes it with.
-- `total_count` is the one thing the rows themselves cannot carry — the
-- vendor's count of every mention it holds, which the 100-row cap
-- deliberately does not buy — so it is a column.
--
-- **One row per (site, week).** The pass is claimed once per site-local
-- week (`scans`' partial unique index on `(site_id, week_start)`), so the
-- primary key here says the same thing: a Monday re-run upserts the read
-- and replaces that week's mentions, and no week is ever counted twice in
-- the rolling four-week window.
--
-- **`week_start` is a `date`, not a timestamp**, and it is the site's own
-- local Monday — the same string `scans.week_start` carries, written by
-- `weekStartFor()` in the site's zone. A customer who moves zone moves no
-- already-measured week.
--
-- **No cascade on either foreign key** (ADR-051 point 7, swept by
-- `tests/account/lifecycle/schema.test.ts` over every migration in this
-- repository): "the purge is the only deleter, and a cascade is a delete
-- nobody asked for". Both tables are named in `PURGE_ORDER`
-- (`src/lib/account/lifecycle/purge.ts`) before `sites`, mentions first, so
-- a site with mentions cannot be deleted around them.
--
-- **RLS: enabled, no policy** — the `fetches` and `job_runs` convention.
-- Nothing a customer holds reads this directly: the AI answers tab reads it
-- server-side through `dbAdmin()` (`service_role`, which bypasses RLS), the
-- same way it already reads the stored weekly reports. A table with RLS on
-- and no policy is default-deny for `anon` and `authenticated` (BUILD §10),
-- which is what a row that has not been through the product's own
-- right-sizing and copy rules should be.
--
-- Rule 3a: the `sites_mentions` sub-token (`src/lib/db/topics.ts`) — a fact
-- about one site's week, narrowing the `sites` topic. The timestamp sorts
-- after every migration on disk at implementation time; it depends on
-- `00000000000001_baseline.sql` for `sites` and `scans`, and on nothing
-- else.
--
-- Not applied by the PR that adds it; applied after merge through the
-- Supabase connector (docs/PROCESS.md step 4).

create table llm_mention_reads (
  site_id uuid not null references sites (id),
  week_start date not null,
  -- The pass this was bought inside, so the spend can be read back against
  -- the row it was ledgered on. Nullable: a read the cap skipped still
  -- happened inside a pass, but a pass whose row has been purged leaves a
  -- read nobody can attribute, and losing the week would be worse.
  scan_id uuid references scans (id),
  -- Closed, and each one is a different sentence on the card.
  --   measured    — the vendor answered with rows.
  --   zero        — the vendor answered with none. A measurement, not an
  --                 absence: §6.6's cold-start law, and SPEC §6's "a week
  --                 with no rows is a measured zero (a written line)".
  --   skipped_cap — the weekly cap had no room for the reservation. The
  --                 call was never made and nothing was spent.
  --   failed      — the vendor was reached and could not be read.
  status text not null,
  constraint llm_mention_reads_status_known check (
    status in ('measured', 'zero', 'skipped_cap', 'failed')
  ),
  -- How many normalised rows this read stored. Redundant with a count over
  -- `llm_mentions`, and deliberately so: it is what makes `status = 'zero'`
  -- checkable against the rows, and a read whose rows failed to write is
  -- then visible rather than silently indistinguishable from a real zero.
  rows_stored integer not null default 0,
  constraint llm_mention_reads_rows_not_negative check (rows_stored >= 0),
  -- The vendor's own `total_count`: every mention it holds for this domain,
  -- not the 100 this read bought. Null where it reported none — never 0,
  -- which is a reading, and never the row count under another name.
  total_count integer,
  constraint llm_mention_reads_total_not_negative check (total_count is null or total_count >= 0),
  -- What it cost, in cents to four decimal places — the same unit `CAPS`,
  -- the price book and `fetches.cost_cents` are written in, so this figure
  -- and the ledger's agree without rounding. 0 for a read the cap skipped.
  cost_cents numeric(12, 4) not null default 0,
  constraint llm_mention_reads_cost_not_negative check (cost_cents >= 0),
  read_at timestamptz not null default now(),
  primary key (site_id, week_start)
);

alter table llm_mention_reads enable row level security;

comment on table llm_mention_reads is
  'One row per site per local Monday: whether that week''s DataForSEO LLM Mentions request was '
  'bought, skipped for the weekly cap or failed, what it cost, and how many mentions the vendor '
  'holds in all. A week with no rows and a week never queried are two different facts, and this '
  'table is what tells them apart (issue #1004, SPEC.md §6 2026-09-22). dbAdmin()-only; BUILD §10 '
  'default-deny; no anon/authenticated policy by design.';

comment on column llm_mention_reads.status is
  'measured | zero | skipped_cap | failed. `zero` is a measurement — the engines answered nobody '
  'with this site that week — and the card states it in a written line rather than drawing blank.';

comment on column llm_mention_reads.total_count is
  'The vendor''s own count of every mention it holds for this domain, independent of the 100-row '
  'cap this read bought. Null where it reported none.';

comment on column llm_mention_reads.cost_cents is
  'Cents to four decimal places, the unit CAPS and fetches.cost_cents use: the flat request charge '
  'plus a tenth of a cent a row, settled from what came back. 0 for a read the weekly cap skipped.';

create table llm_mentions (
  id bigint generated always as identity primary key,
  site_id uuid not null references sites (id),
  week_start date not null,
  -- The buyer's question, as the engine was asked it. The row's subject:
  -- everything else here may be null and the row still says something.
  question text not null,
  -- The answer engine, the vendor's `platform` — and the model behind it
  -- where it named one. Null where it named neither, which is a mention we
  -- still know the question of.
  engine text,
  model text,
  -- One of the site's own pages this answer cites. Null where the mention
  -- could not be attributed to a URL on this domain — the question is still
  -- carried, because *Also appearing for* is a list of questions and losing
  -- one to an unparseable source would be losing the measurement.
  --
  -- A mention citing two of the site's pages is two rows: that is what
  -- makes "how many questions cite this page" one group-by rather than a
  -- scan through an array.
  cited_url text,
  -- The vendor's own demand figures. Null where it gave none — never 0,
  -- which would sort a question it could not measure to the bottom of a
  -- list ordered by it.
  ai_search_volume integer,
  monthly_searches integer,
  constraint llm_mentions_volume_not_negative check (
    (ai_search_volume is null or ai_search_volume >= 0)
    and (monthly_searches is null or monthly_searches >= 0)
  ),
  -- `first_response_at` / `last_response_at`: when the vendor first and last
  -- saw this question answered this way. The first is what the card shows
  -- as the week a question was first seen.
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  -- The read that wrote it, so a week's rows are removed with its read.
  constraint llm_mentions_read_fk foreign key (site_id, week_start)
    references llm_mention_reads (site_id, week_start)
);

-- The rolling four-week window is the only way this table is ever read: one
-- site, the last four Mondays. One index, in that order.
create index llm_mentions_site_week_idx on llm_mentions (site_id, week_start);

alter table llm_mentions enable row level security;

comment on table llm_mentions is
  'One row per (question, engine, cited page) that DataForSEO''s LLM Mentions database holds for a '
  'site in one week. Read over a rolling four-week window by the AI answers tab''s two cards — '
  '*Also appearing for* (the questions, by ai_search_volume) and *Cited pages* (the site''s own '
  'pages, by how many questions cite each). Never a rank position and never sentiment: there is no '
  'column for either (issue #1004, SPEC.md §4 and §6 2026-09-22). dbAdmin()-only; BUILD §10 '
  'default-deny; no anon/authenticated policy by design.';

comment on column llm_mentions.cited_url is
  'One of the site''s own pages the answer cites. Null where the mention could not be attributed '
  'to a URL on this domain; the question is carried either way.';

comment on column llm_mentions.ai_search_volume is
  'How often the question is asked of an answer engine, the vendor''s figure. Null where it gave '
  'none — never 0, so a question it could not size is not sorted as the least asked.';

-- `service_role` bypasses RLS but still needs the object privilege
-- (`BYPASSRLS` skips row policies, not table grants). No `anon` or
-- `authenticated` grant: neither role reaches these tables at all.
grant select, insert, update, delete on llm_mention_reads to service_role;
grant select, insert, update, delete on llm_mentions to service_role;
grant usage, select on sequence llm_mentions_id_seq to service_role;
