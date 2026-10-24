// Issue 1958 — `job_error_mails`, against a live database.
//
// The runner's claim is `insert … on conflict do nothing returning`: one
// (job, error class, day) returns a row once, a release lets the next tick
// claim it again, and no customer's session reaches the table.
//
// A `db`-project suite (`vitest.config.ts`'s `LIVE_SCHEMA_TESTS`), run
// against `scripts/db-substrate/` in CI's `schema · RLS` gate.
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { psql, psqlRows } from "../db/substrate";

const MIGRATIONS = path.resolve(import.meta.dirname, "../../supabase/migrations");
const APPLIED = ["00000000000001_baseline.sql", "00000000000002_rls.sql", "20261024150000_jobs_error_mails.sql"];

function run(sql: string): void {
  psql(["-v", "ON_ERROR_STOP=1", "-c", sql]);
}

function value(sql: string): string | undefined {
  return psqlRows(sql)[0]?.[0];
}

function resetSchema(): void {
  run("drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role;");
}

/** The store's claim, as PostgREST's ignore-duplicates upsert sends it. */
function claim(jobId: string, errorName: string, day: string): boolean {
  return (
    value(
      `with claimed as (insert into job_error_mails (job_id, error_name, day) values ('${jobId}', '${errorName}', '${day}') on conflict do nothing returning 1) select count(*) from claimed;`
    ) === "1"
  );
}

beforeAll(() => {
  resetSchema();
  for (const file of APPLIED) psql(["-v", "ON_ERROR_STOP=1", "-f", path.join(MIGRATIONS, file)]);
});

afterAll(() => {
  resetSchema();
});

describe("job_error_mails — one owner mail per job, error class and Berlin day", () => {
  it("a key is claimed once, another class or day is its own, and a release frees it", () => {
    expect(claim("draft/generate", "TypeError", "2026-10-19")).toBe(true);
    expect(claim("draft/generate", "TypeError", "2026-10-19")).toBe(false);
    expect(claim("draft/generate", "TimeoutError", "2026-10-19")).toBe(true);
    expect(claim("draft/generate", "TypeError", "2026-10-20")).toBe(true);
    run("delete from job_error_mails where job_id = 'draft/generate' and error_name = 'TypeError' and day = '2026-10-19';");
    expect(claim("draft/generate", "TypeError", "2026-10-19")).toBe(true);
    expect(value("select count(*) from job_error_mails where mailed_at is null;")).toBe("0");
  });

  it("no customer's session reaches it; only service_role holds a grant", () => {
    expect(value("select relrowsecurity from pg_class where relname = 'job_error_mails';")).toBe("t");
    expect(value("select count(*) from pg_policies where tablename = 'job_error_mails';")).toBe("0");
    for (const role of ["anon", "authenticated"]) {
      for (const privilege of ["select", "insert", "update", "delete"]) {
        expect(value(`select has_table_privilege('${role}', 'job_error_mails', '${privilege}');`)).toBe("f");
      }
    }
    for (const privilege of ["select", "insert", "delete"]) {
      expect(value(`select has_table_privilege('service_role', 'job_error_mails', '${privilege}');`)).toBe("t");
    }
  });
});
