-- supabase/migrations/20261017140000_scans_rescore_auto.sql
--
-- Issue 1481 — the re-score follows every scoring deploy by itself. The
-- deployment carries its derivation (`RK_DERIVATION`, a fingerprint of the
-- files the re-score reads a scan with). When the `scan/rescore` tick finds no
-- run at the deployed derivation, it asks a dry run itself; when that dry
-- run's guard holds, it asks the apply; after the apply, a dry run that checks
-- it. Nobody inserts the row. The master session still may, as before.
--
-- **`derivation`** is the fingerprint the run read the scans with.
-- **`auto`** is true where the tick asked for it, false where a person did.
-- **`held`** is why the guard stopped the apply this dry run would have led
-- to, or why the check found the apply lagging; null where it holds.
-- **`scans_unreadable`** is how many stored scans this build could not read:
-- the guard's "no new error" compares it with the run before.
-- **`stale_scans`** is the scans that, after this run, still read differently
-- from the deployed code: every scan a dry run would move, the scans an apply
-- left alone. The public report reads it for its staleness line.
--
-- Applied after merge through the Supabase connector (docs/PROCESS.md step 4).

alter table rescore_runs
  add column derivation text,
  add column auto boolean not null default false,
  add column held text,
  add column scans_unreadable integer,
  add column stale_scans uuid[];

create index idx_rescore_runs_derivation on rescore_runs (derivation, requested_at desc);
