// tests/scan/free/admission-check.test.ts
//
// WO-057 `## Test plan` (criteria quoted verbatim from `requirements/
// REQ-003.md` and `requirements/REQ-002.md`) — the order, refusal,
// fail-open and idempotence suites for `admitFreeScan`.
//
// **Substrate note, distinct from `tests/scan/free/schema.test.ts`'s own
// (Docker unavailable on this host; native PostgreSQL substrate at
// `127.0.0.1:5432` per the owner ruling it cites): this file does *not*
// use that substrate at all.** `admitFreeScan` is exercised entirely
// against a mocked `@/lib/db` client — `dbAdmin()` is replaced with a
// fake, chainable query builder this file controls per scenario, keyed by
// which of the six steps issued the query. WO-057's own file plan carries
// no migration (only `src/lib/scan/admission.ts` and this file), so
// nothing here can depend on a live `domain_blocks` table (WO-012's own
// migration, not landed in this repo — see `src/lib/scan/admission.ts`'s
// header) or a live, regenerated `scans` type (`network_hash`, added by
// WO-056's migration, is likewise absent from the checked-in
// `types.generated.ts` — also that file's header). Flagged once here per
// constitution rule 4.2, mirroring the note this WO's own report makes.
//
// Every table this suite reads or writes through the mock is tracked by
// `writeCalls`, reset in `beforeEach` — the "no write method of the
// client was called" and "this module never writes domain_blocks"
// assertions below read that counter rather than a live table's row
// count, which is the honest equivalent this WO's scope can build without
// WO-012's migration landing first.
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  dbAdmin: vi.fn(),
}));

import { dbAdmin } from "@/lib/db";
import type { CanonicalDomain } from "../../../src/lib/scan/domain.ts";
import type { Admission, NetworkKey } from "../../../src/lib/scan/admission.ts";

const IP_HASH_SALT = "test-salt-fixture";

const ENV_FIXTURE: Record<string, string> = {
  DATABASE_URL: "postgresql://reachkit:reachkit@127.0.0.1:5432/reachkit_scratch",
  SUPABASE_URL: "http://127.0.0.1:3001",
  SUPABASE_ANON_KEY: "anon-key-fixture",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key-fixture",
  STRIPE_SECRET_KEY: "sk_test_fixture",
  STRIPE_WEBHOOK_SECRET: "whsec_fixture",
  STRIPE_PRICE_ID: "price_fixture",
  RESEND_API_KEY: "re_fixture",
  DATAFORSEO_LOGIN: "dfs-login-fixture",
  DATAFORSEO_PASSWORD: "dfs-password-fixture",
  ANTHROPIC_API_KEY: "sk-ant-fixture",
  NANO_API_KEY: "nano-fixture",
  IP_HASH_SALT,
  KILL_SWITCH: "false",
  OWNER_EMAILS: "owner@example.com",
  NEXT_PUBLIC_APP_URL: "https://app.example.com",
  HOSTED_EDGE_CNAME_TARGET: "content.example.com",
};

const DOMAIN = "example.com" as CanonicalDomain;
const OTHER_DOMAIN = "other.example.com" as CanonicalDomain;

// `admission.ts` reads `env.IP_HASH_SALT` and `env.KILL_SWITCH` at import
// time (BP-005's `env` is parsed and frozen once at module load —
// `tests/config/env.test.ts` and `tests/db/clients.test.ts` both set their
// fixture before their first import for the same reason). A static
// top-level import here would resolve before this file's own body runs
// (ES module import hoisting), so the module under test is loaded
// dynamically in `beforeAll`, after the fixture is set.
let admitFreeScan: typeof import("../../../src/lib/scan/admission.ts").admitFreeScan;
let networkKeyOf: typeof import("../../../src/lib/scan/admission.ts").networkKeyOf;
let NETWORK: NetworkKey;

beforeAll(async () => {
  for (const [key, value] of Object.entries(ENV_FIXTURE)) process.env[key] = value;
  const mod = await import("../../../src/lib/scan/admission.ts");
  admitFreeScan = mod.admitFreeScan;
  networkKeyOf = mod.networkKeyOf;
  NETWORK = networkKeyOf("203.0.113.10");
});

type Row = Record<string, unknown>;
type Step = "cooldown" | "daily" | "in_flight" | "hourly";

interface QueryLog {
  table: string;
  eq: [string, unknown][];
  gte: [string, unknown][];
}

interface ScenarioResult {
  rows?: Row[];
  throws?: boolean;
}

type TableScenario = ScenarioResult | ((log: QueryLog) => ScenarioResult);

