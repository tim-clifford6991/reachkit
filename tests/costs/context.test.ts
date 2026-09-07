// tests/costs/context.test.ts
//
// WO-276 `## Test plan` — the rows carried verbatim from WO-022
// (`withCostContext()`, `recordFetch`, `capHit`, `spentCents`, `degraded`
// — `src/lib/costs/index.ts`, `cache.ts`, `ledger.ts`), asserted against a
// live, migrated scratch database (`structure.md` rule 4: `tests/costs/**`
// is BP-007's).
//
// **Substrate note (owner ruling, 2026-09-03; Docker unavailable on this
// host):** this file exercises `withCostContext()` through the real
// stack — native PostgreSQL 18, PostgREST 16.2 at `http://127.0.0.1:3001`,
// `@supabase/supabase-js` — the same mechanism `tests/db/rls.test.ts`
// uses, for the same reason: `recordFetch`'s cap/reserve/settle/cache
// behaviour is a claim about what a real transaction commits, which a
// hand-written mock cannot discriminate from a correct implementation any
// better than `tests/scan/free/admission-claim.test.ts`'s own header
// argues for its one concurrency suite. `env.ts` parses `process.env` at
// module load (BP-005), so `withCostContext` is imported dynamically,
// after the fixture below populates `process.env` — the same pattern
// `tests/db/rls.test.ts` uses for `db`/`dbAdmin`.
//
// **Run this file with `--no-file-parallelism`** alongside `tests/db/*`,
// `tests/account/columns.test.ts`, `tests/scan/free/schema.test.ts` and
// `tests/costs/fetches-schema.test.ts` (see `tests/db/baseline.test.ts`'s
// header for why) — `vitest.config.ts` is outside this work order's file
// plan, so the flag is stated here, exactly as those files' own headers
// already do.
import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

let withCostContext: (typeof import("../../src/lib/costs/index"))["withCostContext"];

const DB_HOST = "127.0.0.1";
const DB_PORT = "5432";
const DB_USER = "reachkit";
const DB_PASSWORD = "reachkit";
const DB_NAME = process.env.REACHKIT_DB_NAME ?? "reachkit_scratch";
const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:3001";
const JWT_SECRET = "reachkit-scratch-jwt-secret-at-least-32-chars-long";
const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const BASELINE_MIGRATION = path.join(REPO_ROOT, "supabase/migrations/00000000000001_baseline.sql");
const FETCHES_MIGRATION = path.join(REPO_ROOT, "supabase/migrations/20260903080000_fetches.sql");

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

function resetAndApplySchema(): void {
  psql([
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    "drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role;",
  ]);
  psql(["-v", "ON_ERROR_STOP=1", "-f", BASELINE_MIGRATION]);
  psql(["-v", "ON_ERROR_STOP=1", "-f", FETCHES_MIGRATION]);
  psql(["-c", "NOTIFY pgrst, 'reload schema';"]);
  execFileSync("sleep", ["0.3"]); // PostgREST's schema-cache reload is async.
}

// ── JWT + loopback-fetch harness (mirrors tests/db/rls.test.ts's own) ──────

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
const ANON_KEY = signJwt({ role: "anon", iss: "supabase", exp: Math.floor(Date.now() / 1000) + 3600 });
const SERVICE_ROLE_KEY = signJwt({ role: "service_role", iss: "supabase", exp: Math.floor(Date.now() / 1000) + 3600 });

function loopbackFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
  if (!/^https?:\/\/127\.0\.0\.1(:\d+)?\//.test(url)) {
    return Promise.reject(new Error(`loopbackFetch refuses non-loopback URL: ${url}`));
  }
  const method = init.method ?? "GET";
  const headerEntries: [string, string][] = [];
  if (init.headers) {
    new Headers(init.headers as HeadersInit).forEach((value, key) => headerEntries.push([key, value]));
  }
  const bodyText = typeof init.body === "string" ? init.body : init.body ? String(init.body) : undefined;

  const args = ["-s", "-i", "-X", method];
  for (const [key, value] of headerEntries) args.push("-H", `${key}: ${value}`);
  if (bodyText !== undefined) args.push("--data-binary", "@-");
  args.push(url);

  const raw = execFileSync("curl", args, { input: bodyText, maxBuffer: 10 * 1024 * 1024 });
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
  // Fetch spec: a "null body status" (204 chief among them — PostgREST's
  // own response to an `update`/`insert` with no `.select()`, `Prefer:
  // return=minimal`) may carry no body at all, even an empty one; Node's
  // `Response` constructor throws if one is passed regardless of length.
  const NULL_BODY_STATUSES = new Set([101, 103, 204, 205, 304]);
  return Promise.resolve(
    new Response(NULL_BODY_STATUSES.has(status) ? null : bodyPart, { status, headers: responseHeaders })
  );
}

