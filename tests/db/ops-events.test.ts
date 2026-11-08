// `ops_events`, against a live database: service_role writes and counts it, and no customer's session reaches it.
//
// A `db`-project suite (`scripts/live-schema-tests.mjs`), run against `scripts/db-substrate/` in CI's `schema · RLS` gate.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SETTINGS_READS_SQL } from "../../scripts/daily-check/settings-reads.mjs";
import { applyEnvFixture } from "../mail/env-fixture";
import { REST_URL, SERVICE_ROLE_KEY, loopbackFetch, psql, psqlRows } from "./substrate";

const MIGRATIONS = path.resolve(import.meta.dirname, "../../supabase/migrations");
const APPLIED = ["00000000000001_baseline.sql", "00000000000002_rls.sql", "20261103150000_jobs_ops_events.sql"];

function run(sql: string): void {
  psql(["-v", "ON_ERROR_STOP=1", "-c", sql]);
}

function value(sql: string): string | undefined {
  return psqlRows(sql)[0]?.[0];
}

function resetSchema(): void {
  run("drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role;");
}

let events: typeof import("@/lib/ops/events");

beforeAll(async () => {
  applyEnvFixture();
  process.env.SUPABASE_URL = REST_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_ROLE_KEY;
  globalThis.fetch = loopbackFetch as unknown as typeof fetch;
  events = await import("@/lib/ops/events");
  resetSchema();
  for (const file of APPLIED) psql(["-v", "ON_ERROR_STOP=1", "-f", path.join(MIGRATIONS, file)]);
  run("NOTIFY pgrst, 'reload schema';");
  execFileSync("sleep", ["0.3"]); // PostgREST's schema-cache reload is async.
});

afterAll(() => {
  resetSchema();
});

describe("ops_events — the daily check's count of failed Settings reads", () => {
  it("service_role writes rows and the daily check's query counts them per read over 24 h and 7 d", () => {
    run(`set role service_role;
      insert into ops_events (kind, read, site_id, code) values
        ('settings_read_failed', 'pages', gen_random_uuid(), 'timeout'),
        ('settings_read_failed', 'pages', null, 'timeout'),
        ('settings_read_failed', 'billing', null, 'Error');
      insert into ops_events (at, kind, read, code) values
        (now() - interval '3 days', 'settings_read_failed', 'billing', 'timeout'),
        (now() - interval '8 days', 'settings_read_failed', 'billing', 'timeout');
      reset role;`);
    expect(psqlRows(SETTINGS_READS_SQL)).toEqual([
      ["pages", "2", "2"],
      ["billing", "1", "2"],
    ]);
  });

  it("refuses a code longer than 40 characters, so no message or stack is stored", () => {
    expect(() => run(`insert into ops_events (kind, read, code) values ('settings_read_failed', 'pages', repeat('x', 41));`)).toThrow();
  });

  it("no customer's session reaches it; only service_role holds a grant", () => {
    expect(value("select relrowsecurity from pg_class where relname = 'ops_events';")).toBe("t");
    expect(value("select count(*) from pg_policies where tablename = 'ops_events';")).toBe("0");
    for (const role of ["anon", "authenticated"]) {
      for (const privilege of ["select", "insert", "update", "delete"]) {
        expect(value(`select has_table_privilege('${role}', 'ops_events', '${privilege}');`)).toBe("f");
      }
    }
  });

  it("a claim holds once per site and key, whatever date it is read for, through the service client", async () => {
    const [site, other] = [psqlRows("select gen_random_uuid();")[0]![0]!, psqlRows("select gen_random_uuid();")[0]![0]!];
    const claim = (siteId: string, key: string, read: string) => events.claimOpsEvent("week_recommitted", siteId, key, read);
    expect(await claim(site, "2026-11-02", "2026-11-09")).toBe(true);
    expect(await claim(site, "2026-11-02", "2026-11-06")).toBe(false);
    expect(await claim(other, "2026-11-02", "2026-11-06")).toBe(true);
    expect(await claim(site, "2026-11-09", "2026-11-10")).toBe(true);
    expect(value(`select count(*) from ops_events where kind = 'week_recommitted' and site_id = '${site}';`)).toBe("2");
  });
});
