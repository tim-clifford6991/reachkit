// tests/costs/fetches-schema.test.ts
//
// WO-276 `## Test plan` — the rows carried verbatim from WO-021 (`fetches`
// itself, `supabase/migrations/20260903080000_fetches.sql`), asserted
// against a live, migrated scratch database (`structure.md` rule 4:
// `tests/costs/**` is BP-007's).
//
// **Substrate note (owner ruling, 2026-09-03; Docker unavailable on this
// host, carried from `tests/db/baseline.test.ts`):** `supabase db reset`
// cannot run. In its place this file resets and re-applies
// `00000000000001_baseline.sql` and `20260903080000_fetches.sql` against
// native PostgreSQL 18 at `127.0.0.1:5432`, database `reachkit_scratch`,
// via `psql` spawned from `child_process` — the same mechanism
// `tests/db/baseline.test.ts` and `tests/scan/free/schema.test.ts` use.
// The RLS row below also needs PostgREST + a self-minted JWT (the same
// mechanism `tests/db/rls.test.ts` uses) to exercise an actual anon-key
// and authenticated-key read, not merely the policy catalogue —
// `00000000000002_rls.sql` is not applied (it carries no `fetches`
// policy of its own; this table's own migration is the one that enables
// RLS on it, with no policy).
//
// **Run this file with `--no-file-parallelism`** alongside `tests/db/*`,
// `tests/account/columns.test.ts` and `tests/scan/free/schema.test.ts`
// (see `tests/db/baseline.test.ts`'s header for why): all reset and
// rebuild the same physical `public` schema on the one scratch database.
// `vitest.config.ts` is outside this work order's file plan (`src/lib/
// costs/`, `tests/costs/`, `supabase/migrations/` only — WO-276's own
// dispatch), so the flag is stated here rather than forced in config,
// exactly as those files' own headers already do for the same reason.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  ANON_KEY,
  REST_URL,
  psql,
  psqlRows,
  signJwt,
} from "../db/substrate";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const BASELINE_MIGRATION = path.join(REPO_ROOT, "supabase/migrations/00000000000001_baseline.sql");
const FETCHES_MIGRATION = path.join(REPO_ROOT, "supabase/migrations/20260903080000_fetches.sql");