/** Classifies which of the four `scans`-reading steps issued a query, from
 *  the `eq`/`gte` calls it made — each step's predicate shape is distinct
 *  (see `src/lib/scan/admission.ts`), so a scenario can target exactly one
 *  step without its fixture bleeding into another's read of the same
 *  table. */
function stepOf(log: QueryLog): Step | "unknown" {
  const eq = Object.fromEntries(log.eq);
  if (eq.status === "running") return "in_flight";
  if (eq.status === "failed") return "cooldown";
  if (eq.tier === "free") return "daily";
  if ("network_hash" in eq && log.gte.length > 0) return "hourly";
  return "unknown";
}

/** A `scans` scenario that returns `rows` only to the named step's own
 *  query, and no rows to any other step's query against the same table. */
function scansScenario(byStep: Partial<Record<Step, Row[]>>): TableScenario {
  return (log) => ({ rows: byStep[stepOf(log) as Step] ?? [] });
}

let scenarios: Record<string, TableScenario>;
let writeCalls: { table: string; method: string }[];

function resolveScenario(table: string, log: QueryLog): { rows: Row[]; throws: boolean } {
  const raw = scenarios[table];
  const resolved = typeof raw === "function" ? raw(log) : (raw ?? {});
  return { rows: resolved.rows ?? [], throws: resolved.throws ?? false };
}

function makeBuilder(table: string) {
  const log: QueryLog = { table, eq: [], gte: [] };
  const builder = {
    select() {
      return builder;
    },
    eq(column: string, value: unknown) {
      log.eq.push([column, value]);
      return builder;
    },
    gte(column: string, value: unknown) {
      log.gte.push([column, value]);
      return builder;
    },
    order() {
      return builder;
    },
    limit(n: number) {
      return {
        then(
          resolve: (value: { data: Row[] | null; error: { message: string } | null }) => unknown,
          reject: (reason: unknown) => unknown
        ) {
          const { rows, throws } = resolveScenario(table, log);
          if (throws) return Promise.reject(new Error(`${table}: stubbed read failure`)).catch(reject);
          return Promise.resolve({ data: rows.slice(0, n), error: null }).then(resolve);
        },
      };
    },
    insert() {
      writeCalls.push({ table, method: "insert" });
      return builder;
    },
    update() {
      writeCalls.push({ table, method: "update" });
      return builder;
    },
    upsert() {
      writeCalls.push({ table, method: "upsert" });
      return builder;
    },
    delete() {
      writeCalls.push({ table, method: "delete" });
      return builder;
    },
  };
  return builder;
}

function fakeClient() {
  return { from: (table: string) => makeBuilder(table) };
}

function installClient(dbAdminMock: typeof dbAdmin): void {
  vi.mocked(dbAdminMock).mockReturnValue(fakeClient() as unknown as ReturnType<typeof dbAdmin>);
}

beforeEach(() => {
  scenarios = {};
  writeCalls = [];
  installClient(dbAdmin);
});

afterEach(() => {
  vi.mocked(dbAdmin).mockReset();
});

function isoMinutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

/** Loads a fresh module instance of `@/lib/db` and `admission.ts` — the
 *  only way to observe a `process.env.KILL_SWITCH` change, since BP-005's
 *  `env` is parsed and frozen once at module load (`tests/config/
 *  env.test.ts` uses the same `vi.resetModules()` + dynamic-import
 *  technique for the same reason). The freshly loaded `@/lib/db` mock
 *  instance is reconfigured explicitly: `vi.resetModules()` re-runs the
 *  `vi.mock("@/lib/db", ...)` factory, producing a brand new `dbAdmin`
 *  mock disconnected from the one `beforeEach` configured. */
async function reloadAdmission() {
  vi.resetModules();
  const freshDb = await import("@/lib/db");
  installClient(freshDb.dbAdmin);
  return import("../../../src/lib/scan/admission.ts");
}

