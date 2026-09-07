// tests/scan/free/schema.test.ts
//
// WO-056 `## Test plan` (criteria quoted verbatim from `requirements/
// REQ-003.md` and `requirements/REQ-001.md`; this WO makes them
// *checkable*, the behaviour they describe is WO-057's and WO-058's) —
// asserted against a live, migrated scratch database, per BP-023 `##
// Data model delta`.
//
// **Substrate note (owner ruling, 2026-09-03; Docker unavailable on this
// host, carried from `tests/db/baseline.test.ts`):** `supabase db reset`
// cannot run. In its place this file resets and re-applies
// `00000000000001_baseline.sql` and `00000000000005_scans_freepath.sql`
// against native PostgreSQL 18 at `127.0.0.1:5432`, database
// `reachkit_scratch`, via `psql` spawned from `child_process` — the same
// mechanism `tests/db/baseline.test.ts` and `tests/account/columns.test.ts`
// use. RLS is not under test here (this migration adds none), so
// `00000000000002_rls.sql` is not applied.
//
// **Run this file with `--no-file-parallelism`** alongside `tests/db/*`
// and `tests/account/columns.test.ts` (see `tests/db/baseline.test.ts`'s
// header for why): all reset and rebuild the same physical `public` schema
// on the one scratch database `supabase db reset` would otherwise give
// each an isolated instance of.
//
// **Known gap, recorded rather than hidden (constitution rule 4.2):**
// REQ-001 criterion 17's full claim — "a `failed` scan never becomes
// `is_current`" — rests on `scans.is_current` and its partial unique index
// `unique (domain) where is_current`, both BP-012's own migration
// (`WO-254`, `status: draft`, not part of wave W2 and not named in this
// WO's `depends-on`). Neither exists in this schema yet, so the literal
// "existing partial unique index still holds exactly one current row"
// half of the WO's own test-plan row cannot be exercised here; it is
// `it.skip`'d below with the same citation, once, rather than faked.
// What *is* checkable from this migration's own scope — that inserting a
// `failed` scan touches no other row for the same domain — is asserted in
// its place.
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  psql,
  psqlRows,
} from "../../db/substrate";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const BASELINE_MIGRATION = path.join(
  REPO_ROOT,
  "supabase/migrations/00000000000001_baseline.sql"
);
const FREEPATH_MIGRATION = path.join(
  REPO_ROOT,
  "supabase/migrations/00000000000005_scans_freepath.sql"
);

/** One tuple-only row per line, `|`-separated columns — easy to split. */
/** Runs `sql` and returns whether it raised (never throws itself). */
function raises(sql: string): boolean {
  try {
    psql(["-v", "ON_ERROR_STOP=1", "-c", sql]);
    return false;
  } catch {
    return true;
  }
}

beforeAll(() => {
  psql([
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    "drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role;",
  ]);
  psql(["-v", "ON_ERROR_STOP=1", "-f", BASELINE_MIGRATION]);
  psql(["-v", "ON_ERROR_STOP=1", "-f", FREEPATH_MIGRATION]);
});

afterAll(() => {
  psql([
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    "drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role;",
  ]);
});

function freshUserId(): string {
  const rows = psqlRows(
    `insert into users (email, plan_status) values ('freepath-${Math.random().toString(36).slice(2)}@example.com', 'active') returning id;`
  );
  const [row] = rows;
  const [id] = row ?? [];
  if (!id) throw new Error("insert into users returned no id");
  return id;
}

function insertScan(opts: {
  domain: string;
  status?: string;
  tier?: string;
  networkHash?: string | null;
  createdAt?: string;
  finishedAt?: string | null;
}): string {
  const {
    domain,
    status = "done",
    tier = "free",
    networkHash = null,
    createdAt,
    finishedAt,
  } = opts;
  const columns = ["domain", "tier", "status"];
  const values = [`'${domain}'`, `'${tier}'`, `'${status}'`];
  if (networkHash !== null) {
    columns.push("network_hash");
    values.push(`'${networkHash}'`);
  }
  if (createdAt) {
    columns.push("created_at");
    values.push(`'${createdAt}'`);
  }
  if (finishedAt !== undefined) {
    columns.push("finished_at");
    values.push(finishedAt === null ? "null" : `'${finishedAt}'`);
  }
  const rows = psqlRows(
    `insert into scans (${columns.join(", ")}) values (${values.join(", ")}) returning id;`
  );
  const [row] = rows;
  const [id] = row ?? [];
  if (!id) throw new Error("insert into scans returned no id");
  return id;
}

