// `job_days`, against a live database: `job_days_add` is one atomic increment, and no customer's session reaches
// the table or the function.
//
// A `db`-project suite (`scripts/live-schema-tests.mjs`), run against `scripts/db-substrate/` in CI's `schema · RLS` gate.
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT, DB_USER, psql, psqlRows } from "./substrate";

const MIGRATIONS = path.resolve(import.meta.dirname, "../../supabase/migrations");
const APPLIED = ["00000000000001_baseline.sql", "00000000000002_rls.sql", "20261107120000_jobs_job_days.sql"];
const SITE = "3f2b6c1e-8a4d-4e7b-9c1a-2d5e6f7a8b9c";

function run(sql: string): void {
  psql(["-v", "ON_ERROR_STOP=1", "-c", sql]);
}

function value(sql: string): string | undefined {
  return psqlRows(sql)[0]?.[0];
}

function resetSchema(): void {
  run("drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role;");
}

/** One session of its own, as service_role, adding `times` invocations to one key. */
function session(siteId: string | null, times: number): Promise<unknown> {
  const site = siteId === null ? "null" : `'${siteId}'`;
  const sql = `set role service_role; select count(public.job_days_add('draft/generate', '2026-11-07', ${site}, 3, 5)) from generate_series(1, ${times});`;
  return promisify(execFile)("psql", ["-h", DB_HOST, "-p", DB_PORT, "-U", DB_USER, "-d", DB_NAME, "-q", "-v", "ON_ERROR_STOP=1", "-c", sql], {
    env: { ...process.env, PGPASSWORD: DB_PASSWORD },
  });
}

beforeAll(() => {
  resetSchema();
  for (const file of APPLIED) psql(["-v", "ON_ERROR_STOP=1", "-f", path.join(MIGRATIONS, file)]);
});

afterAll(() => {
  resetSchema();
});

describe("job_days — one atomic increment per invocation", () => {
  it("concurrent sessions on one key give the sum, with and without a site", async () => {
    await Promise.all([session(SITE, 200), session(SITE, 200), session(null, 150), session(null, 150)]);
    expect(psqlRows("select coalesce(site_id::text, 'tick'), invocations, cpu_ms, wall_ms from job_days order by 1;")).toEqual([
      [SITE, "400", "1200", "2000"],
      ["tick", "300", "900", "1500"],
    ]);
  });

  it("no customer's session reaches the table or the add; service_role holds both", () => {
    expect(value("select relrowsecurity from pg_class where relname = 'job_days';")).toBe("t");
    expect(value("select count(*) from pg_policies where tablename = 'job_days';")).toBe("0");
    for (const role of ["anon", "authenticated"]) {
      for (const privilege of ["select", "insert", "update", "delete"]) {
        expect(value(`select has_table_privilege('${role}', 'job_days', '${privilege}');`)).toBe("f");
      }
      expect(value(`select has_function_privilege('${role}', 'job_days_add(text, date, uuid, bigint, bigint)', 'execute');`)).toBe("f");
    }
    expect(value("select has_function_privilege('service_role', 'job_days_add(text, date, uuid, bigint, bigint)', 'execute');")).toBe("t");
    expect(() => run("set role anon; select * from job_days;")).toThrow();
  });
});