globalThis.fetch = loopbackFetch as unknown as typeof fetch;

const ENV_FIXTURE: Record<string, string> = {
  DATABASE_URL: `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`,
  SUPABASE_URL,
  SUPABASE_ANON_KEY: ANON_KEY,
  // Renamed by WO-284 (BP-005 decision 6a) — outside that order's own file
  // plan, whose grep for this literal missed this file; fixed here as the
  // same mechanical rename applied to the six files that plan does name,
  // flagged once (constitution rule 4.2) in that order's own return.
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
  STRIPE_SECRET_KEY: "sk_test_fixture",
  STRIPE_WEBHOOK_SECRET: "whsec_fixture",
  STRIPE_PRICE_ID: "price_fixture",
  RESEND_API_KEY: "re_fixture",
  DATAFORSEO_LOGIN: "dfs-login-fixture",
  DATAFORSEO_PASSWORD: "dfs-password-fixture",
  ANTHROPIC_API_KEY: "sk-ant-fixture",
  NANO_API_KEY: "nano-fixture",
  IP_HASH_SALT: "salt-fixture",
  KILL_SWITCH: "false",
  OWNER_EMAILS: "owner@example.com",
  NEXT_PUBLIC_APP_URL: "https://app.example.com",
  HOSTED_EDGE_CNAME_TARGET: "content.example.com",
};

beforeAll(async () => {
  for (const [key, value] of Object.entries(ENV_FIXTURE)) process.env[key] = value;
  ({ withCostContext } = await import("../../src/lib/costs/index"));
  resetAndApplySchema();
});

afterAll(() => {
  psql([
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    "drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role;",
  ]);
});

function freshScanId(label: string): string {
  const rows = psqlRows(
    `insert into scans (domain, tier, status) values ('${label}-${Math.random().toString(36).slice(2)}.example.com', 'free', 'running') returning id;`
  );
  const [row] = rows;
  const [id] = row ?? [];
  if (!id) throw new Error("insert into scans returned no id");
  return id;
}

function fetchesRowsFor(scanId: string): Array<{ source: string; cache_key: string; policy_version: string; cost_cents: string; reserved_cents: string; payload: string }> {
  const rows = psqlRows(
    `select source, cache_key, policy_version, cost_cents, reserved_cents, payload::text from fetches where scan_id = '${scanId}' order by created_at asc;`
  );
  return rows.map((r) => ({
    source: r[0] ?? "",
    cache_key: r[1] ?? "",
    policy_version: r[2] ?? "",
    cost_cents: r[3] ?? "",
    reserved_cents: r[4] ?? "",
    payload: r[5] ?? "",
  }));
}

function scanRow(scanId: string): { cost_cents: string; status: string } {
  const rows = psqlRows(`select cost_cents, status from scans where id = '${scanId}';`);
  const [row] = rows;
  return { cost_cents: row?.[0] ?? "", status: row?.[1] ?? "" };
}

describe('BP-007 `## Error & edge behavior` — "Caps degrade, never throw."', () => {
  it('at the cap, the return is the third arm, nothing is thrown, `degraded()` is true, and measurements already paid for inside the same body are kept', async () => {
    const scanId = freshScanId("cap-degrade");
    let firstResult: unknown;
    let secondResult: unknown;
    let sawThrow = false;

    await withCostContext({ scanId, cap: "FREE", policyVersion: 1 }, async (cost) => {
      firstResult = await cost.recordFetch({
        source: "cap-degrade-a",
        cacheKey: "k1",
        freshnessDays: 7,
        costCents: 10,
        run: async () => ({ v: 1 }),
      });
      try {
        secondResult = await cost.recordFetch({
          source: "cap-degrade-b",
          cacheKey: "k2",
          freshnessDays: 7,
          costCents: 5, // 10 + 5 > CAPS.FREE_C (12)
          run: async () => {
            throw new Error("run() must never be invoked once the cap is exceeded");
          },
        });
      } catch {
        sawThrow = true;
      }
      expect(cost.degraded()).toBe(true);
      // The first, already-paid-for measurement is kept — spentCents()
      // still reflects it, not zero.
      expect(cost.spentCents()).toBe(10);
    });

    expect(sawThrow).toBe(false);
    expect(secondResult).toEqual({ skipped: "cap" });
    expect(firstResult).toMatchObject({ fresh: true, costCents: 10 });
  });
});

