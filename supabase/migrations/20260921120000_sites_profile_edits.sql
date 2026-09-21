-- site_profile_edits — the customer's corrections to what we read off their site.
--
-- Issue #926 · SPEC §7 (2026-09-20): "**What a page is written from.** The
-- confirmed business profile — what the business does, sells and promises,
-- who it serves, its vocabulary — joins the writer's inputs." #926's Build:
-- "Customer edits (remove, add, reword *what you do*) are stored per site
-- and **win over** the Monday refresh: a removed item stays removed, an
-- added one stays; the refresh may only add new findings as suggestions."
--
-- **Why a second table rather than columns on `site_profiles`.**
-- `site_profiles` is keyed by **domain**, is written by the free scan before
-- any account exists, and is *overwritten whole* by every weekly refresh —
-- its own header says so: "A refresh is the same fact re-measured, not a
-- second fact: the weekly pass upserts this row". A customer's decision
-- written into that row would be destroyed by the next Monday, which is the
-- one thing #926's done-when forbids. It is also shared with free scans of
-- the same domain, and one visitor's scan must never carry another account's
-- corrections.
--
-- So the derived reading and the customer's decisions are two facts in two
-- tables, and the second is keyed by **site** — the thing an account owns.
--
-- **This is why no pipeline changes.** The refresh keeps overwriting the
-- derived row exactly as it does today; the decisions are applied over it at
-- *read* time (`src/lib/site-profile/business/confirm.ts`). "An item removed
-- on Sunday is still gone after Monday's pass" is then true by construction
-- rather than by a code path remembering to check — there is no write the
-- refresh could make that would resurrect a removed item.
--
-- **Four columns, and each is one kind of decision.**
--
--   · `removed` — per field, the items the customer took out. Keyed by field
--     name so one column serves all six lists; an item is matched by its
--     exact stored text, because that text *is* its identity (the crawl
--     writes no id for a product or a claim, and inventing one here would
--     be a second identity to keep in step with a list that is overwritten
--     weekly).
--   · `added` — per field, the items the customer put in. These are theirs,
--     not the site's, and no refresh touches them.
--   · `job` — the one free-text field #926 names as rewordable ("reword
--     *what you do*"). A single value, so it is a column and not a row in
--     `removed`: replacing a sentence is not removing it.
--   · `seen` — per field, every derived item the customer has already been
--     shown. This is what makes "the refresh may only add new findings as
--     **suggestions**" true: an item the crawl found that is not in this
--     list has never been in front of the customer, so the screen marks it
--     as new rather than folding it silently into a curated list. Every
--     edit records the derived list as seen.
--
-- `facts_off` is the fifth decision and the only one that is not about the
-- profile: the grounding passages (`src/lib/generate/pipeline/grounding.ts`)
-- are read live from measured page text and are never stored, so what is
-- stored here is which of them the customer switched off, by passage text.
--
-- **No cascade on the key, and the purge is why** (ADR-051 point 7, swept by
-- `tests/account/lifecycle/schema.test.ts` over every migration in the
-- repository): "the purge is the only deleter, and a cascade is a delete
-- nobody asked for". So this row is removed by
-- `src/lib/account/lifecycle/purge.ts`, which names it in `PURGE_ORDER`
-- before `sites` — and a site that still has corrections cannot be deleted
-- around it, which is the guarantee the missing cascade buys.
--
-- Rule 3a: the `sites_profile` sub-token (`src/lib/db/topics.ts`) — a fact
-- about one site's profile, narrowing the `sites` topic. The timestamp sorts
-- after every migration on disk at implementation time; it depends on
-- `00000000000001_baseline.sql` for `sites` and on nothing else.

create table site_profile_edits (
  site_id uuid primary key references sites (id),
  removed jsonb not null default '{}'::jsonb,
  added jsonb not null default '{}'::jsonb,
  job text,
  seen jsonb not null default '{}'::jsonb,
  facts_off jsonb not null default '[]'::jsonb,
  edited_at timestamptz not null default now(),
  -- Objects, not arrays: every one is keyed by field name. A bug that wrote
  -- a bare array here would read back as "no decisions at all", which is the
  -- failure that looks like a working screen.
  constraint site_profile_edits_removed_is_object check (jsonb_typeof(removed) = 'object'),
  constraint site_profile_edits_added_is_object check (jsonb_typeof(added) = 'object'),
  constraint site_profile_edits_seen_is_object check (jsonb_typeof(seen) = 'object'),
  constraint site_profile_edits_facts_off_is_array check (jsonb_typeof(facts_off) = 'array'),
  -- A bound, because these are customer-supplied lists and nothing else
  -- bounds them. Generous: it is a ceiling that a real profile never nears,
  -- not a quota, and the screen's own controls add one item at a time.
  constraint site_profile_edits_facts_off_max_500 check (jsonb_array_length(facts_off) <= 500),
  -- The reworded sentence is one line, never a document.
  constraint site_profile_edits_job_length check (job is null or char_length(job) <= 2000)
);
alter table site_profile_edits enable row level security;