describe(
  'REQ-003 c2 — "no more than 5 of those 100 take longer than 60 seconds, and none takes longer than the 90 seconds of criterion 5" — measurability only (the ceiling behaviour is WO-059\'s)',
  () => {
    it("`finished_at` exists, is nullable timestamptz, and defaults to no value", () => {
      const rows = psqlRows(
        `select data_type, is_nullable, column_default from information_schema.columns where table_schema = 'public' and table_name = 'scans' and column_name = 'finished_at';`
      );
      expect(rows).toEqual([["timestamp with time zone", "YES", ""]]);
    });

    it("elapsed time for the last 100 free rows is computable from `scans(created_at, finished_at, tier)` alone, no join", () => {
      const userId = freshUserId();
      void userId; // not needed for a free scan (site_id is null for free)
      for (let i = 0; i < 5; i++) {
        insertScan({
          domain: `p95-${i}.example.com`,
          status: "done",
          tier: "free",
          finishedAt: `2026-01-01T00:0${i}:30Z`,
          createdAt: "2026-01-01T00:00:00Z",
        });
      }
      // The exact query shape BP-023's NFR budget cites: p95 of elapsed
      // seconds over the last 100 free rows, off `scans` alone.
      const rows = psqlRows(`
        select percentile_cont(0.95) within group (
          order by extract(epoch from (finished_at - created_at))
        )
        from (
          select created_at, finished_at
          from scans
          where tier = 'free'
          order by created_at desc
          limit 100
        ) recent;
      `);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.[0]).not.toBe("");
    });

    it("the query above names no other table (source-level check on the query text used above)", () => {
      const query = `
        select percentile_cont(0.95) within group (
          order by extract(epoch from (finished_at - created_at))
        )
        from (
          select created_at, finished_at
          from scans
          where tier = 'free'
          order by created_at desc
          limit 100
        ) recent;
      `;
      const fromClauses = query.match(/from\s+(\w+)/gi) ?? [];
      for (const clause of fromClauses) {
        expect(clause.toLowerCase()).toMatch(/from\s+(scans|recent)/);
      }
    });
  }
);

describe(
  'REQ-003 c6 — "a visitor who has already started five free scans from the same network within the last hour … refused" — the hourly counter is an indexed aggregate over `scans`',
  () => {
    it("`network_hash` exists, is nullable text (null for paid tiers)", () => {
      const rows = psqlRows(
        `select data_type, is_nullable, column_default from information_schema.columns where table_schema = 'public' and table_name = 'scans' and column_name = 'network_hash';`
      );
      expect(rows).toEqual([["text", "YES", ""]]);
    });

    it("the composite index `(network_hash, created_at desc)` exists, not two single-column indexes", () => {
      const rows = psqlRows(
        `select indexdef from pg_indexes where schemaname = 'public' and indexname = 'idx_scans_network_hash_created_at';`
      );
      expect(rows).toHaveLength(1);
      const [indexdef] = rows[0] ?? [];
      expect(indexdef).toMatch(/\(network_hash, created_at DESC\)/);

      // The composite exists; confirm no separate single-column index on
      // either column was added instead (BP-023's NFR budget costs its two
      // aggregates against the one composite).
      const singleColumnIndexes = psqlRows(
        `select indexname from pg_indexes where schemaname = 'public' and tablename = 'scans' and indexdef ~ 'USING btree \\(network_hash\\)$';`
      );
      expect(singleColumnIndexes).toHaveLength(0);
    });

    it("the planner uses the composite index for a count over `network_hash = $1 and created_at > now() - interval '1 hour'`", () => {
      // Seed enough rows that the planner's own cost model prefers the
      // index over a sequential scan, then force the comparison with
      // `enable_seqscan = off` so a plan that *can* use the index does —
      // proving the index is usable for this exact predicate shape, not
      // merely present in the catalogue.
      for (let i = 0; i < 20; i++) {
        insertScan({ domain: `net-${i}.example.com`, networkHash: "hash-a", tier: "free" });
      }
      const plan = psql([
        "-v",
        "ON_ERROR_STOP=1",
        "-Atc",
        `set enable_seqscan = off; explain select count(*) from scans where network_hash = 'hash-a' and created_at > now() - interval '1 hour';`,
      ]);
      expect(plan).toMatch(/idx_scans_network_hash_created_at/);
    });
  }
);