describe(
  'REQ-003 c6 — "a visitor who has already started five free scans from the same network within the last hour … refused … one written line saying how long until they may scan again"',
  () => {
    it("admission/hourly · the fifth scan admits, the sixth refuses with an elapsed duration", async () => {
      // Four existing rows: the caller's own attempt would be the fifth —
      // admits.
      scenarios.scans = scansScenario({
        hourly: [
          { created_at: isoMinutesAgo(10) },
          { created_at: isoMinutesAgo(20) },
          { created_at: isoMinutesAgo(30) },
          { created_at: isoMinutesAgo(40) },
        ],
      });
      const fifth = await admitFreeScan({ domain: DOMAIN, network: NETWORK });
      expect(fifth).toEqual({ admit: true });

      // Five existing rows: the caller's own attempt would be the sixth —
      // refuses, with a duration until the oldest (5th-newest) of the five
      // ages out of the hourly window.
      scenarios.scans = scansScenario({
        hourly: [
          { created_at: isoMinutesAgo(5) },
          { created_at: isoMinutesAgo(15) },
          { created_at: isoMinutesAgo(25) },
          { created_at: isoMinutesAgo(35) },
          { created_at: isoMinutesAgo(50) },
        ],
      });
      const sixth = await admitFreeScan({ domain: DOMAIN, network: NETWORK });
      expect(sixth).toMatchObject({ refuse: "hourly" });
      if (!("refuse" in sixth) || sixth.refuse !== "hourly") throw new Error("expected hourly refusal");
      expect(sixth.retryAfterSeconds).toBeGreaterThan(0);
      expect(sixth.retryAfterSeconds).toBeLessThan(3600);
      expect(Number.isInteger(sixth.retryAfterSeconds)).toBe(true);
      // A duration, not a timestamp: a Unix-epoch-scale value would be
      // ~1.7e9, several orders of magnitude past the hourly ceiling.
      expect(sixth.retryAfterSeconds).toBeLessThan(100_000);
    });
  }
);

describe(
  'REQ-003 c7 — "a scan is already running from the visitor\'s network … if the running scan is of the domain they asked for they are returned to it, and if it is not they are refused … never shown a scan or a report of a domain they did not ask for"',
  () => {
    it("admission/in_flight · sameDomain carries the running scan id", async () => {
      scenarios.scans = scansScenario({ in_flight: [{ id: "running-scan-id", domain: DOMAIN }] });
      const result = await admitFreeScan({ domain: DOMAIN, network: NETWORK });
      expect(result).toEqual({ refuse: "in_flight", sameDomain: true, runningScanId: "running-scan-id" });
    });

    it("admission/in_flight · a different domain refuses with sameDomain false and carries no domain or report", async () => {
      scenarios.scans = scansScenario({ in_flight: [{ id: "running-scan-id", domain: OTHER_DOMAIN }] });
      const result = await admitFreeScan({ domain: DOMAIN, network: NETWORK });
      expect(result).toEqual({ refuse: "in_flight", sameDomain: false });
      expect(result).not.toHaveProperty("domain");
      expect(result).not.toHaveProperty("report");
      expect(result).not.toHaveProperty("runningScanId");
    });
  }
);

describe(
  'REQ-003 c8 — "the day\'s free-scan ceiling has been reached, or scanning has been switched off … stating how long until it resumes when the day\'s ceiling is the cause, and promising no time when scanning has been switched off"',
  () => {
    it("admission/daily · the ceiling refuses with a duration", async () => {
      const rows = Array.from({ length: 200 }, (_, i) => ({ created_at: isoMinutesAgo(i) }));
      scenarios.scans = scansScenario({ daily: rows });
      const daily = await admitFreeScan({ domain: DOMAIN, network: NETWORK });
      expect(daily).toMatchObject({ refuse: "daily" });
      if (!("refuse" in daily) || daily.refuse !== "daily") throw new Error("expected daily refusal");
      expect(daily.retryAfterSeconds).toBeGreaterThan(0);
      expect(typeof daily.retryAfterSeconds).toBe("number");
    });

    it("admission/switched_off · the kill switch refuses without a time promised", async () => {
      process.env.KILL_SWITCH = "true";
      const mod = await reloadAdmission();
      const result = await mod.admitFreeScan({ domain: DOMAIN, network: NETWORK });
      expect(result).toEqual({ refuse: "switched_off" });
      process.env.KILL_SWITCH = "false";
    });

    it("type-level assertion: the switched_off arm has no retryAfterSeconds field to fill", () => {
      type SwitchedOff = Extract<Admission, { refuse: "switched_off" }>;
      type HasRetryAfterSeconds = "retryAfterSeconds" extends keyof SwitchedOff ? true : false;
      const assertion: HasRetryAfterSeconds = false;
      expect(assertion).toBe(false);
    });
  }
);

