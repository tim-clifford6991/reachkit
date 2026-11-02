-- supabase/migrations/20261102120000_fetch_text.sql
--
-- Expand-only: one new table, nothing in `fetches` added or changed.
--
-- `fetch_text` keeps the text the grounding reads off one stored page read,
-- derived from its payload once, so a reader need not download every
-- payload. A row is trusted only at the `text_version` the deployed code
-- carries; at any other the reader derives it again and overwrites it. A
-- cache that can be rebuilt from `fetches`. `read_at` is text so the read's
-- timestamp round-trips byte for byte.
--
-- `document = false` records a read with no payload or none that parses,
-- once, so it is not downloaded again; such a row stores `text = ''` and
-- `examples` and `questions` as `[]`.
--
-- No cascade (ADR-051): `scan_id` is its read's, so the account purge
-- deletes a scan's text by it, just before that scan's `fetches` rows.
--
-- Not applied by the PR that adds it; applied through the Supabase
-- connector before the deploy whose code reads it (docs/PROCESS.md step 4).
create table fetch_text (
  fetch_id uuid primary key references fetches (id),
  scan_id uuid not null,
  text_version text not null,
  url text not null,
  read_at text not null,
  rendered boolean not null,
  document boolean not null,
  text text not null,
  examples jsonb not null,
  questions jsonb not null,
  computed_at timestamptz not null default now()
);

create index idx_fetch_text_scan_id on fetch_text (scan_id);

-- No policy: no session reads or writes a page's text.
alter table fetch_text enable row level security;
revoke all on fetch_text from anon, authenticated;
grant select, insert, update, delete on fetch_text to service_role;

comment on table fetch_text is
  'Text the grounding reads off one fetches row, keyed to the extractor code by text_version. '
  'dbAdmin()-only; default-deny; no anon/authenticated policy by design.';
