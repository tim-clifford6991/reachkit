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
const APPLIED = ["00000000000001_baseline.sql", "00000000000002_rls.sql", "00000000000004_sites_timezone_column.sql", "20261103150000_jobs_ops_events.sql", "20261127120000_jobs_box_trigger_claims.sql"];

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
let trigger: typeof import("@/lib/ops/trigger");
const SITE = "00000000-0000-4000-8000-0000000000b0";

beforeAll(async () => {
  applyEnvFixture();
  process.env.SUPABASE_URL = REST_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_ROLE_KEY;
  globalThis.fetch = loopbackFetch as unknown as typeof fetch;
  process.env.WEEKLY_RERUN_SITES = SITE;
  events = await import("@/lib/ops/events");
  trigger = await import("@/lib/ops/trigger");
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
    await events.releaseOpsEvent("week_recommitted", site, "2026-11-09");
    expect(await claim(site, "2026-11-09", "2026-11-10")).toBe(true);
    expect(value(`select count(*) from ops_events where kind = 'week_recommitted' and site_id = '${site}';`)).toBe("2");
  });
});

describe("the box trigger: its own secret, the owner's daily caps, one send per claimed key", () => {
  const sent: string[] = [];
  const call = (body: object, secret: string | undefined, authorization = "Bearer s") =>
    trigger.boxTrigger({ authorization, secret, read: async () => JSON.stringify(body), now: new Date("2026-11-10T12:00:00Z"), send: async (_job, out) => void sent.push(...out.map((e) => e.key)) });
  const claims = () => value("select count(*) from ops_events where kind = 'box_trigger';");

  it("an unset or a wrong secret answers 401, claims nothing and sends nothing", async () => {
    run(`insert into users (email, plan_status) values ('owner@example.com', 'active');
      insert into sites (id, user_id, domain, timezone) select '${SITE}', id, 'reachkit.app', 'UTC' from users;`);
    expect((await call({ kind: "test" }, undefined)).status).toBe(401);
    expect((await call({ kind: "test" }, "s", "Bearer t")).status).toBe(401);
    expect([claims(), sent.length]).toEqual(["0", 0]);
  });

  it("with one re-run claimed, two concurrent calls send one more and the next answers 429", async () => {
    const first = await call({ kind: "rerun" }, "s");
    const pair = await Promise.all([call({ kind: "rerun" }, "s"), call({ kind: "rerun" }, "s")]);
    expect([first.status, pair.filter((answer) => answer.status === 202).length, sent.length, new Set(sent).size]).toEqual([202, 1, 2, 2]);
    expect(await call({ kind: "rerun" }, "s")).toMatchObject({ status: 429, body: { kind: "rerun", count: 2, cap: 2 } });
    expect(sent).toHaveLength(2);
  });

  it("the fifth test write answers 429; a repeat of a held claim is refused, so its key is sent once", async () => {
    for (let i = 0; i < 4; i++) expect((await call({ kind: "test", date: "2026-11-12" }, "s")).status).toBe(202);
    expect(await call({ kind: "test", date: "2026-11-12" }, "s")).toMatchObject({ status: 429, body: { kind: "test", count: 4, cap: 4 } });
    expect(value(`set role service_role; select box_trigger_claim('${SITE}', 'test:2026-11-12:1', '{}', '2026-11-11T12:00:00Z', 4);`)).toBe("held");
    expect(sent.filter((key) => key === `draft:${SITE}:2026-11-12:test:1`)).toHaveLength(1);
  });
});