describe(
  'BP-007 `## Public interface` — "Cache-first, ledger-always ... `fresh` false means the payload came from cache and cost nothing" — `index.ts`\'s own comment: "a hit is free and bypasses the cap entirely — it never reaches the vendor, so there is nothing for the cap to protect against."',
  () => {
    it("a cache hit is served even when the context is already at or over its cap — the cap check is never consulted for a hit (TST-029 coverage gap)", async () => {
      const source = "cache-first-vs-cap";
      const cacheKey = "k1";

      // Seed a non-empty cached row on this key from an earlier scan.
      const seedScanId = freshScanId("cache-first-seed");
      await withCostContext({ scanId: seedScanId, cap: "FREE", policyVersion: 1 }, async (cost) => {
        const seeded = await cost.recordFetch({
          source,
          cacheKey,
          freshnessDays: 7,
          costCents: 1,
          run: async () => ({ result: "cached-payload" }),
        });
        expect(seeded).toMatchObject({ fresh: true, costCents: 1 });
      });

      // A fresh scan whose reservation alone already exhausts CAPS.FREE_C
      // (12) before the cache-hit call is even made.
      const scanId = freshScanId("cache-first-vs-cap");
      let capHitBeforeHit = false;
      let hitResult: unknown;
      await withCostContext({ scanId, cap: "FREE", policyVersion: 1 }, async (cost) => {
        await cost.recordFetch({
          source: "cache-first-vs-cap-exhaust",
          cacheKey: "exhaust-key",
          freshnessDays: 7,
          costCents: 12, // lands exactly on CAPS.FREE_C
          run: async () => ({ v: "exhaust" }),
        });
        capHitBeforeHit = cost.capHit();

        // The cap is already exhausted (`capHitBeforeHit` above). A hit on
        // `source`/`cacheKey` must still be served — cache-first means the
        // cap check is never reached for it. `costCents: 999` is an
        // absurd reservation, chosen so that if the cap were checked first
        // this call would be skipped by a wide margin rather than by
        // coincidence.
        hitResult = await cost.recordFetch({
          source,
          cacheKey,
          freshnessDays: 7,
          costCents: 999,
          run: async () => {
            throw new Error("run() must not be invoked on a cache hit, cap or no cap");
          },
        });
      });

      expect(capHitBeforeHit).toBe(true);
      expect(hitResult).toEqual({ payload: { result: "cached-payload" }, fresh: false, costCents: 0 });

      // No row was ledgered for the hit — only the seed row and the
      // cap-exhausting row exist; the cap-exhausted scan carries exactly
      // one row, not two.
      const seedRows = fetchesRowsFor(seedScanId);
      const scanRows = fetchesRowsFor(scanId);
      expect(seedRows).toHaveLength(1);
      expect(scanRows).toHaveLength(1);
    });
  }
);

describe('BP-007 decision 1 — "`capHit()` is re-checked between calls in any multi-call step"', () => {
  it("a body making three calls where the second crosses the cap gets `{ skipped: \"cap\" }` on the third and a true `capHit()` between them", async () => {
    const scanId = freshScanId("cap-hit-between");
    const results: unknown[] = [];
    let capHitBetween2And3 = false;

    await withCostContext({ scanId, cap: "FREE", policyVersion: 1 }, async (cost) => {
      results.push(
        await cost.recordFetch({ source: "multi-a", cacheKey: "k1", freshnessDays: 7, costCents: 5, run: async () => 1 })
      );
      results.push(
        await cost.recordFetch({ source: "multi-b", cacheKey: "k2", freshnessDays: 7, costCents: 7, run: async () => 2 })
      ); // 5 + 7 = 12 === CAPS.FREE_C — lands exactly on the cap
      capHitBetween2And3 = cost.capHit();
      results.push(
        await cost.recordFetch({ source: "multi-c", cacheKey: "k3", freshnessDays: 7, costCents: 1, run: async () => 3 })
      );
    });

    expect(results[0]).toMatchObject({ fresh: true, costCents: 5 });
    expect(results[1]).toMatchObject({ fresh: true, costCents: 7 });
    expect(capHitBetween2And3).toBe(true);
    expect(results[2]).toEqual({ skipped: "cap" });
  });
});

