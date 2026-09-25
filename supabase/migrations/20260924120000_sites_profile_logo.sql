-- site_profiles.logo_* — the one logo the free scan keeps per site.
--
-- Issue #1069 · SPEC §2 (2026-09-24, #1058): the free-scans gallery at
-- `/scans` and the landing's strip draw each site by the logo read from it,
-- and by a first-letter tile when none is usable. The scan reads it off the
-- home document (`src/lib/site-profile/logo.ts`) and keeps the bytes here,
-- beside the site name it is drawn next to, so ReachKit serves the picture
-- from its own origin and a visitor's browser never asks the scanned site.
--
-- **Bytes, not an address.** A stored URL would hotlink: every gallery view
-- would tell the scanned site who was looking, and a logo moved or taken
-- down would leave a broken image in a permanent listing.
--
-- **Bounded here as well as in code.** `SITE_LOGO.MAX_BYTES` is 64 KiB and
-- the type is sniffed from the bytes; the checks keep a hand-written row
-- honest, because `/scans/logo/{domain}` serves `logo_type` as the
-- response's `Content-Type`.
--
-- Rule 3a: the `sites` topic with the `profile` sub-token
-- (`src/lib/db/topics.ts`). Depends on `20260912090000_sites_profile.sql`.

alter table site_profiles
  add column logo_image bytea,
  add column logo_type text,
  add column logo_source text,
  add constraint site_profiles_logo_size check (logo_image is null or octet_length(logo_image) <= 65536),
  add constraint site_profiles_logo_type check (
    logo_type is null
    or logo_type in ('image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/x-icon', 'image/svg+xml')
  ),
  add constraint site_profiles_logo_whole check ((logo_image is null) = (logo_type is null));

comment on column site_profiles.logo_image is
  'The site''s own logo as the free scan read it (#1069): the first usable of apple-touch-icon, a '
  'large icon, og:logo / a square og:image, or the header''s logo image. Null draws a first-letter tile.';
comment on column site_profiles.logo_type is
  'The picture format sniffed from logo_image''s own first bytes, served as its Content-Type.';
comment on column site_profiles.logo_source is
  'The address logo_image was read from, kept so a wrong pick can be traced.';
