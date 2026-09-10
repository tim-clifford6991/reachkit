// tests/scan/report/schema.test.ts
//
// WO-280 `## Test plan` (carried verbatim from WO-254) — the column,
// constraint and index assertions BP-012 `## Data model delta` and
// decision 1 name, asserted against a live, migrated scratch database.
//
// **Substrate note (owner ruling, 2026-09-03; Docker unavailable on this
// host, mirroring `tests/scan/free/schema.test.ts` and `tests/measure/
// verdict/constraint.test.ts`'s own mechanism):** resets and re-applies
// the baseline plus this WO's own `*_scans_current.sql` against native
// PostgreSQL 18 at `127.0.0.1:5432`, database `reachkit_scratch`, via
// `psql` spawned from `child_process`. RLS is not under test here (this
// migration adds none), so `00000000000002_rls.sql` is not applied.
//
// **Run this file with `--no-file-parallelism`** alongside the rest of
// `vitest.config.ts`'s `db` project — all reset and rebuild the same
// physical `public` schema on the one scratch database `supabase db
// reset` would otherwise give each an isolated instance of.
// `vitest.config.ts` is outside this work order's file plan (rule 2); this
// file is folded into that project's `LIVE_SCHEMA_TESTS` list, the one
// declared place both the `db` project's `include` and the `node`
// project's `exclude` read from (WO-283).
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  psql,
  psqlRows,
} from "../../db/substrate";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const BASELINE_MIGRATION = path.join(REPO_ROOT, "supabase/migrations/00000000000001_baseline.sql");
const CURRENT_MIGRATION = path.join(
  REPO_ROOT,
  "supabase/migrations/20260904110000_scans_current.sql"
);
// Issue #25's write half. `store_current_report` reads `finished_at`, so
// the free-path migration that adds it is applied here too.
const FREEPATH_MIGRATION = path.join(REPO_ROOT, "supabase/migrations/00000000000005_scans_freepath.sql");
const FLIP_MIGRATION = path.join(
  REPO_ROOT,
  "supabase/migrations/20260905120000_scans_current_flip.sql"
);
// The constraint that ties `scans.score` to the blob's own verdict arm, so
// the flip is exercised against the shape the row really has.
const VERDICT_MIGRATION = path.join(REPO_ROOT, "supabase/migrations/20260904100000_scans_verdict.sql");
// Issue #449 — `scans.cost_cents` becomes `numeric(12,4)` and
// `store_current_report` takes its cost as `numeric`, so a pass that spent
// a fraction of a cent stores what it spent. Applied last: it drops and
// recreates the function `FLIP_MIGRATION` declares.
const SCANS_MONEY_MIGRATION = path.join(
  REPO_ROOT,
  "supabase/migrations/20260910090100_scans_money.sql"
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

function resetSchema(): void {
  psql([
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    "drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role;",
  ]);
}

beforeAll(() => {
  resetSchema();
  psql(["-v", "ON_ERROR_STOP=1", "-f", BASELINE_MIGRATION]);
  psql(["-v", "ON_ERROR_STOP=1", "-f", FREEPATH_MIGRATION]);
  psql(["-v", "ON_ERROR_STOP=1", "-f", CURRENT_MIGRATION]);
  psql(["-v", "ON_ERROR_STOP=1", "-f", VERDICT_MIGRATION]);
  psql(["-v", "ON_ERROR_STOP=1", "-f", FLIP_MIGRATION]);
  psql(["-v", "ON_ERROR_STOP=1", "-f", SCANS_MONEY_MIGRATION]);
});

afterAll(() => {
  resetSchema();
});

function insertScan(opts: { domain: string; isCurrent?: boolean; status?: string }): string {
  const { domain, isCurrent, status = "done" } = opts;
  const columns = ["domain", "tier", "status"];
  const values = [`'${domain}'`, "'free'", `'${status}'`];
  if (isCurrent !== undefined) {
    columns.push("is_current");
    values.push(String(isCurrent));
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
  'BP-012 `## Data model delta` — "scans — as BUILD.md §10, plus is_current … supersedes_scan_id, correction_state, and stopped_reason"',
  () => {
    it("`is_current` is boolean, not null, default false", () => {
      const rows = psqlRows(
        `select data_type, is_nullable, column_default from information_schema.columns where table_schema = 'public' and table_name = 'scans' and column_name = 'is_current';`
      );
      expect(rows).toEqual([["boolean", "NO", "false"]]);
    });

    it("`supersedes_scan_id` is a nullable uuid referencing scans(id)", () => {
      const rows = psqlRows(
        `select data_type, is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'scans' and column_name = 'supersedes_scan_id';`
      );
      expect(rows).toEqual([["uuid", "YES"]]);
      expect(
        raises(
          `insert into scans (domain, tier, status, supersedes_scan_id) values ('bad-fk.example.com', 'free', 'done', '00000000-0000-0000-0000-000000000000');`
        )
      ).toBe(true);
      const parentId = insertScan({ domain: "supersedes-parent.example.com" });
      expect(
        raises(
          `insert into scans (domain, tier, status, supersedes_scan_id) values ('supersedes-child.example.com', 'free', 'done', '${parentId}');`
        )
      ).toBe(false);
    });

    it("`correction_state` is text, not null, default 'none'", () => {
      const rows = psqlRows(
        `select data_type, is_nullable, column_default from information_schema.columns where table_schema = 'public' and table_name = 'scans' and column_name = 'correction_state';`
      );
      expect(rows).toEqual([["text", "NO", "'none'::text"]]);
      const id = insertScan({ domain: "no-writer-knowledge-correction.example.com" });
      const value = psqlRows(`select correction_state from scans where id = '${id}';`);
      expect(value).toEqual([["none"]]);
    });

    it("`stopped_reason` is text, not null, default 'complete', constrained to the four named values", () => {
      const rows = psqlRows(
        `select data_type, is_nullable, column_default from information_schema.columns where table_schema = 'public' and table_name = 'scans' and column_name = 'stopped_reason';`
      );
      expect(rows).toEqual([["text", "NO", "'complete'::text"]]);

      for (const reason of ["complete", "time_ceiling", "spend_ceiling", "failed"]) {
        expect(
          raises(
            `insert into scans (domain, tier, status, stopped_reason) values ('reason-${reason}.example.com', 'free', 'done', '${reason}');`
          )
        ).toBe(false);
      }
      expect(
        raises(
          `insert into scans (domain, tier, status, stopped_reason) values ('reason-bogus.example.com', 'free', 'done', 'bogus');`
        )
      ).toBe(true);
    });
  }
);

describe(
  'BP-012 decision 1 — "unique (domain) where is_current plus a single transaction that inserts the new scan and flips the pointer" — the index half',
  () => {
    it("two current reports for one domain are unrepresentable", () => {
      insertScan({ domain: "one-current.example.com", isCurrent: true });
      expect(
        raises(
          `insert into scans (domain, tier, status, is_current) values ('one-current.example.com', 'free', 'done', true);`
        )
      ).toBe(true);
    });

    it("a second row with `is_current = false` for the same domain inserts freely — the index constrains only what it should", () => {
      insertScan({ domain: "one-current-plus-history.example.com", isCurrent: true });
      expect(
        raises(
          `insert into scans (domain, tier, status, is_current) values ('one-current-plus-history.example.com', 'free', 'done', false);`
        )
      ).toBe(false);
      const rowCount = psqlRows(
        `select count(*) from scans where domain = 'one-current-plus-history.example.com';`
      );
      expect(rowCount[0]?.[0]).toBe("2");
    });

    it("the index is a partial index on `(domain) where is_current`, not a bare unique on `domain`", () => {
      const rows = psqlRows(
        `select indexdef from pg_indexes where schemaname = 'public' and indexname = 'idx_scans_one_current_per_domain';`
      );
      expect(rows).toHaveLength(1);
      const [indexdef] = rows[0] ?? [];
      expect(indexdef).toMatch(/UNIQUE INDEX idx_scans_one_current_per_domain ON public\.scans USING btree \(domain\) WHERE is_current/);
    });
  }
);

describe(
  'BP-012 decision 1 — "a single transaction that inserts the new scan and flips the pointer" — the transaction half (issue #25)',
  () => {
    /** `store_current_report`, called the way `storeCurrentReport` calls it. */
    function store(opts: {
      scanId: string;
      domain: string;
      status?: string;
      score?: number | null;
      stoppedReason?: string;
      makeCurrent: boolean;
      supersedes?: string | null;
      costCents?: number;
    }): void {
      const {
        scanId,
        domain,
        status = "done",
        score = 31,
        stoppedReason = "complete",
        makeCurrent,
        supersedes = null,
        costCents = 6,
      } = opts;
      psql([
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        `select store_current_report('${scanId}'::uuid, '${domain}', null, 'free', '${status}', ` +
          `${score === null ? "null" : score}, '{}'::jsonb, ` +
          `'{"verdict":{"scoreAndBand":{"kind":"${score === null ? "unmeasured" : "measured"}"}}}'::jsonb, ` +
          `${costCents}, '${stoppedReason}', 'none', ${supersedes === null ? "null" : `'${supersedes}'::uuid`}, ${makeCurrent});`,
      ]);
    }

    function currentIdsFor(domain: string): string[] {
      return psqlRows(`select id from scans where domain = '${domain}' and is_current;`).map((row) => row[0] ?? "");
    }

    const FIRST = "aaaaaaaa-0000-4000-8000-000000000001";
    const SECOND = "aaaaaaaa-0000-4000-8000-000000000002";
    const THIRD = "aaaaaaaa-0000-4000-8000-000000000003";

    it("inserts the row when there is none, and makes it the domain's current report", () => {
      store({ scanId: FIRST, domain: "flip-first.example.com", makeCurrent: true });
      expect(currentIdsFor("flip-first.example.com")).toEqual([FIRST]);
      const row = psqlRows(`select tier, status, cost_cents, stopped_reason from scans where id = '${FIRST}';`);
      expect(row).toEqual([["free", "done", "6.0000", "complete"]]);
    });

    it("stores a sub-cent roll-up whole — the free pass that cost 0.72¢ (issue #449)", () => {
      // `p_cost_cents` was `integer` and `storeCurrentReport` rounded the
      // seam's figure **up** to feed it, so a pass that spent 0.72¢ stored
      // 1¢ and one that spent 6.3¢ stored 7¢ — the roll-up disagreeing
      // with the `fetches` rows it summarises. Both go through whole now.
      const cheap = "cccccccc-0000-4000-8000-000000000001";
      store({ scanId: cheap, domain: "money-subcent.example.com", makeCurrent: true, costCents: 0.72 });
      expect(psqlRows(`select cost_cents from scans where id = '${cheap}';`)).toEqual([["0.7200"]]);

      const settled = "cccccccc-0000-4000-8000-000000000002";
      store({ scanId: settled, domain: "money-settled.example.com", makeCurrent: true, costCents: 1.12928 });
      expect(psqlRows(`select cost_cents from scans where id = '${settled}';`)).toEqual([["1.1293"]]);
    });

    it("`scans.cost_cents` is `numeric(12,4)` and there is exactly one `store_current_report`", () => {
      expect(
        psqlRows(
          `select data_type, numeric_precision, numeric_scale from information_schema.columns ` +
            `where table_schema = 'public' and table_name = 'scans' and column_name = 'cost_cents';`
        )
      ).toEqual([["numeric", "12", "4"]]);
      // The parameter's type cannot be changed in place: a second,
      // overloaded definition is what PostgREST could not then resolve, so
      // the migration drops the old signature rather than adding to it.
      expect(
        psqlRows(
          `select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace ` +
            `where n.nspname = 'public' and p.proname = 'store_current_report';`
        )
      ).toEqual([["1"]]);
    });

    it("adopts the row the free path already claimed rather than inserting a second", () => {
      const claimed = insertScan({ domain: "flip-adopt.example.com", status: "running" });
      store({ scanId: claimed, domain: "flip-adopt.example.com", makeCurrent: true });
      const rows = psqlRows(`select count(*) from scans where domain = 'flip-adopt.example.com';`);
      expect(rows[0]?.[0]).toBe("1");
      expect(currentIdsFor("flip-adopt.example.com")).toEqual([claimed]);
    });

    it("clears the previous pointer and sets the new one — the domain is never left with none, and never with two", () => {
      store({ scanId: SECOND, domain: "flip-move.example.com", makeCurrent: true });
      expect(currentIdsFor("flip-move.example.com")).toEqual([SECOND]);
      store({ scanId: THIRD, domain: "flip-move.example.com", makeCurrent: true });
      // Exactly one, and it is the new one. Two would have violated the
      // partial unique index; zero would mean the clear committed alone.
      expect(currentIdsFor("flip-move.example.com")).toEqual([THIRD]);
      const kept = psqlRows(`select count(*) from scans where domain = 'flip-move.example.com';`);
      expect(kept[0]?.[0]).toBe("2");
    });

    it("a pass that produced no report leaves the previous report and its date exactly where they were", () => {
      const good = "bbbbbbbb-0000-4000-8000-000000000001";
      const bad = "bbbbbbbb-0000-4000-8000-000000000002";
      store({ scanId: good, domain: "flip-failed.example.com", makeCurrent: true });
      const before = psqlRows(`select created_at from scans where id = '${good}';`);

      store({
        scanId: bad,
        domain: "flip-failed.example.com",
        status: "failed",
        score: null,
        stoppedReason: "failed",
        makeCurrent: false,
      });

      expect(currentIdsFor("flip-failed.example.com")).toEqual([good]);
      expect(psqlRows(`select created_at from scans where id = '${good}';`)).toEqual(before);
      // The failed pass is still recorded — the row exists, it is just not
      // the one the address serves.
      expect(psqlRows(`select status from scans where id = '${bad}';`)).toEqual([["failed"]]);
    });

    it("keeps `score` and the blob's verdict in step, so the check constraint holds either way", () => {
      const scored = "cccccccc-0000-4000-8000-000000000001";
      const unscored = "cccccccc-0000-4000-8000-000000000002";
      expect(() => store({ scanId: scored, domain: "flip-score.example.com", makeCurrent: true })).not.toThrow();
      expect(() =>
        store({ scanId: unscored, domain: "flip-unscored.example.com", score: null, makeCurrent: true })
      ).not.toThrow();
      expect(psqlRows(`select coalesce(score::text, 'null') from scans where id = '${unscored}';`)).toEqual([["null"]]);
      expect(psqlRows(`select coalesce(score::text, 'null') from scans where id = '${scored}';`)).toEqual([["31"]]);
    });

    it("records which scan a correction superseded", () => {
      const corrected = "dddddddd-0000-4000-8000-000000000001";
      const correction = "dddddddd-0000-4000-8000-000000000002";
      store({ scanId: corrected, domain: "flip-correct.example.com", makeCurrent: true });
      store({ scanId: correction, domain: "flip-correct.example.com", makeCurrent: true, supersedes: corrected });
      expect(psqlRows(`select supersedes_scan_id from scans where id = '${correction}';`)).toEqual([[corrected]]);
      expect(currentIdsFor("flip-correct.example.com")).toEqual([correction]);
    });
  }
);
