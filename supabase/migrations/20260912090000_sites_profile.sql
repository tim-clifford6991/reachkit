-- site_profiles — what ReachKit has read of the customer's own site.
--
-- Issue #577 · `SPEC.md` §0 ("Site profile"), §2 Rules ("The scan builds
-- the site profile"), §5 Rules ("The site profile is confirmed here") and
-- §12 ruling 8 (2026-09-12): "a **site profile** — up to 100 pages read
-- from the sitemap and internal links on the free scan and refreshed
-- weekly, storing the page inventory with a purpose per page, the site
-- name, products and claims, and a brand-voice summary".
--
-- **Keyed by domain, not by site.** The profile is built by the *free*
-- scan, and §2's first rule for that scan is "no account and no payment" —
-- there is no `sites` row to hang it on when it is first written, and the
-- visitor may never create one. The domain is the one identity a free scan
-- and a paid site share, so it is the key, exactly as `scans` keys a free
-- pass's own report. An account reads its profile by the domain it set up
-- with; a domain nobody ever buys keeps a profile nobody reads, which
-- costs one row.
--
-- **One row per domain, overwritten.** A refresh is the same fact
-- re-measured, not a second fact: the weekly pass upserts this row (§5,
-- "refreshed weekly"), and no history is kept because nothing in the nine
-- features reads a past inventory. `refreshed_at` is when it was last
-- read, which is the only thing about the previous read that matters.
--
-- **The hundred-page bound is a constraint, not a convention.** §2 pins it
-- ("Bounded: 100 pages, one run per scan") and `SITE_PROFILE.MAX_PAGES`
-- holds it for the crawler; the check below is the same number held where
-- a bug cannot talk its way past it. A site of fewer pages stores what it
-- has: the ruling's bound is a ceiling, never a quota to fill.
--
-- **What is derived and what is the customer's, kept apart.** Every column
-- here is derived — a crawl and one model call read it off the site, and a
-- refresh may overwrite any of it. The voice the customer *confirmed* is
-- not here: it is `sites.voice_text`, which they edit at setup (§5) and in
-- settings, and which drafting already reads as the one free-text field
-- §7 allows a prompt. `sites.voice_edited_at` below is what keeps the two
-- apart — a refresh seeds the customer's field from this one only while
-- that stamp is null, so "a customer edit to the voice is not overwritten
-- by a refresh" is a fact about a column rather than a promise about a
-- code path.
--
-- Rule 3a: the `sites` topic with the `profile` sub-token
-- (`src/lib/db/topics.ts`). The timestamp sorts after every migration on
-- disk at implementation time; it depends on `00000000000001_baseline.sql`
-- for `sites` and on nothing else.

create table site_profiles (
  domain text primary key,
  site_name text,
  products jsonb not null default '[]'::jsonb,
  claims jsonb not null default '[]'::jsonb,
  voice jsonb,
  inventory jsonb not null default '[]'::jsonb,
  pages_read integer not null default 0,
  refreshed_at timestamptz not null default now(),
  constraint site_profiles_inventory_max_100 check (jsonb_array_length(inventory) <= 100),
  constraint site_profiles_pages_read_non_negative check (pages_read >= 0)
);
alter table site_profiles enable row level security;

comment on table site_profiles is
  'What ReachKit has read of one domain''s own site: the page inventory with a purpose per page, '
  'the site name, its products and claims, and the derived brand-voice summary. Written by the '
  'scan pipeline''s reading_your_site stage at every tier (SPEC.md §2, §12 ruling 8, 2026-09-12); '
  'read by onboarding, settings, drafting and cross-linking. Derived throughout — the voice the '
  'customer confirmed is sites.voice_text, never this row.';

comment on column site_profiles.inventory is
  'Up to 100 InventoryRow values (src/lib/site-profile/types.ts): url, title, h1 and one purpose '
  'from pricing/about/features/product/blog/contact/legal/other. Only pages actually fetched and '
  'parsed appear — a site of fewer pages records what it has, never a padded row.';

comment on column site_profiles.voice is
  'The VoiceSummary the model read off the site: tone, person, vocabulary, claims to keep, claims '
  'to avoid, and `text`, the paragraph rendering shown at setup. Null where the crawl read the '
  'site but the model call did not come back — a degraded profile still carries its inventory.';

-- The owner of the site at this domain may read its profile; nobody else
-- can, and nobody at all writes through `db()`. The shape is
-- `sites_select_own`'s (`00000000000002_rls.sql`), joined through the
-- domain because that is this table's key: the reader must own a `sites`
-- row for the domain, and that row's user must not be tombstoned. There is
-- no insert or update policy — the pipeline writes through `dbAdmin()`,
-- which is the only writer, exactly as `scans` is written.
--
-- No `anon` policy: a free scan's visitor has no session and reads their
-- report through the report's own server-side path, never this table.
create policy site_profiles_select_own on site_profiles for select to authenticated
  using (
    exists (
      select 1
        from sites s
        join users u on u.id = s.user_id
       where s.domain = site_profiles.domain
         and s.user_id = auth.uid()
         and u.deleted_at is null
    )
  );

-- `service_role` bypasses RLS but still needs the object privilege
-- (`BYPASSRLS` skips row policies, not table grants) — the same grant the
-- baseline makes for every other table, and `dbAdmin()`'s only access
-- path.
grant select, insert, update, delete on site_profiles
  to anon, authenticated, service_role;

-- The stamp that makes a customer's voice theirs. Null means "never
-- edited", so a refresh may seed `sites.voice_text` from the profile;
-- once it carries an instant, every refresh leaves the text alone
-- (§5 done-when, 2026-09-12: "a customer edit to the voice is not
-- overwritten by a refresh").
alter table sites
  add column voice_edited_at timestamptz;

comment on column sites.voice_edited_at is
  'When the customer last wrote their brand voice themselves, at setup or in settings. Null while '
  'the voice is still whatever the site profile derived, which is the only state in which a '
  'refresh may overwrite sites.voice_text (SPEC.md §5, 2026-09-12).';