describe(
  'BP-023 `## Error & edge behavior` — "cooldown | latest `failed` scan of this domain | `cooldown` | `FAILURE_COOLDOWN_H` less elapsed" (implemented per WO-057 `## Steps` 3; not named by its own REQ row in this WO\'s test-plan table, tested here for completeness)',
  () => {
    it("admission/cooldown · a recent failed scan of the domain refuses with the remaining duration", async () => {
      scenarios.scans = scansScenario({ cooldown: [{ created_at: isoMinutesAgo(60) }] });
      const result = await admitFreeScan({ domain: DOMAIN, network: NETWORK });
      expect(result).toMatchObject({ refuse: "cooldown" });
      if (!("refuse" in result) || result.refuse !== "cooldown") throw new Error("expected cooldown refusal");
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
      expect(result.retryAfterSeconds).toBeLessThan(24 * 3600);
    });

    it("admission/cooldown · a failed scan outside the window does not refuse", async () => {
      scenarios.scans = scansScenario({ cooldown: [{ created_at: isoMinutesAgo(25 * 60) }] });
      const result = await admitFreeScan({ domain: DOMAIN, network: NETWORK });
      expect(result).toEqual({ admit: true });
    });
  }
);

describe(
  'REQ-003 c9 — "Given the scan limiter itself is unavailable, when a visitor starts a scan, then the scan proceeds."',
  () => {
    it.each(["cooldown", "daily", "in_flight", "hourly"] as const)(
      "admission/fail-open · a counting error at the %s step admits",
      async (target) => {
        scenarios.scans = (log) => (stepOf(log) === target ? { throws: true } : { rows: [] });
        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
        const result = await admitFreeScan({ domain: DOMAIN, network: NETWORK });
        expect(result).toEqual({ admit: true });
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      }
    );

    it("admission/fail-open · except for removal — a domain_blocks read that throws refuses removed", async () => {
      scenarios.domain_blocks = { throws: true };
      const result = await admitFreeScan({ domain: DOMAIN, network: NETWORK });
      expect(result).toEqual({ refuse: "removed" });
    });
  }
);