describe('BP-007 `## Error & edge behavior` — "Money already spent is always ledgered — a call that succeeds at the vendor and fails on parse still writes its row."', () => {
  it("a `run()` that resolves then throws in the caller still leaves a `fetches` row with its `cost_cents`", async () => {
    const scanId = freshScanId("spend-then-fail");
    let threw = false;
    try {
      await withCostContext({ scanId, cap: "FREE", policyVersion: 1 }, async (cost) => {
        const result = await cost.recordFetch({
          source: "parse-fail",
          cacheKey: "k1",
          freshnessDays: 7,
          costCents: 4,
          run: async () => ({ raw: "unparseable" }),
        });
        expect(result).toMatchObject({ fresh: true, costCents: 4 });
        throw new Error("caller-side parse failure, after the vendor call already resolved");
      });
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);

    const rows = fetchesRowsFor(scanId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.cost_cents).toBe("4");
  });
});

describe('BP-007 `## Error & edge behavior` — "The cache is keyed `source + key + policyVersion`. Bumping the policy version is how a changed derivation invalidates its cache; nothing is deleted."', () => {
  it("a bumped policy version misses; the old row still exists", async () => {
    const scanIdV1 = freshScanId("policy-v1");
    await withCostContext({ scanId: scanIdV1, cap: "FREE", policyVersion: 1 }, async (cost) => {
      const first = await cost.recordFetch({
        source: "policy-bump",
        cacheKey: "same-key",
        freshnessDays: 7,
        costCents: 2,
        run: async () => ({ v: "policy-1-payload" }),
      });
      expect(first).toMatchObject({ fresh: true, costCents: 2 });
    });

    const scanIdV2 = freshScanId("policy-v2");
    await withCostContext({ scanId: scanIdV2, cap: "FREE", policyVersion: 2 }, async (cost) => {
      const second = await cost.recordFetch({
        source: "policy-bump",
        cacheKey: "same-key",
        freshnessDays: 7,
        costCents: 2,
        run: async () => ({ v: "policy-2-payload" }),
      });
      // A miss on the new policy version — bought again, not served from
      // the version-1 row.
      expect(second).toMatchObject({ fresh: true, costCents: 2 });
    });

    const v1Rows = fetchesRowsFor(scanIdV1);
    expect(v1Rows).toHaveLength(1);
    expect(v1Rows[0]?.policy_version).toBe("1"); // the old row was never touched, let alone deleted
  });
});

