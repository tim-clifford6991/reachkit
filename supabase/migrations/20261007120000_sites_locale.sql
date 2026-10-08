-- sites.country, sites.language — where a site's buyers are and what they
-- search in.
--
-- Issue #1311 · SPEC §6 (owner, D66 of 2026-10-07): each site is measured in
-- its own country and language. Before this every vendor read was made as
-- Google in the United States, in English.
--
--   country   ISO 3166-1 alpha-2, upper case ('DE')
--   language  ISO 639-1, lower case ('de')
--
-- Both null is a site nobody has read or asked yet: its next pass reads the
-- pair from the site's address and home page and stores it here. Setup asks
-- the founder once, with the reading filled in, and the founder's answer is
-- what is stored.
--
-- The list of supported pairs is data in the application
-- (`src/lib/locale/locales.ts`), so a country is added there and not here.
-- The check below holds the shape only; a stored pair that is not on the
-- list is read as none.
--
-- Rule 3a: the `sites` topic (`src/lib/db/topics.ts`).

alter table sites
  add column country text,
  add column language text,
  add constraint sites_locale_shape check (
    (country is null and language is null)
    or (country ~ '^[A-Z]{2}$' and language ~ '^[a-z]{2}$')
  );

comment on column sites.country is
  'The country this site is measured in, ISO 3166-1 alpha-2 (#1311, SPEC §6 D66). '
  'Null until a pass reads it or setup asks; set together with sites.language.';
comment on column sites.language is
  'The language this site is measured and written in, ISO 639-1 (#1311, SPEC §6 D66).';