describe(
  'REQ-002 c3 — "Given a domain whose report has been removed … it shows the removed report to nobody and starts no scan for anyone"',
  () => {
    it(
      // This assertion is mutation-sensitive by construction, discharging
      // WO-057's own test-plan clause ("a mutation test asserts that
      // moving the removal step below any other step fails this test"):
      // a cooldown-triggering row and a full hourly allowance are both
      // simultaneously present, each of which would refuse on its own if
      // reached — `removed` must win regardless. A reordered
      // implementation that read `scans` before `domain_blocks` would
      // return `cooldown` or `hourly` here instead, failing this exact
      // assertion, without a second, reflective harness.
      "admission/removed · removal is step one and outranks everything",
      async () => {
        scenarios.domain_blocks = { rows: [{ domain: DOMAIN }] };
        scenarios.scans = scansScenario({
          cooldown: [{ created_at: isoMinutesAgo(1) }],
          hourly: [
            { created_at: isoMinutesAgo(1) },
            { created_at: isoMinutesAgo(2) },
            { created_at: isoMinutesAgo(3) },
            { created_at: isoMinutesAgo(4) },
            { created_at: isoMinutesAgo(5) },
          ],
          in_flight: [{ id: "running-id", domain: DOMAIN }],
        });
        const result = await admitFreeScan({ domain: DOMAIN, network: NETWORK });
        expect(result).toEqual({ refuse: "removed" });
      }
    );

    it("admission/removed · this module never writes domain_blocks — it no longer names the table at all", async () => {
      const source = readFileSync(
        path.resolve(import.meta.dirname, "../../../src/lib/scan/admission.ts"),
        "utf8"
      );
      const reader = readFileSync(
        path.resolve(import.meta.dirname, "../../../src/lib/scan/removal.ts"),
        "utf8"
      );
      // Source-level check, narrowed by WO-058 (constitution rule 4.2,
      // flagged in that WO's own report): WO-057's original assertion here
      // was "no write method appears anywhere in this read-only module",
      // true only because WO-057 added no writer to any table. WO-058 adds
      // this module's first writer — `claimFreeScanSlot`'s insert — which
      // targets `scans` only, never `domain_blocks`, so the check is now
      // scoped to what this test's own title claims: `"domain_blocks"` is
      // named exactly once in the file, inside `isRemoved`'s own read and
      // nowhere else, so nothing else here — including that insert — can
      // reach the table.
      //
      // #104 narrowed it further: the read moved to `src/lib/scan/removal.ts`
      // (so the report address's removal check reaches it without dragging
      // `node:crypto` into the Edge bundle), and this module now names the
      // table zero times. The promise is the same one, asserted in the
      // stronger place — nothing here can reach the table at all, and the
      // one reader that can still only selects.
      expect([...source.matchAll(/"domain_blocks"/g)]).toHaveLength(0);
      expect([...reader.matchAll(/"domain_blocks"/g)]).toHaveLength(1);
      for (const verb of [".insert(", ".update(", ".upsert(", ".delete("]) {
        expect(reader).not.toContain(verb);
      }

      // `.update(` appears exactly once in this file — `node:crypto`'s
      // `Hmac.update()` inside `hashSeed`, not a database write. Asserted
      // by name rather than excluded from the scan, so a second, real
      // `.update(` call anywhere else in the file still fails this test.
      const updateOccurrences = [...source.matchAll(/\.update\(/g)];
      expect(updateOccurrences).toHaveLength(1);
      expect(source).toMatch(/createHmac\([^)]*\)[\s\S]*?\.update\(/);

      // Watch it fail first: the same predicate flags a fixture that adds
      // a second reference to the table, proving it discriminates rather
      // than trivially passing.
      const fixtureWithSecondMention = `${reader}\nvoid dbAdmin().from("domain_blocks").insert({ domain: "x" });\n`;
      expect([...fixtureWithSecondMention.matchAll(/"domain_blocks"/g)]).toHaveLength(2);

      // Call-level check: exercise several admission scenarios and assert
      // no write method was ever invoked on the mocked domain_blocks
      // table. `domain_blocks`'s own migration is WO-012's and has not
      // landed in this repo (see this file's header) — a live row-count
      // assertion against a real table is not buildable in this WO's
      // scope, so this is the equivalent this scope can build (rule 4.2).
      scenarios.domain_blocks = { rows: [] };
      scenarios.scans = { rows: [] };
      await admitFreeScan({ domain: DOMAIN, network: NETWORK });
      await admitFreeScan({ domain: OTHER_DOMAIN, network: NETWORK });
      const domainBlocksWrites = writeCalls.filter((call) => call.table === "domain_blocks");
      expect(domainBlocksWrites).toEqual([]);
    });
  }
);

describe(
  'REQ-003 c12, first sentence — "a visitor refused under criterion 6 or 7 … the address loads, then it shows that refusal in writing and starts no scan"',
  () => {
    it("admission/idempotence · asking never consumes", async () => {
      // Four rows, at the allowed boundary: every call still admits, and
      // no write is ever issued, since admitFreeScan is a pure check.
      scenarios.scans = scansScenario({
        hourly: [
          { created_at: isoMinutesAgo(10) },
          { created_at: isoMinutesAgo(20) },
          { created_at: isoMinutesAgo(30) },
          { created_at: isoMinutesAgo(40) },
        ],
      });
      let last: Admission | undefined;
      for (let i = 0; i < 50; i++) {
        last = await admitFreeScan({ domain: DOMAIN, network: NETWORK });
      }
      expect(last).toEqual({ admit: true });
      expect(writeCalls).toEqual([]);
    });
  }
);

describe("networkKeyOf · a network key is opaque, salted and stable", () => {
  it("is deterministic and salted: the same address always yields the same key, and the key is not the raw address", () => {
    const a = networkKeyOf("203.0.113.5");
    const b = networkKeyOf("203.0.113.5");
    expect(a).toBe(b);
    expect(a).not.toContain("203.0.113.5");
    expect(a).toBe(createHmac("sha256", IP_HASH_SALT).update("203.0.113.5").digest("hex"));
  });

  it("takes only the first entry of a multi-hop x-forwarded-for header", () => {
    const first = networkKeyOf("203.0.113.5, 70.41.3.18, 150.172.238.178");
    const direct = networkKeyOf("203.0.113.5");
    expect(first).toBe(direct);
  });

  it("truncates an IPv6 address to its /64 prefix before hashing: two addresses in the same /64 collide", () => {
    const a = networkKeyOf("2001:db8:abcd:0012:0000:0000:0000:0001");
    const b = networkKeyOf("2001:db8:abcd:0012:ffff:ffff:ffff:ffff");
    const differentPrefix = networkKeyOf("2001:db8:abcd:0013:0000:0000:0000:0001");
    expect(a).toBe(b);
    expect(a).not.toBe(differentPrefix);
  });

  it("a null header yields a stable key and never throws", () => {
    expect(() => networkKeyOf(null)).not.toThrow();
    const a = networkKeyOf(null);
    const b = networkKeyOf(null);
    expect(a).toBe(b);
  });

  it("an unparseable header yields the same stable 'unknown' key as null, and never throws", () => {
    expect(() => networkKeyOf("not-an-address")).not.toThrow();
    const garbage = networkKeyOf("not-an-address");
    const nullKey = networkKeyOf(null);
    expect(garbage).toBe(nullKey);
  });
});