describe(
  'REQ-003 c7 — "a scan is already running from the visitor\'s network … no second scan starts" — in-flight is `status = \'running\'`, not a second record',
  () => {
    it("`scans.status` accepts `running`, `done`, `degraded` and `failed`", () => {
      for (const status of ["running", "done", "degraded", "failed"]) {
        expect(raises(`insert into scans (domain, tier, status) values ('status-${status}.example.com', 'free', '${status}');`)).toBe(
          false
        );
      }
    });

    it("`scans.status` rejects any other value", () => {
      expect(
        raises(`insert into scans (domain, tier, status) values ('status-bogus.example.com', 'free', 'bogus');`)
      ).toBe(true);
    });

    it("the migration created no table — `scans` remains one record per attempt, not a second ledger", () => {
      const rows = psqlRows(
        `select table_name from information_schema.tables where table_schema = 'public' order by table_name;`
      );
      const names = rows.map((r) => r[0]);
      expect(names.sort()).toEqual(
        ["destinations", "drafts", "leads", "opportunities", "publications", "scans", "sites", "users"].sort()
      );
      // Named explicitly, per BP-023 decision 1 / `BUILD.md` §10's bar:
      // no `rate_limits` table and no counter table.
      expect(names).not.toContain("rate_limits");
    });
  }
);

describe(
  'REQ-001 c14 — "That offer is made once and does not chain … carries the same written line and no re-scan control" — `from_incomplete_rescan` defaults false and is not null',
  () => {
    it("column exists, not-null, default false", () => {
      const rows = psqlRows(
        `select data_type, is_nullable, column_default from information_schema.columns where table_schema = 'public' and table_name = 'scans' and column_name = 'from_incomplete_rescan';`
      );
      expect(rows).toEqual([["boolean", "NO", "false"]]);
    });

    it("a row inserted by a writer that never heard of this column reads false, not null", () => {
      const id = insertScan({ domain: "no-writer-knowledge.example.com" });
      const rows = psqlRows(`select from_incomplete_rescan from scans where id = '${id}';`);
      expect(rows).toEqual([["f"]]);
    });

    it("explicit null is refused (not-null constraint, not merely a default)", () => {
      expect(
        raises(
          `insert into scans (domain, tier, status, from_incomplete_rescan) values ('explicit-null.example.com', 'free', 'done', null);`
        )
      ).toBe(true);
    });
  }
);

describe(
  'REQ-001 c17 — "A measurement that produces no report — it failed, or it was refused — leaves the previous report and its date unchanged at that address"',
  () => {
    it("a `failed` scan for a domain that already has another scan does not modify or remove that other row", () => {
      const existingId = insertScan({ domain: "already-current.example.com", status: "done" });
      const before = psqlRows(`select status, report from scans where id = '${existingId}';`);

      insertScan({ domain: "already-current.example.com", status: "failed" });

      const after = psqlRows(`select status, report from scans where id = '${existingId}';`);
      expect(after).toEqual(before);
      const rowCount = psqlRows(
        `select count(*) from scans where domain = 'already-current.example.com';`
      );
      expect(rowCount[0]?.[0]).toBe("2");
    });

    // `is_current` and its partial unique index `unique (domain) where
    // is_current` are BP-012's own migration (WO-254, `status: draft`, not
    // part of wave W2) — neither exists in this schema. This half of the
    // WO's own test-plan row cannot be exercised until that migration
    // lands; see this file's header note (constitution rule 4.2).
    it.skip("a failed scan never becomes `is_current` — deferred to WO-254 (scans.is_current does not exist yet)", () => {
      // Intentionally left unimplemented. Enable once WO-254 lands and
      // ships `scans.is_current` plus `unique (domain) where is_current`.
    });
  }
);
