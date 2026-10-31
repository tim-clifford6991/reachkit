// `rate_limits` and `take_rate_limits`, against a live database: the count every instance shares, its windows,
// its sweep, and that no session reaches either. A `db`-project suite (`LIVE_SCHEMA_TESTS`).
import { execFileSync } from "node:child_process";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyEnvFixture } from "../mail/env-fixture";
import { REST_URL, SERVICE_ROLE_KEY, loopbackFetch, psql, psqlRows } from "./substrate";

const MIGRATIONS = path.resolve(import.meta.dirname, "../../supabase/migrations");
const APPLIED = ["00000000000001_baseline.sql", "00000000000002_rls.sql", "20261031170000_rate_limits.sql"];
const SIGNATURE = "take_rate_limits(text[], text[], integer[], integer[])";

let limits: typeof import("@/lib/limits");
let admission: typeof import("@/lib/scan/admission");

function run(sql: string): void {
  psql(["-v", "ON_ERROR_STOP=1", "-c", sql]);
}

function value(sql: string): string | undefined {
  return psqlRows(sql)[0]?.[0];
}

function resetSchema(): void {
  run("drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role;");
}

/** One take from its own `psql` process, so its own connection, as a second instance would make it. */
function takeElsewhere(scope: string, key: string): string | undefined {
  return value(`select take_rate_limits(array['${scope}'], array['${key}'], array[3600], array[30]);`);
}

beforeAll(async () => {
  applyEnvFixture();
  process.env.SUPABASE_URL = REST_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_ROLE_KEY;
  globalThis.fetch = loopbackFetch as unknown as typeof fetch;
  limits = await import("@/lib/limits");
  admission = await import("@/lib/scan/admission");
  resetSchema();
  // Production's default privileges grant every new table to these roles, so the migration's revoke is what is proven.
  run("alter default privileges in schema public grant all on tables to anon, authenticated, service_role;");
  for (const file of APPLIED) psql(["-v", "ON_ERROR_STOP=1", "-f", path.join(MIGRATIONS, file)]);
  run("NOTIFY pgrst, 'reload schema';");
  execFileSync("sleep", ["0.3"]); // PostgREST's schema-cache reload is async.
});

beforeEach(() => run("truncate rate_limits;"));

afterAll(() => {
  resetSchema();
  run("alter default privileges in schema public revoke all on tables from anon, authenticated, service_role;");
});

describe("rate_limits — one count every instance shares", () => {
  const headers = new Headers({ "x-forwarded-for": "203.0.113.7" });

  it("limit holds across connections", async () => {
    const network = admission.networkKeyOf(headers);
    for (let i = 0; i < 15; i++) expect(await limits.takeLimits("tool_check", { network })).toBe(true);
    const [scope = "", key = ""] = psqlRows("select scope, key from rate_limits;")[0] ?? [];
    for (let i = 0; i < 15; i++) expect(takeElsewhere(scope, key)).toBe("t");
    expect(await limits.takeLimits("tool_check", { network })).toBe(false);
    expect(value("select hits from rate_limits;")).toBe("31");
  });

  it("window rolls over", async () => {
    const network = admission.networkKeyOf(headers);
    for (let i = 0; i < 31; i++) await limits.takeLimits("tool_check", { network });
    run("update rate_limits set window_start = window_start - interval '1 hour';");
    expect(await limits.takeLimits("tool_check", { network })).toBe(true);
    expect(psqlRows("select hits from rate_limits order by window_start;")).toEqual([["31"], ["1"]]);
  });

  it("keys are hashes", async () => {
    const scanId = "5b0c7e0e-8d2f-4d7a-9f53-0c2b8c1f6a11";
    const network = admission.networkKeyOf(headers);
    await limits.takeLimits("lead", { network, email: "Owner@Example.com", scanId });
    await limits.takeLimits("sign_in", { network, email: "owner@example.com" });
    const keys = psqlRows("select key from rate_limits;").map(([k]) => k ?? "");
    expect(keys).toHaveLength(6);
    for (const k of keys) expect(k).toMatch(/^[0-9a-f]{64}$/);
    expect(keys).not.toContain(network);
    expect(() => run("insert into rate_limits (scope, key, window_start) values ('lead.email.86400', 'owner@example.com', now());")).toThrow();
  });

  it("old windows are swept", () => {
    const old = "b".repeat(64);
    run(`insert into rate_limits (scope, key, window_start, hits) values ('tool_check.network.3600', '${old}', now() - interval '3 days', 9);`);
    // Two thousand takes make the one-in-a-hundred sweep all but certain (a miss is about 2e-9).
    run(`do $$ begin for i in 1 .. 2000 loop perform take_rate_limits(array['x'], array['${"c".repeat(64)}'], array[3600], array[1000000]); end loop; end $$;`);
    expect(value(`select count(*) from rate_limits where key = '${old}';`)).toBe("0");
    expect(value("select count(*) from rate_limits;")).toBe("1");
  });

  it("anon and authenticated are denied", () => {
    expect(value("select relrowsecurity from pg_class where relname = 'rate_limits';")).toBe("t");
    expect(value("select count(*) from pg_policies where tablename = 'rate_limits';")).toBe("0");
    for (const role of ["anon", "authenticated"]) {
      for (const privilege of ["select", "insert", "update", "delete", "truncate", "references", "trigger"]) {
        expect(value(`select has_table_privilege('${role}', 'rate_limits', '${privilege}');`)).toBe("f");
      }
      expect(value(`select has_function_privilege('${role}', '${SIGNATURE}', 'execute');`)).toBe("f");
    }
    expect(value(`select has_function_privilege('service_role', '${SIGNATURE}', 'execute');`)).toBe("t");
  });
});