describe(
  'BP-007 `## Error & edge behavior` — "A cache read is the newest row on that key inserted within `freshnessDays`, excluding a row whose payload is the vendor\'s own zero-result shape … An empty payload is therefore always a miss and is retried on the next scan … it is still ledgered, at cost, every time it is bought, and is never served back as a hit"',
  () => {
    it("an empty payload is billed, stored, and does not serve the next scan's read, which buys and ledgers a second row on the same key; a non-empty row inserted later on the same key is the one served", async () => {
      const source = "empty-payload";
      const cacheKey = "k1";

      const scan1 = freshScanId("empty-1");
      await withCostContext({ scanId: scan1, cap: "FREE", policyVersion: 1 }, async (cost) => {
        const first = await cost.recordFetch({
          source,
          cacheKey,
          freshnessDays: 7,
          costCents: 1,
          run: async () => [], // the vendor's zero-result shape
        });
        expect(first).toMatchObject({ fresh: true, costCents: 1 });
      });

      // Next scan, same key: the empty payload is never served as a hit —
      // a second buy, a second ledgered row.
      const scan2 = freshScanId("empty-2");
      await withCostContext({ scanId: scan2, cap: "FREE", policyVersion: 1 }, async (cost) => {
        const second = await cost.recordFetch({
          source,
          cacheKey,
          freshnessDays: 7,
          costCents: 1,
          run: async () => [], // still empty
        });
        expect(second).toMatchObject({ fresh: true, costCents: 1 }); // bought again, not a hit
      });

      // A non-empty row lands later on the same key.
      const scan3 = freshScanId("empty-3");
      await withCostContext({ scanId: scan3, cap: "FREE", policyVersion: 1 }, async (cost) => {
        const third = await cost.recordFetch({
          source,
          cacheKey,
          freshnessDays: 7,
          costCents: 1,
          run: async () => [{ result: "real" }],
        });
        expect(third).toMatchObject({ fresh: true, costCents: 1 });
      });

      // A fourth scan now gets served the non-empty row as a hit.
      const scan4 = freshScanId("empty-4");
      await withCostContext({ scanId: scan4, cap: "FREE", policyVersion: 1 }, async (cost) => {
        const fourth = await cost.recordFetch({
          source,
          cacheKey,
          freshnessDays: 7,
          costCents: 1,
          run: async () => {
            throw new Error("run() must not be invoked on a cache hit");
          },
        });
        expect(fourth).toEqual({ payload: [{ result: "real" }], fresh: false, costCents: 0 });
      });

      // Two ledgered rows exist for the two empty buys; the third
      // (non-empty) buy is the one being served, unconsumed by the hit.
      const allRows = [scan1, scan2, scan3].flatMap((id) => fetchesRowsFor(id));
      expect(allRows).toHaveLength(3);
      expect(allRows.filter((r) => r.payload === "[]")).toHaveLength(2);
    });
  }
);

describe('BP-007 `## NFR budget` — "A free scan\'s context must not exceed 12¢, a deep pass 150¢, a weekly 40¢, a draft 45¢ — enforced here, not assumed anywhere else."', () => {
  const CAPS_UNDER_TEST: Array<{ cap: "FREE" | "DEEP" | "WEEKLY" | "DRAFT"; label: string }> = [
    { cap: "FREE", label: "free-cap" },
    { cap: "DEEP", label: "deep-cap" },
    { cap: "WEEKLY", label: "weekly-cap" },
    { cap: "DRAFT", label: "draft-cap" },
  ];

  it.each(CAPS_UNDER_TEST)("$cap — a call landing exactly on CAPS.${cap}_C succeeds; one cent more is skipped", async ({ cap, label }) => {
    const { CAPS } = await import("../../src/lib/config/constants");
    const capValue = CAPS[`${cap}_C` as keyof typeof CAPS] as number;

    const scanExact = freshScanId(`${label}-exact`);
    let exactResult: unknown;
    await withCostContext({ scanId: scanExact, cap, policyVersion: 1 }, async (cost) => {
      exactResult = await cost.recordFetch({
        source: `${label}-exact`,
        cacheKey: "k1",
        freshnessDays: 7,
        costCents: capValue,
        run: async () => ({ ok: true }),
      });
    });
    expect(exactResult).toMatchObject({ fresh: true, costCents: capValue });

    const scanOver = freshScanId(`${label}-over`);
    let overResult: unknown;
    await withCostContext({ scanId: scanOver, cap, policyVersion: 1 }, async (cost) => {
      overResult = await cost.recordFetch({
        source: `${label}-over`,
        cacheKey: "k1",
        freshnessDays: 7,
        costCents: capValue + 1,
        run: async () => {
          throw new Error("run() must not be invoked over the cap");
        },
      });
    });
    expect(overResult).toEqual({ skipped: "cap" });
  });
});

