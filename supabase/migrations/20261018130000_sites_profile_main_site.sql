-- site_profiles.main_site — what the scan read of the main site that ties
-- the content host to it as one business.
--
-- Issue 1511 · SPEC §7 (2026-10-18, owner: "follow all recommendations from
-- our seo master"). Read off the documents the scan already fetched, so 0¢
-- (`src/lib/site-profile/main-site.ts`):
--
--   · `home` — the main site's canonical home, after its redirects and at
--     its own canonical. The hosted pages link back to it, and their
--     Organization `url` is it;
--   · `organization` — the `@id`, `name` and `logo` the main site's own
--     JSON-LD declares, so the hosted Organization reuses the `@id` and never
--     contradicts the name or the logo;
--   · `sameAs` — the profile pages the main site itself links to;
--   · `links` — per content host, whether the main site's own pages link it
--     (`linked`, `not_followed`, `not_linked`). Overview states it once, as
--     an optional finding.
--
-- Null until a pass writes it, and on a domain whose home was not read.
-- RLS is the table's own.
--
-- Rule 3a: the `sites` topic with the `profile` sub-token
-- (`src/lib/db/topics.ts`). Depends on `20260912090000_sites_profile.sql`.
-- Applied after merge through the Supabase connector (docs/PROCESS.md step 4).

alter table site_profiles
  add column main_site jsonb null,
  add constraint site_profiles_main_site_object check (main_site is null or jsonb_typeof(main_site) = 'object');

comment on column site_profiles.main_site is
  'What the scan read of the main site (#1511): its canonical home, its own Organization @id/name/logo, '
  'the profiles it links to, and whether its own pages link each content host.';
