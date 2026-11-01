-- supabase/migrations/20261101140000_fetches_facts.sql
--
-- Expand-only: one new table, nothing in `fetches` added or changed.
--
-- `fetch_facts` keeps what the re-score reads off one stored page read
-- (`src/lib/scan/page-facts.ts`), derived from its payload once. A row is
-- trusted only at the `facts_version` the deployed code carries
-- (`RK_FACTS_VERSION`); at any other the re-score reads the payload again
-- and overwrites it. A cache that can be rebuilt from `fetches`. No cascade
-- (ADR-051): `scan_id` is its read's, so the account purge deletes a scan's
-- facts by it, just before that scan's `fetches` rows.
--
-- Not applied by the PR that adds it; applied through the Supabase
-- connector before the deploy whose code reads it (docs/PROCESS.md step 4).
create table fetch_facts (
  fetch_id uuid primary key references fetches (id),
  scan_id uuid not null,
  facts_version text not null,
  facts jsonb not null,
  computed_at timestamptz not null default now()
);

create index idx_fetch_facts_scan_id on fetch_facts (scan_id);

-- No policy: no session reads or writes a page's facts.
alter table fetch_facts enable row level security;
revoke all on fetch_facts from anon, authenticated;
grant select, insert, update, delete on fetch_facts to service_role;

comment on table fetch_facts is
  'Facts the re-score reads off one fetches row, keyed to the extractor code by facts_version. '
  'dbAdmin()-only; default-deny; no anon/authenticated policy by design.';
