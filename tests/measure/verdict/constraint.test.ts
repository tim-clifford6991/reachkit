// tests/measure/verdict/constraint.test.ts
//
// WO-277 `## Test plan` (carried verbatim from WO-055) — REQ-004 c12's
// storage half: "the scalar and the blob cannot disagree", proved against a
// live migrated database rather than mocked, since the property under test
// is the database's own check constraint.
//
// Mirrors `tests/scan/free/admission-claim.test.ts`'s own live-substrate
// mechanism (raw `psql`, native scratch PostgreSQL — Docker unavailable,
// owner ruling 2026-09-03): reset schema, apply the baseline migration plus
// this WO's own `*_scans_verdict*.sql`, then insert rows directly with
// `psql` and assert which inserts the database itself refuses.
//
// **Deviation (rule 4.2, said once, here, mirroring WO-058's own precedent
// exactly):** this file must run serialized against the live substrate, not
// under Vitest's default file parallelism — `vitest.config.ts`'s `db`
// project is where every other live-substrate test in this corpus lives
// (`tests/db/baseline.test.ts`, `tests/db/rls.test.ts`,
// `tests/db/clients.test.ts`, `tests/scan/free/admission-claim.test.ts`).
// `vitest.config.ts` is outside this work order's file plan (rule 2), but
// WO-058 hit the identical gap for its own live-substrate file and closed
// it by folding that file into the `db` project's `include` (and `node`'s
// `exclude`) rather than leaving it to collide under default parallelism —
// TST-022/TST-023 record that fix as sound. This file is folded in the
// same two-line way, for the same reason: two live-substrate test files
// resetting the same physical scratch schema concurrently produce spurious
// failures unrelated to either work order.
//
// `structure.md` rule 4: tests live beside the module they exercise —
// `tests/measure/verdict/**` is BP-024's own glob.
import { readdirSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  psql,
} from "../../db/substrate";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const MIGRATIONS_DIR = path.join(REPO_ROOT, "supabase/migrations");

function resetSchema(): void {
  psql([
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    "drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role;",
  ]);
}

// Baseline plus this WO's own migration only — the constraint under test
// touches only `scans`, which the baseline already creates.
const VERDICT_MIGRATION = readdirSync(MIGRATIONS_DIR).find((f) => /_scans_verdict\.sql$/.test(f));
if (!VERDICT_MIGRATION) {
  throw new Error("constraint.test.ts: no supabase/migrations/*_scans_verdict.sql file found");
}
const MIGRATIONS = [
  path.join(MIGRATIONS_DIR, "00000000000001_baseline.sql"),
  path.join(MIGRATIONS_DIR, VERDICT_MIGRATION),
];

function insertScan(reportKind: "measured" | "unmeasured", score: "null" | number): { ok: boolean; message?: string } {
  const report = JSON.stringify({ verdict: { scoreAndBand: { kind: reportKind } } }).replace(/'/g, "''");
  const scoreLiteral = score === "null" ? "null" : String(score);
  try {
    psql([
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `insert into scans (domain, tier, status, score, report) values ('example.com', 'free', 'done', ${scoreLiteral}, '${report}'::jsonb);`,
    ]);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

describe(
  'REQ-004 c12, storage half — "Every number the report shows and the product stores comes from the scan …" — verdict/constraint · the scalar and the blob cannot disagree',
  () => {
    beforeAll(() => {
      resetSchema();
      for (const file of MIGRATIONS) psql(["-v", "ON_ERROR_STOP=1", "-f", file]);
    });

    afterAll(() => {
      resetSchema();
    });

    it("kind unmeasured with a non-null score is refused", () => {
      const result = insertScan("unmeasured", 50);
      expect(result.ok).toBe(false);
    });

    it("kind measured with a null score is refused", () => {
      const result = insertScan("measured", "null");
      expect(result.ok).toBe(false);
    });

    it("kind unmeasured with a null score is accepted", () => {
      const result = insertScan("unmeasured", "null");
      expect(result.ok).toBe(true);
    });

    it("kind measured with a non-null score is accepted", () => {
      const result = insertScan("measured", 50);
      expect(result.ok).toBe(true);
    });
  }
);