describe('BP-007 `## NFR budget` — "a per-scan roll-up (`spentCents`, `degraded`) is written to `scans.cost_cents` and `scans.status` at close"', () => {
  it("both columns reflect the closed context — a clean close", async () => {
    const scanId = freshScanId("rollup-clean");
    await withCostContext({ scanId, cap: "FREE", policyVersion: 1 }, async (cost) => {
      await cost.recordFetch({ source: "rollup", cacheKey: "k1", freshnessDays: 7, costCents: 3, run: async () => 1 });
    });
    const row = scanRow(scanId);
    expect(row.cost_cents).toBe("3");
    expect(row.status).toBe("done");
  });

  it("a degraded close is recorded as `status = 'degraded'`", async () => {
    const scanId = freshScanId("rollup-degraded");
    await withCostContext({ scanId, cap: "FREE", policyVersion: 1 }, async (cost) => {
      await cost.recordFetch({ source: "rollup-d-a", cacheKey: "k1", freshnessDays: 7, costCents: 12, run: async () => 1 });
      await cost.recordFetch({ source: "rollup-d-b", cacheKey: "k2", freshnessDays: 7, costCents: 1, run: async () => 2 });
    });
    const row = scanRow(scanId);
    expect(row.status).toBe("degraded");
  });
});

describe(
  'BP-007 `## Public interface` — "The **reservation**: the most this call can cost, known before it runs. The cap is checked against this, so no call is made against money the context has not got."',
  () => {
    it("a call whose `costCents` would cross the cap returns `{ skipped: \"cap\" }` and `run()` is never invoked, even when a `settleCents` closure would have settled it under the cap", async () => {
      const scanId = freshScanId("reservation-not-settlement");
      let runInvoked = false;
      let result: unknown;
      await withCostContext({ scanId, cap: "FREE", policyVersion: 1 }, async (cost) => {
        result = await cost.recordFetch<{ v: number }>({
          source: "reservation-check",
          cacheKey: "k1",
          freshnessDays: 7,
          costCents: 20, // over CAPS.FREE_C (12) as a reservation
          settleCents: () => 1, // would easily fit under the cap if it were checked
          run: async () => {
            runInvoked = true;
            return { v: 1 };
          },
        });
      });
      expect(result).toEqual({ skipped: "cap" });
      expect(runInvoked).toBe(false);
    });
  }
);

describe(
  'BP-007 `## Public interface` — "Omitting it is the ordinary case and behaves exactly as before this argument existed."',
  () => {
    it("with no `settleCents`, the returned `costCents`, the row's `cost_cents` and the row's `reserved_cents` are all the reservation, and `spentCents()` is unchanged from the pre-settlement behaviour", async () => {
      const scanId = freshScanId("no-settle-cents");
      let result: unknown;
      let spentAfter = -1;
      await withCostContext({ scanId, cap: "FREE", policyVersion: 1 }, async (cost) => {
        result = await cost.recordFetch({
          source: "no-settle",
          cacheKey: "k1",
          freshnessDays: 7,
          costCents: 6,
          run: async () => ({ v: 1 }),
        });
        spentAfter = cost.spentCents();
      });
      expect(result).toMatchObject({ fresh: true, costCents: 6 });
      expect(spentAfter).toBe(6);

      const rows = fetchesRowsFor(scanId);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.reserved_cents).toBe("6");
      expect(rows[0]?.cost_cents).toBe("6");
    });
  }
);

describe(
  'BP-007 `## Error & edge behavior` — "A settlement never raises a charge … it is clamped to the reservation and logged … A settled figure is what the row carries and what `spentCents()` sums."',
  () => {
    it("a closure returning more than the reservation leaves `cost_cents` at the reservation and emits the log line; a closure returning less leaves `cost_cents` at the settled figure and `spentCents()` sums the settled figures, not the reserved ones", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const scanId = freshScanId("settlement-clamp");

      await withCostContext({ scanId, cap: "DEEP", policyVersion: 1 }, async (cost) => {
        // Over-claiming closure — clamped.
        const over = await cost.recordFetch<{ v: number }>({
          source: "clamp-over",
          cacheKey: "k1",
          freshnessDays: 7,
          costCents: 10,
          settleCents: () => 50, // more than the reservation — a defect the seam clamps
          run: async () => ({ v: 1 }),
        });
        expect(over).toMatchObject({ costCents: 10 });

        // Under-claiming closure — the settled figure is what is kept.
        const under = await cost.recordFetch<{ v: number }>({
          source: "clamp-under",
          cacheKey: "k1",
          freshnessDays: 7,
          costCents: 10,
          settleCents: () => 3,
          run: async () => ({ v: 2 }),
        });
        expect(under).toMatchObject({ costCents: 3 });

        expect(cost.spentCents()).toBe(10 + 3); // settled figures summed, not 10 + 10
      });

      expect(warnSpy).toHaveBeenCalledTimes(1);
      warnSpy.mockRestore();

      const rows = fetchesRowsFor(scanId);
      const overRow = rows.find((r) => r.source === "clamp-over");
      const underRow = rows.find((r) => r.source === "clamp-under");
      expect(overRow?.reserved_cents).toBe("10");
      expect(overRow?.cost_cents).toBe("10"); // clamped, not 50
      expect(underRow?.reserved_cents).toBe("10");
      expect(underRow?.cost_cents).toBe("3");
    });
  }
);