/** One tuple-only row per line, `|`-separated columns. */
/** Runs `sql` and returns whether it raised (never throws itself). */
function raises(sql: string): boolean {
  try {
    psql(["-v", "ON_ERROR_STOP=1", "-c", sql]);
    return false;
  } catch {
    return true;
  }
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

beforeAll(() => {
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

function freshScanId(): string {
  const rows = psqlRows(
    `insert into scans (domain, tier, status) values ('fetches-schema-${Math.random().toString(36).slice(2)}.example.com', 'free', 'running') returning id;`
  );
  const [row] = rows;
  const [id] = row ?? [];
  if (!id) throw new Error("insert into scans returned no id");
  return id;
}

function insertFetch(opts: {
  scanId: string;
  source?: string;
  cacheKey?: string;
  policyVersion?: number;
  costCents?: number;
  reservedCents?: number;
  payload?: string; // raw jsonb literal, e.g. "'[]'::jsonb"
}): string {
  const {
    scanId,
    source = "serpOrganic",
    cacheKey = "k1",
    policyVersion = 1,
    costCents = 20,
    reservedCents = 20,
    payload = "'[1]'::jsonb",
  } = opts;
  const rows = psqlRows(
    `insert into fetches (scan_id, source, cache_key, policy_version, cost_cents, reserved_cents, payload)
     values ('${scanId}', '${source}', '${cacheKey}', ${policyVersion}, ${costCents}, ${reservedCents}, ${payload})
     returning id;`
  );
  const [row] = rows;
  const [id] = row ?? [];
  if (!id) throw new Error("insert into fetches returned no id");
  return id;
}

describe(
  'BP-007 `## Data model delta`: "`fetches` — `id, scan_id, source, cache_key, policy_version, cost_cents, reserved_cents, payload jsonb, created_at`" ... "Indexed `(source, cache_key, policy_version, created_at desc)` for the cache read and on `scan_id` for the ledger read."',
  () => {
    it("carries exactly the nine named columns", () => {
      const rows = psqlRows(
        `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'fetches' order by column_name;`
      );
      const names = rows.map((r) => r[0]).sort();
      expect(names).toEqual(
        [
          "id",
          "scan_id",
          "source",
          "cache_key",
          "policy_version",
          "cost_cents",
          "reserved_cents",
          "payload",
          "created_at",
        ].sort()
      );
    });

    it("`reserved_cents` is present, not-null integer — a missing column fails this test", () => {
      const rows = psqlRows(
        `select data_type, is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'fetches' and column_name = 'reserved_cents';`
      );
      expect(rows).toEqual([["integer", "NO"]]);
    });

    it("`payload` is jsonb", () => {
      const rows = psqlRows(
        `select data_type from information_schema.columns where table_schema = 'public' and table_name = 'fetches' and column_name = 'payload';`
      );
      expect(rows).toEqual([["jsonb"]]);
    });

    it("the composite cache-read index `(source, cache_key, policy_version, created_at desc)` exists", () => {
      const rows = psqlRows(
        `select indexdef from pg_indexes where schemaname = 'public' and tablename = 'fetches' and indexname = 'idx_fetches_cache_read';`
      );
      expect(rows).toHaveLength(1);
      const [indexdef] = rows[0] ?? [];
      expect(indexdef).toMatch(/\(source, cache_key, policy_version, created_at DESC\)/);
    });

    it("the `scan_id` ledger-read index exists", () => {
      const rows = psqlRows(
        `select indexdef from pg_indexes where schemaname = 'public' and tablename = 'fetches' and indexname = 'idx_fetches_scan_id';`
      );
      expect(rows).toHaveLength(1);
      const [indexdef] = rows[0] ?? [];
      expect(indexdef).toMatch(/\(scan_id\)/);
    });
  }
);

describe(
  'BP-007 `## Data model delta`: "**Insert-only; no unique constraint on `(source, cache_key, policy_version)`**" (decision 3)',
  () => {
    it("two rows on one `(source, cache_key, policy_version)` triple both insert and persist, distinguishable by `created_at desc`", () => {
      const scanId = freshScanId();
      const firstId = insertFetch({ scanId, source: "rebuy", cacheKey: "same-key", policyVersion: 1, payload: "'[]'::jsonb" });
      // A distinct `created_at` so `created_at desc` genuinely orders them,
      // not merely two rows with the same microsecond timestamp.
      psql(["-v", "ON_ERROR_STOP=1", "-c", `update fetches set created_at = created_at - interval '1 minute' where id = '${firstId}';`]);
      const secondId = insertFetch({ scanId, source: "rebuy", cacheKey: "same-key", policyVersion: 1, payload: "'[2]'::jsonb" });

      const rows = psqlRows(
        `select id from fetches where source = 'rebuy' and cache_key = 'same-key' and policy_version = 1 order by created_at desc;`
      );
      expect(rows.map((r) => r[0])).toEqual([secondId, firstId]);
    });

    it("watch it fail first, re-observed as a permanent regression guard: adding back the dropped unique constraint rejects the second insert on the same triple", () => {
      // Isolate from the previous test's deliberate duplicate (`rebuy`/
      // `same-key`/1) — a table-wide unique constraint fails to even
      // *create* over an existing duplicate anywhere in the table, which
      // is itself confirming evidence (decision 3's constraint cannot
      // coexist with the re-buy this seam requires) but not the specific
      // "second insert rejected" case this test isolates.
      psql(["-v", "ON_ERROR_STOP=1", "-c", "delete from fetches;"]);
      const scanId = freshScanId();
      insertFetch({ scanId, source: "constraint-fixture", cacheKey: "k", policyVersion: 9 });
      expect(
        raises(
          `alter table fetches add constraint fetches_wo276_fixture_unique unique (source, cache_key, policy_version);`
        )
      ).toBe(false); // no duplicate yet — the constraint itself is addable
      expect(
        raises(
          `insert into fetches (scan_id, source, cache_key, policy_version, cost_cents, reserved_cents, payload)
           values ('${scanId}', 'constraint-fixture', 'k', 9, 5, 5, '[]'::jsonb);`
        )
      ).toBe(true); // decision 3's re-buy would be rejected by the constraint this migration deliberately omits
      psql(["-v", "ON_ERROR_STOP=1", "-c", "alter table fetches drop constraint fetches_wo276_fixture_unique;"]);
    });
  }
);

describe(
  'BP-007 `## Data model delta`: "A column, not a second table: the two figures belong to the same call." · "No second table: the ledger, the cache and the raw store are one row"',
  () => {
    it("`cost_cents` and `reserved_cents` are both columns of `fetches`", () => {
      const rows = psqlRows(
        `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'fetches' and column_name in ('cost_cents', 'reserved_cents') order by column_name;`
      );
      expect(rows.map((r) => r[0])).toEqual(["cost_cents", "reserved_cents"]);
    });

    it("no other table in `public` carries `cache_key` or `reserved_cents` — no second ledger, no second cache", () => {
      const cacheKeyRows = psqlRows(
        `select table_name from information_schema.columns where table_schema = 'public' and column_name = 'cache_key';`
      );
      expect(cacheKeyRows.map((r) => r[0])).toEqual(["fetches"]);

      const reservedCentsRows = psqlRows(
        `select table_name from information_schema.columns where table_schema = 'public' and column_name = 'reserved_cents';`
      );
      expect(reservedCentsRows.map((r) => r[0])).toEqual(["fetches"]);
    });

    it("`scans.cost_cents` is excluded by name — BP-007's NFR budget roll-up, not a second ledger (and `drafts.cost_cents` is BP-014's own pre-existing roll-up column, unaffected by this migration)", () => {
      const rows = psqlRows(
        `select table_name from information_schema.columns where table_schema = 'public' and column_name = 'cost_cents' order by table_name;`
      );
      expect(rows.map((r) => r[0]).sort()).toEqual(["drafts", "fetches", "scans"]);
    });

    it("the migration created exactly one new table — `fetches` — no `cache` and no `spend_ledger`", () => {
      const rows = psqlRows(
        `select table_name from information_schema.tables where table_schema = 'public' order by table_name;`
      );
      const names = rows.map((r) => r[0]);
      expect(names.sort()).toEqual(
        ["users", "sites", "scans", "opportunities", "drafts", "publications", "destinations", "leads", "fetches"].sort()
      );
      expect(names).not.toContain("cache");
      expect(names).not.toContain("spend_ledger");
    });
  }
);

describe(
  'BP-002 `## Error & edge behavior`: "RLS is default-deny: a table with no policy is unreadable by anyone holding an anon or authenticated key."',
  () => {
        const AUTH_KEY = signJwt({
      role: "authenticated",
      sub: "00000000-0000-0000-0000-000000000000",
      iss: "supabase",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const SERVICE_ROLE_KEY = signJwt({ role: "service_role", iss: "supabase", exp: Math.floor(Date.now() / 1000) + 3600 });

    function clientAs(jwt: string): SupabaseClient {
      return createClient(REST_URL, jwt, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: loopbackFetch },
      });
    }

    it("an anon-key select on `fetches` returns zero rows and no error", async () => {
      const scanId = freshScanId();
      insertFetch({ scanId });
      const { data, error } = await clientAs(ANON_KEY).from("fetches").select("id, cost_cents, payload");
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("an authenticated-key select on `fetches` returns zero rows and no error", async () => {
      const { data, error } = await clientAs(AUTH_KEY).from("fetches").select("id, cost_cents, payload");
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("the service-role client reads", async () => {
      const { data, error } = await clientAs(SERVICE_ROLE_KEY).from("fetches").select("id");
      expect(error).toBeNull();
      expect((data ?? []).length).toBeGreaterThan(0);
    });
  }
);

describe(
  'BP-007 `## NFR budget`: "No cost figure is ever rendered to a customer"',
  () => {
    it("no request-scoped read policy exists on `fetches` — unreachable by construction, not by discipline", () => {
      const rows = psqlRows(
        `select count(*) from pg_policies where schemaname = 'public' and tablename = 'fetches';`
      );
      expect(rows[0]?.[0]).toBe("0");
    });
  }
);

// ── JWT + loopback-fetch harness (mirrors tests/db/rls.test.ts's own) ──────

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
  // Fetch spec: a "null body status" (204 chief among them) may carry no
  // body at all, even an empty one; Node's `Response` constructor throws
  // if one is passed regardless of length. Not currently exercised by this
  // file (every call here is a `.select()` or a plain read), kept for
  // parity with `context.test.ts`'s copy of this same harness.
  const NULL_BODY_STATUSES = new Set([101, 103, 204, 205, 304]);
  return Promise.resolve(
    new Response(NULL_BODY_STATUSES.has(status) ? null : bodyPart, { status, headers: responseHeaders })
  );
}