comment on table site_profile_edits is
  'One row per site: the customer''s corrections to the derived site profile — what they removed, '
  'what they added, their own wording of what the business does, which derived items they have '
  'already been shown, and which grounding passages they switched off. Applied over '
  'site_profiles at read time (src/lib/site-profile/business/confirm.ts), so a weekly refresh '
  'cannot undo a decision (issue #926, SPEC.md §7 2026-09-20).';

comment on column site_profile_edits.removed is
  'Field name -> array of the exact derived item texts the customer took out. Matched by text '
  'because the crawl writes no id per product or claim.';

comment on column site_profile_edits.added is
  'Field name -> array of items the customer put in. Theirs, never overwritten by a refresh.';

comment on column site_profile_edits.job is
  'The customer''s own wording of what the business does, replacing the derived one sentence. '
  'Null while they have not reworded it.';

comment on column site_profile_edits.seen is
  'Field name -> array of derived item texts the customer has already been shown. A derived item '
  'absent from it is a new finding and is marked as a suggestion rather than folded into the '
  'list, which is what "the refresh may only add new findings as suggestions" means.';

comment on column site_profile_edits.facts_off is
  'Grounding passages the customer switched off, by exact passage text. The passages themselves '
  'are read live from measured page text and are never stored.';

-- The owner of the site may read and write its own corrections, and nobody
-- else can touch them at all. Unlike `site_profiles` — which is derived, is
-- written only by the pipeline through `dbAdmin()` and therefore has no
-- insert or update policy — this table holds the *customer's* decisions and
-- is written by the customer, from Settings, through their own session. So
-- it carries all four policies, each with the same ownership test.
--
-- The shape is `sites_select_own`'s (`00000000000002_rls.sql`): the reader
-- must own the `sites` row, and that row's user must not be tombstoned. The
-- `with check` on insert and update is the same predicate, so a customer
-- cannot write a row against a site that is not theirs, and cannot move an
-- existing row onto one.
--
-- No `anon` policy: a free scan's visitor has no account and owns no site,
-- so there is nothing here they could correct.
create policy site_profile_edits_select_own on site_profile_edits for select to authenticated
  using (
    exists (
      select 1
        from sites s
        join users u on u.id = s.user_id
       where s.id = site_profile_edits.site_id
         and s.user_id = auth.uid()
         and u.deleted_at is null
    )
  );

create policy site_profile_edits_insert_own on site_profile_edits for insert to authenticated
  with check (
    exists (
      select 1
        from sites s
        join users u on u.id = s.user_id
       where s.id = site_profile_edits.site_id
         and s.user_id = auth.uid()
         and u.deleted_at is null
    )
  );

create policy site_profile_edits_update_own on site_profile_edits for update to authenticated
  using (
    exists (
      select 1
        from sites s
        join users u on u.id = s.user_id
       where s.id = site_profile_edits.site_id
         and s.user_id = auth.uid()
         and u.deleted_at is null
    )
  )
  with check (
    exists (
      select 1
        from sites s
        join users u on u.id = s.user_id
       where s.id = site_profile_edits.site_id
         and s.user_id = auth.uid()
         and u.deleted_at is null
    )
  );

create policy site_profile_edits_delete_own on site_profile_edits for delete to authenticated
  using (
    exists (
      select 1
        from sites s
        join users u on u.id = s.user_id
       where s.id = site_profile_edits.site_id
         and s.user_id = auth.uid()
         and u.deleted_at is null
    )
  );

-- `service_role` bypasses RLS but still needs the object privilege
-- (`BYPASSRLS` skips row policies, not table grants) — the same grant the
-- baseline makes for every other table.
grant select, insert, update, delete on site_profile_edits
  to anon, authenticated, service_role;