describe(
  'BP-007 `## Error & edge behavior` — "Between the reservation and the settlement a scan is charged the higher figure, so a cap can never be exceeded by a call in flight; after it, the context holds the figure the vendor says it will bill."',
  () => {
    it("`spentCents()` observed during `run()` is the reservation and after it is the settlement; a second call that fits only in the headroom the settlement released is made rather than skipped", async () => {
      const scanId = freshScanId("headroom-release");
      let duringRunSpent = -1;
      let afterFirstCall = -1;
      let secondResult: unknown;

      await withCostContext({ scanId, cap: "FREE", policyVersion: 1 }, async (cost) => {
        await cost.recordFetch<{ v: number }>({
          source: "headroom-a",
          cacheKey: "k1",
          freshnessDays: 7,
          costCents: 8,
          settleCents: () => 2,
          run: async () => {
            duringRunSpent = cost.spentCents(); // reservation, not settlement
            return { v: 1 };
          },
        });
        afterFirstCall = cost.spentCents(); // settlement, not reservation

        // If the reservation (8) were still counted, 8 + 6 = 14 > 12
        // (CAPS.FREE_C) and this would be skipped; the settlement (2)
        // releases the headroom, 2 + 6 = 8 <= 12.
        secondResult = await cost.recordFetch({
          source: "headroom-b",
          cacheKey: "k2",
          freshnessDays: 7,
          costCents: 6,
          run: async () => ({ v: 2 }),
        });
      });

      expect(duringRunSpent).toBe(8);
      expect(afterFirstCall).toBe(2);
      expect(secondResult).toMatchObject({ fresh: true, costCents: 6 });
    });
  }
);

describe(
  'BP-007 `## NFR budget` — "a row whose charge was settled records **both** figures — reserved and settled — so the difference can be reconciled against the vendor\'s own account statement"',
  () => {
    it("a settled call's `fetches` row carries `reserved_cents` and `cost_cents` with the two different values; dropping either column fails it", async () => {
      const scanId = freshScanId("both-figures");
      await withCostContext({ scanId, cap: "FREE", policyVersion: 1 }, async (cost) => {
        await cost.recordFetch<{ v: number }>({
          source: "both-figures",
          cacheKey: "k1",
          freshnessDays: 7,
          costCents: 9,
          settleCents: () => 4,
          run: async () => ({ v: 1 }),
        });
      });
      const rows = fetchesRowsFor(scanId);
      expect(rows).toHaveLength(1);
      const row = rows[0];
      expect(row).toBeDefined();
      expect(row?.reserved_cents).not.toBe(row?.cost_cents);
      expect(row?.reserved_cents).toBe("9");
      expect(row?.cost_cents).toBe("4");
    });
  }
);

describe(
  'BP-007 `## Data model delta` — "`reserved_cents` is what the cap was checked against; they differ only on the one endpoint ADR-094 flags"',
  () => {
    it("the applied schema carries `reserved_cents` on `fetches`, and an unsettled call writes the same value into both columns", async () => {
      const columnRows = psqlRows(
        `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'fetches' and column_name = 'reserved_cents';`
      );
      expect(columnRows).toEqual([["reserved_cents"]]);

      const scanId = freshScanId("unsettled-same-value");
      await withCostContext({ scanId, cap: "FREE", policyVersion: 1 }, async (cost) => {
        await cost.recordFetch({
          source: "unsettled",
          cacheKey: "k1",
          freshnessDays: 7,
          costCents: 7,
          run: async () => ({ v: 1 }),
        });
      });
      const rows = fetchesRowsFor(scanId);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.reserved_cents).toBe(rows[0]?.cost_cents);
      expect(rows[0]?.reserved_cents).toBe("7");
    });
  }
);
