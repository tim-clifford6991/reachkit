// tests/scan/free/admission-claim.test.ts
//
// WO-058 `## Test plan` (criteria quoted verbatim from `requirements/
// REQ-003.md` and `requirements/REQ-001.md`) — the transaction, refusal,
// once-only, fail-open and rescan-flag suites for `claimFreeScanSlot`.
//
// **Two substrates in one file, deliberately:** every suite except the
// concurrency one exercises `claimFreeScanSlot` against a mocked `@/lib/db`
// client, exactly as `tests/scan/free/admission-check.test.ts` does for
// `admitFreeScan` — the harness below (`makeBuilder`, `scenarios`,
// `writeCalls`, `reloadAdmission`) is that file's own, extended with
// `insert`/`select`/`single` support for the write path WO-058 adds. The
// concurrency suite (REQ-003 c7) is different in kind: it asks whether two
// *real*, separately-scheduled claims can both win, which a single-threaded
// mock answering synchronously cannot discriminate from a correct
// implementation — a hand-written mock that always lets only the first
// caller "win" would pass whether or not `claimFreeScanSlot` enforces
// anything at all. That suite runs against the native scratch substrate
// (`tests/db/rls.test.ts`'s own mechanism: real PostgreSQL 18 + PostgREST
// 16.2 at `127.0.0.1:3001`, real `@supabase/supabase-js`), with the file's
// one `vi.mock('@/lib/db', ...)` temporarily pointed at the real `dbAdmin`
// rather than the fake client, so `idx_scans_one_running_per_network`
// (`supabase/migrations/00000000000006_scans_freepath_claim.sql`) is the
// thing actually adjudicating the race, not a mock's own bookkeeping.
//
// **Concurrency mechanism, and a deviation from `tests/db/rls.test.ts`'s
// own `loopbackFetch` flagged once here (constitution rule 4.2):**
// `tests/setup.ts` refuses the real `fetch`/`http`/`https` globals
// process-wide, so `rls.test.ts` replaces `globalThis.fetch` with a
// `curl`-spawning function built on `child_process.execFileSync` — fully
// synchronous, which serialises every request the client issues and would
// make two "concurrent" claims run one after the other from Postgres's own
// point of view, defeating the one suite that needs them to actually
// overlap. This file's own `loopbackFetch` is the same technique —
// loopback-only, `curl`-based — built on `child_process.execFile` (async)
// instead, so `Promise.all`-issued claims genuinely race over the network
// rather than blocking the event loop in turn.
//
// `structure.md` rule 4: tests live beside the module they exercise —
// `tests/scan/free/**` is BP-023's.
import { execFile, execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ dbAdmin: vi.fn() }));

import { dbAdmin } from "@/lib/db";
import type { CanonicalDomain } from "../../../src/lib/scan/domain.ts";
import type { Admission, NetworkKey } from "../../../src/lib/scan/admission.ts";

const IP_HASH_SALT = "test-salt-fixture";

// ── Live-substrate connection facts (REQ-003 c7's concurrency suite only;
// every other suite below never lets these values reach a socket) ────────
const DB_HOST = "127.0.0.1";
const DB_PORT = "5432";
const DB_USER = "reachkit";
const DB_PASSWORD = "reachkit";
const DB_NAME = process.env.REACHKIT_DB_NAME ?? "reachkit_scratch";
const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:3001";
const JWT_SECRET = "reachkit-scratch-jwt-secret-at-least-32-chars-long";
const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const CLAIM_MIGRATIONS = [
  path.join(REPO_ROOT, "supabase/migrations/00000000000001_baseline.sql"),
  path.join(REPO_ROOT, "supabase/migrations/00000000000005_scans_freepath.sql"),
  path.join(REPO_ROOT, "supabase/migrations/00000000000006_scans_freepath_claim.sql"),
];

function base64url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function signJwt(claims: Record<string, unknown>): string {
  const header = base64url(Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = base64url(Buffer.from(JSON.stringify(claims)));
  const signingInput = `${header}.${payload}`;
  const signature = base64url(createHmac("sha256", JWT_SECRET).update(signingInput).digest());
  return `${signingInput}.${signature}`;
}
const SERVICE_ROLE_KEY = signJwt({
  role: "service_role",
  iss: "supabase",
  exp: Math.floor(Date.now() / 1000) + 3600,
});

const ENV_FIXTURE: Record<string, string> = {
  DATABASE_URL: `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`,
  SUPABASE_URL,
  SUPABASE_ANON_KEY: "anon-key-fixture",
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
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

let claimFreeScanSlot: typeof import("../../../src/lib/scan/admission.ts").claimFreeScanSlot;
let networkKeyOf: typeof import("../../../src/lib/scan/admission.ts").networkKeyOf;
let actualDbAdmin: typeof import("../../../src/lib/db/index").dbAdmin;
let NETWORK: NetworkKey;

beforeAll(async () => {
  for (const [key, value] of Object.entries(ENV_FIXTURE)) process.env[key] = value;
  const realDb = await vi.importActual<typeof import("../../../src/lib/db/index")>(
    "../../../src/lib/db/index"
  );
  actualDbAdmin = realDb.dbAdmin;
  const mod = await import("../../../src/lib/scan/admission.ts");
  claimFreeScanSlot = mod.claimFreeScanSlot;
  networkKeyOf = mod.networkKeyOf;
  NETWORK = networkKeyOf("203.0.113.10");
});

// ── The mocked-client harness (admission-check.test.ts's own, extended
// with insert/select/single for claimFreeScanSlot's write path) ──────────

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

function stepOf(log: QueryLog): Step | "unknown" {
  const eq = Object.fromEntries(log.eq);
  if (eq.status === "running") return "in_flight";
  if (eq.status === "failed") return "cooldown";
  if (eq.tier === "free") return "daily";
  if ("network_hash" in eq && log.gte.length > 0) return "hourly";
  return "unknown";
}

function scansScenario(byStep: Partial<Record<Step, Row[]>>): TableScenario {
  return (log) => ({ rows: byStep[stepOf(log) as Step] ?? [] });
}

let scenarios: Record<string, TableScenario>;
let writeCalls: { table: string; method: string }[];
let insertedRows: Row[];
/** Configures whether the next `scans` insert this mock sees succeeds or
 *  loses the race — `claimFreeScanSlot`'s own conflict path
 *  (`idx_scans_one_running_per_network`, mocked here rather than hit for
 *  real; the real index is exercised by the concurrency suite below). */
let insertOutcome: "succeed" | "conflict";

function resolveScenario(table: string, log: QueryLog): { rows: Row[]; throws: boolean } {
  const raw = scenarios[table];
  const resolved = typeof raw === "function" ? raw(log) : (raw ?? {});
  return { rows: resolved.rows ?? [], throws: resolved.throws ?? false };
}

function makeBuilder(table: string) {
  const log: QueryLog = { table, eq: [], gte: [] };
  let pendingInsertRow: Row | null = null;
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
    insert(row: Row) {
      writeCalls.push({ table, method: "insert" });
      pendingInsertRow = row;
      insertedRows.push(row);
      return builder;
    },
    single() {
      return {
        then(
          resolve: (value: {
            data: Row | null;
            error: { message: string; code?: string } | null;
          }) => unknown
        ) {
          if (insertOutcome === "conflict") {
            return Promise.resolve({
              data: null,
              error: { message: "duplicate key value violates unique constraint", code: "23505" },
            }).then(resolve);
          }
          return Promise.resolve({ data: { id: "claimed-scan-id", ...pendingInsertRow }, error: null }).then(
            resolve
          );
        },
      };
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

/** Mirrors `admission-check.test.ts`'s own `reloadAdmission()`: the only
 *  way to observe a `process.env.KILL_SWITCH` change, since BP-005's `env`
 *  is parsed and frozen once at module load. */
async function reloadAdmission() {
  vi.resetModules();
  const freshDb = await import("@/lib/db");
  installClient(freshDb.dbAdmin);
  return import("../../../src/lib/scan/admission.ts");
}

function isoMinutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

beforeEach(() => {
  scenarios = {};
  writeCalls = [];
  insertedRows = [];
  insertOutcome = "succeed";
  installClient(dbAdmin);
});

afterEach(() => {
  vi.mocked(dbAdmin).mockReset();
});

function scansInserts(): { table: string; method: string }[] {
  return writeCalls.filter((c) => c.table === "scans" && c.method === "insert");
}

// ── REQ-003 c7 — the transaction and concurrency suites ──────────────────

describe(
  'REQ-003 c7 — "Given a scan is already running from the visitor\'s network, when another scan would start for them, then no second scan starts; if the running scan is of the domain they asked for they are returned to it, and if it is not they are refused in writing, told how long until they may scan, and are never shown a scan or a report of a domain they did not ask for."',
  () => {
    it("admission/claim · a lost race (the database's own conflict) is reported as an in_flight refusal, sameDomain from a re-read", async () => {
      insertOutcome = "conflict";
      // The re-read `checkInFlight` performs after the conflict.
      scenarios.scans = scansScenario({ in_flight: [{ id: "winner-scan-id", domain: DOMAIN }] });
      const result = await claimFreeScanSlot({
        domain: DOMAIN,
        network: NETWORK,
        fromIncompleteRescan: false,
      });
      expect(result).toEqual({
        claimed: false,
        refusal: { refuse: "in_flight", sameDomain: true, runningScanId: "winner-scan-id" },
      });
    });

    it("admission/claim · a winning claim returns the inserted row's id", async () => {
      const result = await claimFreeScanSlot({ domain: DOMAIN, network: NETWORK, fromIncompleteRescan: false });
      expect(result).toEqual({ claimed: true, scanId: "claimed-scan-id" });
      expect(scansInserts()).toHaveLength(1);
    });
  }
);

describe("REQ-003 c7 — two simultaneous claims resolve to one scan (live substrate, real concurrency)", () => {
  function psql(args: string[]): string {
    return execFileSync("psql", ["-h", DB_HOST, "-p", DB_PORT, "-U", DB_USER, "-d", DB_NAME, "-q", ...args], {
      env: { ...process.env, PGPASSWORD: DB_PASSWORD },
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
  }

  function psqlRows(sql: string): string[][] {
    return psql(["-v", "ON_ERROR_STOP=1", "-Atc", sql])
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => line.split("|"));
  }

  function resetSchema(): void {
    psql([
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      "drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role;",
    ]);
  }

  function resetAndApplySchema(): void {
    resetSchema();
    for (const file of CLAIM_MIGRATIONS) psql(["-v", "ON_ERROR_STOP=1", "-f", file]);
    // `domain_blocks` (BP-002's table) has no migration in this repo yet —
    // WO-012, not in wave W2 (see `src/lib/scan/admission.ts`'s own header
    // gap 1). `isRemoved` fails closed to `removed` when that table is
    // missing, which would make every claim below refuse before ever
    // reaching the in-flight/insert path this suite exists to exercise.
    // This is a minimal, test-only stand-in table — not a migration, not
    // shipped — so the concurrency suite can reach that path; flagged once
    // here per constitution rule 4.2, mirroring `admission-check.test.ts`'s
    // own note on the same gap.
    psql([
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      "create table domain_blocks (domain text primary key); grant select, insert, update, delete on domain_blocks to anon, authenticated, service_role;",
    ]);
    psql(["-c", "NOTIFY pgrst, 'reload schema';"]);
    execFileSync("sleep", ["0.3"]); // PostgREST's schema-cache reload is async.
  }

  const execFileAsync = promisify(execFile);

  /** Loopback-only, `curl`-based `fetch` — see this file's own header for
   *  why it is async (`execFile`, not `execFileSync`): genuine concurrency
   *  for the one suite that needs two claims to actually overlap. */
  async function loopbackFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
    if (!/^https?:\/\/127\.0\.0\.1(:\d+)?\//.test(url)) {
      throw new Error(`loopbackFetch refuses non-loopback URL: ${url}`);
    }
    const method = init.method ?? "GET";
    const headerEntries: [string, string][] = [];
    if (init.headers) {
      new Headers(init.headers as HeadersInit).forEach((value, key) => headerEntries.push([key, value]));
    }
    const bodyText = typeof init.body === "string" ? init.body : init.body ? String(init.body) : undefined;

    const args = ["-s", "-i", "-X", method];
    for (const [key, value] of headerEntries) args.push("-H", `${key}: ${value}`);
    if (bodyText !== undefined) args.push("--data-binary", bodyText);
    args.push(url);

    const { stdout } = await execFileAsync("curl", args, { encoding: "buffer", maxBuffer: 10 * 1024 * 1024 });
    const raw = stdout as unknown as Buffer;
    const separator = Buffer.from("\r\n\r\n");
    const separatorIndex = raw.indexOf(separator);
    const headerPart = raw.subarray(0, separatorIndex).toString("utf8");
    const bodyPart = raw.subarray(separatorIndex + separator.length);
    const headerLines = headerPart.split("\r\n");
    const status = Number((headerLines[0] ?? "").split(" ")[1] ?? "599");
    const responseHeaders = new Headers();
    for (const line of headerLines.slice(1)) {
      const idx = line.indexOf(":");
      if (idx === -1) continue;
      responseHeaders.append(line.slice(0, idx).trim(), line.slice(idx + 1).trim());
    }
    // Cast boundary: `Buffer` (from `child_process.execFile`'s buffer
    // encoding) structurally satisfies `BodyInit`'s `ArrayBufferView` arm at
    // runtime; the two `Buffer` global declarations this project's Node and
    // DOM lib types carry do not always unify at the type level.
    return new Response(bodyPart as unknown as BodyInit, { status, headers: responseHeaders });
  }

  let liveClaimFreeScanSlot: typeof import("../../../src/lib/scan/admission.ts").claimFreeScanSlot;
  let liveNetworkKeyOf: typeof import("../../../src/lib/scan/admission.ts").networkKeyOf;

  beforeAll(async () => {
    globalThis.fetch = loopbackFetch as unknown as typeof fetch;
    resetAndApplySchema();
    liveClaimFreeScanSlot = claimFreeScanSlot;
    liveNetworkKeyOf = networkKeyOf;
  });

  // The file's own top-level `beforeEach` (`installClient(dbAdmin)`) runs
  // before every test, including these — outer hooks run before inner ones
  // — so it would otherwise put the fake client back in front of every
  // test here. This inner `beforeEach` runs after it and re-points
  // `dbAdmin` at the real client for the duration of each test in this
  // describe only; the file's own `afterEach` (`mockReset()`) clears it
  // again afterwards, so no other suite is affected.
  beforeEach(() => {
    vi.mocked(dbAdmin).mockImplementation(actualDbAdmin);
  });

  afterAll(() => {
    resetSchema();
    installClient(dbAdmin);
  });

  it.each([2, 20])(
    "admission/claim · %i simultaneous claims for one network resolve to exactly one scan",
    async (n) => {
      const network = liveNetworkKeyOf(`203.0.113.${90 + n}`);
      const domain = `concurrency-${n}.example.com` as CanonicalDomain;

      const results = await Promise.all(
        Array.from({ length: n }, () =>
          liveClaimFreeScanSlot({ domain, network, fromIncompleteRescan: false })
        )
      );

      const claimed = results.filter((r) => r.claimed);
      const refused = results.filter(
        (r): r is { claimed: false; refusal: Admission } => !r.claimed
      );
      expect(claimed).toHaveLength(1);
      expect(refused).toHaveLength(n - 1);
      for (const r of refused) {
        expect(r.refusal).toMatchObject({ refuse: "in_flight", sameDomain: true });
      }

      const rows = psqlRows(
        `select count(*) from scans where network_hash = '${network}' and status = 'running';`
      );
      expect(rows[0]?.[0]).toBe("1");
    },
    30_000
  );
});

// ── REQ-003 c6 — a refused claim writes nothing ───────────────────────────

describe(
  'REQ-003 c6 — "… when another scan would start for them, then it does not start, they are refused with one written line saying how long until they may scan again, and the refused scan, having never run, produces no report of its own."',
  () => {
    const FIVE_HOURLY_ROWS: Row[] = [
      { created_at: isoMinutesAgo(5) },
      { created_at: isoMinutesAgo(15) },
      { created_at: isoMinutesAgo(25) },
      { created_at: isoMinutesAgo(35) },
      { created_at: isoMinutesAgo(45) },
    ];
    const TWO_HUNDRED_DAILY_ROWS: Row[] = Array.from({ length: 200 }, (_, i) => ({
      created_at: isoMinutesAgo(i),
    }));

    const REFUSAL_SETUPS: Record<string, () => void> = {
      removed: () => {
        scenarios.domain_blocks = { rows: [{ domain: DOMAIN }] };
      },
      cooldown: () => {
        scenarios.scans = scansScenario({ cooldown: [{ created_at: isoMinutesAgo(60) }] });
      },
      daily: () => {
        scenarios.scans = scansScenario({ daily: TWO_HUNDRED_DAILY_ROWS });
      },
      in_flight: () => {
        scenarios.scans = scansScenario({ in_flight: [{ id: "running-id", domain: OTHER_DOMAIN }] });
      },
      hourly: () => {
        scenarios.scans = scansScenario({ hourly: FIVE_HOURLY_ROWS });
      },
    };

    it.each(Object.keys(REFUSAL_SETUPS))("admission/claim · a %s refusal writes no scans row", async (reason) => {
      REFUSAL_SETUPS[reason]?.();
      const before = scansInserts().length;
      const result = await claimFreeScanSlot({ domain: DOMAIN, network: NETWORK, fromIncompleteRescan: false });
      expect(result.claimed).toBe(false);
      if (!result.claimed) expect(result.refusal).toMatchObject({ refuse: reason });
      expect(scansInserts()).toHaveLength(before);
      expect(scansInserts()).toEqual([]);
    });

    it("admission/claim · a switched_off refusal writes no scans row", async () => {
      process.env.KILL_SWITCH = "true";
      const mod = await reloadAdmission();
      const result = await mod.claimFreeScanSlot({
        domain: DOMAIN,
        network: NETWORK,
        fromIncompleteRescan: false,
      });
      expect(result).toEqual({ claimed: false, refusal: { refuse: "switched_off" } });
      expect(scansInserts()).toEqual([]);
      process.env.KILL_SWITCH = "false";
    });
  }
);

// ── REQ-001 c14 — from_incomplete_rescan, set at claim time and only there ─

describe(
  'REQ-001 c14 — "That offer is made once and does not chain: a report that is itself the product of a re-scan started from it carries the same written line and no re-scan control, and stays readable at its address, until its age earns a control under criterion 15. A re-scan that produced no report at all leaves the offer standing (criteria 16 and 17)."',
  () => {
    it("admission/claim · a claim with fromIncompleteRescan: true stores true on the new row", async () => {
      const result = await claimFreeScanSlot({ domain: DOMAIN, network: NETWORK, fromIncompleteRescan: true });
      expect(result.claimed).toBe(true);
      expect(insertedRows).toHaveLength(1);
      expect(insertedRows[0]).toMatchObject({ from_incomplete_rescan: true });
    });

    it("admission/claim · a claim with fromIncompleteRescan: false stores false on the new row", async () => {
      const result = await claimFreeScanSlot({ domain: DOMAIN, network: NETWORK, fromIncompleteRescan: false });
      expect(result.claimed).toBe(true);
      expect(insertedRows).toHaveLength(1);
      expect(insertedRows[0]).toMatchObject({ from_incomplete_rescan: false });
    });

    it("admission/claim · from_incomplete_rescan is written in exactly one statement in admission.ts, and nowhere else in src/", () => {
      const admissionPath = path.resolve(import.meta.dirname, "../../../src/lib/scan/admission.ts");
      const source = readFileSync(admissionPath, "utf8");

      // The one write: the literal assignment inside claimFreeScanSlot's
      // insert. Asserted by pattern, so a second real write anywhere in
      // this same file still fails this test (watch it fail first below).
      const writes = [...source.matchAll(/from_incomplete_rescan:\s*a\.fromIncompleteRescan/g)];
      expect(writes).toHaveLength(1);

      const fixtureWithSecondWrite = `${source}\nvoid { from_incomplete_rescan: a.fromIncompleteRescan };\n`;
      expect([...fixtureWithSecondWrite.matchAll(/from_incomplete_rescan:\s*a\.fromIncompleteRescan/g)]).toHaveLength(
        2
      );

      const SRC_DIR = path.resolve(import.meta.dirname, "../../../src");
      function* walk(dir: string): Generator<string> {
        for (const entry of readdirSync(dir)) {
          const full = path.join(dir, entry);
          const stat = statSync(full);
          if (stat.isDirectory()) yield* walk(full);
          else if (/\.tsx?$/.test(entry)) yield full;
        }
      }
      const offenders = [...walk(SRC_DIR)]
        .filter((file) => file !== admissionPath)
        .filter((file) => /from_incomplete_rescan\s*:/.test(readFileSync(file, "utf8")));
      expect(offenders).toEqual([]);
    });
  }
);

// ── REQ-003 c9 — the limiter fails open; removal never does ──────────────

describe(
  'REQ-003 c9 — "Given the scan limiter itself is unavailable, when a visitor starts a scan, then the scan proceeds."',
  () => {
    it.each(["cooldown", "daily", "in_flight", "hourly"] as const)(
      "admission/claim · a counting error at the %s step still claims",
      async (target) => {
        scenarios.scans = (log) => (stepOf(log) === target ? { throws: true } : { rows: [] });
        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
        const result = await claimFreeScanSlot({ domain: DOMAIN, network: NETWORK, fromIncompleteRescan: false });
        expect(result.claimed).toBe(true);
        expect(scansInserts()).toHaveLength(1);
        consoleSpy.mockRestore();
      }
    );

    it("admission/claim · a domain_blocks read that throws refuses removed and inserts no row", async () => {
      scenarios.domain_blocks = { throws: true };
      const result = await claimFreeScanSlot({ domain: DOMAIN, network: NETWORK, fromIncompleteRescan: false });
      expect(result).toEqual({ claimed: false, refusal: { refuse: "removed" } });
      expect(scansInserts()).toEqual([]);
    });
  }
);

// ── REQ-003 c12 — the limit passing re-opens the claim; removal never does ─

describe(
  'REQ-003 c12, first sentence — "… once the limit has passed the same address starts a scan for them, unless that domain\'s report was removed at its owner\'s request (REQ-002 criterion 3), when it never does …"',
  () => {
    // This file's mock answers a query with a fixed row set regardless of
    // the `gte(...)` value the code under test actually passed — the real
    // filtering by elapsed time is the database's job, not this fixture's
    // (`admission-check.test.ts`'s own hourly suite uses the same
    // convention: the "clock advancing" is expressed as fewer rows still
    // being inside the window, not as a literal system-clock change, since
    // changing `Date.now()` here would not change what this mock returns).
    const FIVE_ROWS_INSIDE_WINDOW: Row[] = [
      { created_at: isoMinutesAgo(5) },
      { created_at: isoMinutesAgo(15) },
      { created_at: isoMinutesAgo(25) },
      { created_at: isoMinutesAgo(35) },
      { created_at: isoMinutesAgo(45) },
    ];
    // The limit passing: one of the network's five scans has aged out of
    // the window, leaving four — under `FREE_BOUNDS.scansPerIpPerHour`.
    const FOUR_ROWS_INSIDE_WINDOW: Row[] = [
      { created_at: isoMinutesAgo(15) },
      { created_at: isoMinutesAgo(25) },
      { created_at: isoMinutesAgo(35) },
      { created_at: isoMinutesAgo(45) },
    ];

    it("admission/claim · the hourly limit passing lets a previously refused network claim", async () => {
      scenarios.scans = scansScenario({ hourly: FIVE_ROWS_INSIDE_WINDOW });
      const refused = await claimFreeScanSlot({ domain: DOMAIN, network: NETWORK, fromIncompleteRescan: false });
      expect(refused).toEqual({ claimed: false, refusal: expect.objectContaining({ refuse: "hourly" }) });

      scenarios.scans = scansScenario({ hourly: FOUR_ROWS_INSIDE_WINDOW });
      const claimed = await claimFreeScanSlot({ domain: DOMAIN, network: NETWORK, fromIncompleteRescan: false });
      expect(claimed.claimed).toBe(true);
    });

    it("admission/claim · a removed domain refuses regardless of the hourly window's own state, before and after the limit passes", async () => {
      scenarios.domain_blocks = { rows: [{ domain: DOMAIN }] };

      scenarios.scans = scansScenario({ hourly: FIVE_ROWS_INSIDE_WINDOW });
      const before = await claimFreeScanSlot({ domain: DOMAIN, network: NETWORK, fromIncompleteRescan: false });
      expect(before).toEqual({ claimed: false, refusal: { refuse: "removed" } });

      scenarios.scans = scansScenario({ hourly: FOUR_ROWS_INSIDE_WINDOW });
      const after = await claimFreeScanSlot({ domain: DOMAIN, network: NETWORK, fromIncompleteRescan: false });
      expect(after).toEqual({ claimed: false, refusal: { refuse: "removed" } });
    });
  }
);
