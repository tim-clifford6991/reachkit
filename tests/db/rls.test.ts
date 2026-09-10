// tests/db/rls.test.ts
//
// WO-267 `## Test plan` (carried verbatim from WO-010) — "The two invariants
// below, asserted against the applied schema rather than against the SQL
// text": (1) RLS default-deny — every table in `public` has row-level
// security enabled and at least one policy, so a new table cannot leak by
// omission; (2) every request-scoped policy carries the `deleted_at is
// null` condition (ADR-051 point 3). Plus the behavioural tombstone test
// and the `dbAdmin()` bypass / anon-`scans` tests BP-002's `## Error & edge
// behavior` states.
//
// **Substrate note (owner ruling, 2026-09-03; Docker unavailable on this
// host):** this file exercises the applied schema through the real stack —
// native PostgreSQL 18, PostgREST 16.2 at `http://127.0.0.1:3001`,
// `@supabase/supabase-js` — not through the migration SQL text.
// `tests/setup.ts` refuses real network calls process-wide; this file
// allows loopback explicitly (`loopbackFetch` below, restricted by regex to
// `127.0.0.1`) and passes it as `@supabase/supabase-js`'s `global.fetch`,
// exactly as the prompt directs. User identity is minted as an HS256 JWT
// with `SECRET`'s value, matching what Supabase Auth would issue and what
// `substrate/postgrest/keys.env`'s own `ANON`/`SERVICE_ROLE` tokens are
// signed with — self-minted here rather than read from that file so this
// test does not depend on an absolute path outside the repository; the
// claims shape (`role`, `sub`, `iss: 'supabase'`) is identical.
//
// **Substrate correction:** `auth.uid()`/`auth.role()` as first stood up
// read `request.jwt.claim.sub` / `request.jwt.claim.role` — individual
// GUCs PostgREST 16.2 does not set (confirmed empirically: a debug RPC
// showed both always null while `request.jwt.claims`, the single JSON GUC,
// held the full claim set). Real Supabase's own shims read the JSON GUC the
// same way; the two functions were corrected in the scratch database
// (`auth.uid()`/`auth.role()` now read `request.jwt.claims::jsonb ->> …`)
// so RLS is observable at all — a substrate fix, not a repository change;
// no file in this work order's plan encodes it.
//
// **Substrate correction, `/rest/v1` routing:** `@supabase/supabase-js`
// unconditionally builds its PostgREST client against `new URL("rest/v1",
// url).href` (`dist/index.mjs`) — the same shape a real project's Kong
// gateway routes to a bare PostgREST instance. This substrate has no
// Kong, so PostgREST was moved to `127.0.0.1:3002` and a small reverse
// proxy (`substrate/postgrest/rest-v1-proxy.mjs`, started by the same
// `start.sh`) now answers `127.0.0.1:3001` — the documented
// `REST_URL` — stripping a leading `/rest/v1` before forwarding.
// Without it, every request `db()`/`dbAdmin()` (unmodified, per BP-002's
// public interface) or this file's own `asUser()` client make 404s with
// PGRST125. A substrate fix, not a repository change; no file in this
// work order's plan encodes it.
//
// **Run this file, `baseline.test.ts` and `clients.test.ts` with
// `--no-file-parallelism`** — see `baseline.test.ts`'s header for why.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/db/types.generated";
import {
  ANON_KEY,
  DB_HOST,
  DB_NAME,
  DB_PASSWORD,
  DB_PORT,
  DB_USER,
  REST_URL,
  SERVICE_ROLE_KEY,
  psql,
  psqlRows,
  userJwt,
} from "./substrate";

// `env.ts` parses `process.env` at module load (BP-005), and `src/lib/db/
// index.ts` imports `env` — so `db`/`dbAdmin` are imported dynamically,
// after `process.env` is populated below, exactly like
// `tests/config/env.test.ts`'s own `importEnvModule()` pattern.
let db: (typeof import("../../src/lib/db/index"))["db"];
let dbAdmin: (typeof import("../../src/lib/db/index"))["dbAdmin"];

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const MIGRATIONS = [
  path.join(REPO_ROOT, "supabase/migrations/00000000000001_baseline.sql"),
  path.join(REPO_ROOT, "supabase/migrations/00000000000002_rls.sql"),
];

function resetAndApplySchema(): void {
  psql([
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    "drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role;",
  ]);
  for (const file of MIGRATIONS) psql(["-v", "ON_ERROR_STOP=1", "-f", file]);
  psql(["-c", "NOTIFY pgrst, 'reload schema';"]);
  execFileSync("sleep", ["0.3"]); // PostgREST's schema-cache reload is async.
}

// HS256, hand-rolled with `node:crypto` — no dependency beyond the repo's
// existing manifest (`tests/db/clients.test.ts` file-plan note applies here
// too: a new package is out of this work order's file plan).
// Loopback-only `fetch`, spawning `curl` — `tests/setup.ts` refuses the real
// `fetch`/`http`/`https` globals process-wide; this is the explicit,
// narrow allowance the prompt directs, restricted to `127.0.0.1`.
function loopbackFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url =
    typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
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
  return Promise.resolve(new Response(bodyPart, { status, headers: responseHeaders }));
}

// `db()` and `dbAdmin()` (`src/lib/db/index.ts`) construct
// `@supabase/supabase-js` clients with no `fetch` override — BP-002's `##
// Public interface` takes both functions with zero parameters, so there is
// no call-site hook to pass `loopbackFetch` through. `tests/setup.ts`
// refuses the real `globalThis.fetch` process-wide; this file's own
// narrow, documented allowance (see module header) is to replace it with
// `loopbackFetch` itself, before any client is constructed, so `db()` and
// `dbAdmin()` reach the loopback PostgREST instance exactly as `asUser()`
// already does explicitly. The regex inside `loopbackFetch` is what keeps
// this from becoming a general network allowance.
globalThis.fetch = loopbackFetch as unknown as typeof fetch;

/** Models what `db()` will send once request-identity wiring lands (a
 * later work order — `db()` itself takes no parameters, per BP-002 `##
 * Public interface`): the same URL and anon key `db()` uses, with the
 * caller's JWT as the `Authorization` override. This is the "request-scoped
 * client" the behavioural assertions below exercise. */
function asUser(jwt: string): SupabaseClient<Database> {
  return createClient<Database>(REST_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: loopbackFetch, headers: { Authorization: `Bearer ${jwt}` } },
  });
}

const EIGHT_TABLES = [
  "users",
  "sites",
  "scans",
  "opportunities",
  "drafts",
  "publications",
  "destinations",
  "leads",
] as const;

/** `noUncheckedIndexedAccess` makes every array element access
 * `T | undefined`; `psqlRows` never returns a row shorter than the query's
 * own column list, so a missing cell here is a genuine query-shape bug,
 * not a value this code should paper over silently. */
function requiredCell(row: readonly string[], index: number): string {
  const value = row[index];
  if (value === undefined) {
    throw new Error(`psqlRows row ${JSON.stringify(row)} has no column ${index}`);
  }
  return value;
}

/** The invariant `structure.md`/BP-002 want enforced in CI: every table has
 * RLS on and at least one policy. Returns the names that violate it. */
function tablesWithNoPolicyOrRlsOff(): string[] {
  const rows = psqlRows(`
    select c.relname,
           c.relrowsecurity,
           (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r';
  `);
  return rows
    .filter((row) => requiredCell(row, 1) !== "t" || requiredCell(row, 2) === "0")
    .map((row) => requiredCell(row, 0));
}

/** Every policy scoped to `authenticated` (a request-scoped policy) must
 * carry the `deleted_at is null` condition (ADR-051 point 3). Returns the
 * policy names that violate it. */
function requestScopedPoliciesMissingDeletedAtCondition(): string[] {
  // `qual`/`with_check` are `pg_get_expr`'s pretty-printed reconstruction of
  // the policy's expression and can contain embedded newlines (any policy
  // whose condition is an `exists (select ... from ... where ...)`
  // subquery, which is every request-scoped policy here) — `psqlRows`
  // splits on `\n`, so an un-flattened newline breaks one logical row into
  // several and misaligns every column read after it. `regexp_replace`
  // collapses all whitespace to single spaces before the row ever reaches
  // `psqlRows`, so one `pg_policies` row is always one output line.
  const rows = psqlRows(`
    select policyname, roles::text,
      regexp_replace(coalesce(qual, '') || ' ' || coalesce(with_check, ''), '\\s+', ' ', 'g')
    from pg_policies
    where schemaname = 'public';
  `);
  return rows
    .filter((row) => requiredCell(row, 1).includes("authenticated"))
    .filter((row) => !/deleted_at\s+is\s+null/i.test(requiredCell(row, 2)))
    .map((row) => requiredCell(row, 0));
}

// A complete, validly-shaped set of the bindings `env.ts` requires (BP-005,
// moved onto decision 6) — fixtures for everything but the three Supabase
// bindings, which carry this substrate's real values so `db()`/`dbAdmin()`
// reach the scratch PostgREST instance. `DATABASE_URL` is no longer a
// member of `Env` (decision 6c) but stays here: this file builds it and
// connects on it directly.
const ENV_FIXTURE: Record<string, string> = {
  DATABASE_URL: `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`,
  REST_URL,
  SUPABASE_ANON_KEY: ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
  STRIPE_SECRET_KEY: "sk_test_fixture",
  STRIPE_WEBHOOK_SECRET: "whsec_fixture",
  STRIPE_PRICE_ID: "price_fixture",
  RESEND_API_KEY: "re_fixture",
  MAIL_FROM: "hello@reachkit.example",
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
  ({ db, dbAdmin } = await import("../../src/lib/db/index"));
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

describe('BP-002 `## Error & edge behavior` — "RLS is default-deny ... A migration that adds a table without a policy fails CI, so a new table cannot leak by omission."', () => {
  it("every table in `public` has RLS enabled and at least one policy", () => {
    expect(tablesWithNoPolicyOrRlsOff()).toEqual([]);
  });

  it("watch it fail first: a fixture table with RLS on and no policy is flagged", () => {
    psql(["-v", "ON_ERROR_STOP=1", "-c", "create table rls_fixture_no_policy (id int); alter table rls_fixture_no_policy enable row level security;"]);
    expect(tablesWithNoPolicyOrRlsOff()).toContain("rls_fixture_no_policy");
    psql(["-v", "ON_ERROR_STOP=1", "-c", "drop table rls_fixture_no_policy;"]);
  });

  it("watch it fail first: a fixture table with RLS off entirely is flagged", () => {
    psql(["-v", "ON_ERROR_STOP=1", "-c", "create table rls_fixture_off (id int);"]);
    expect(tablesWithNoPolicyOrRlsOff()).toContain("rls_fixture_off");
    psql(["-v", "ON_ERROR_STOP=1", "-c", "drop table rls_fixture_off;"]);
  });

  it("no policy anywhere names the `anon` role for `scans`", () => {
    const rows = psqlRows(
      `select policyname, roles::text from pg_policies where schemaname = 'public' and tablename = 'scans';`
    );
    for (const [, roles] of rows) {
      expect(roles).not.toContain("anon");
    }
  });
});

describe('BP-002 `## Error & edge behavior` — "A policy that lacks the `deleted_at is null` condition is a CI failure ... the guarantee has one point of failure"', () => {
  it("every request-scoped (`authenticated`) policy carries the `deleted_at is null` condition", () => {
    expect(requestScopedPoliciesMissingDeletedAtCondition()).toEqual([]);
  });

  it("watch it fail first: removing the condition from one policy is caught", () => {
    psql([
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      "drop policy sites_select_own on sites; create policy sites_select_own on sites for select to authenticated using (user_id = auth.uid());",
    ]);
    expect(requestScopedPoliciesMissingDeletedAtCondition()).toContain("sites_select_own");
    // Restore.
    psql([
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `drop policy sites_select_own on sites; create policy sites_select_own on sites for select to authenticated
         using (user_id = auth.uid() and exists (select 1 from users u where u.id = sites.user_id and u.deleted_at is null));`,
    ]);
    expect(requestScopedPoliciesMissingDeletedAtCondition()).toEqual([]);
  });
});

describe("behavioural — a tombstoned account is invisible through the request-scoped client across select, insert, update and delete (ADR-051 point 7)", () => {
  const USER_ID = "aaaaaaaa-0000-0000-0000-000000000001";
  const SITE_ID = "aaaaaaaa-0000-0000-0000-000000000002";
  const SCAN_ID = "aaaaaaaa-0000-0000-0000-000000000003";
  const DRAFT_OPP_ID = "aaaaaaaa-0000-0000-0000-000000000004";
  const DRAFT_ID = "aaaaaaaa-0000-0000-0000-000000000005";
  const DEST_ID = "aaaaaaaa-0000-0000-0000-000000000006";
  const LEAD_ID = "aaaaaaaa-0000-0000-0000-000000000007";
  const PUB_ID = "aaaaaaaa-0000-0000-0000-000000000008";

  beforeAll(() => {
    psql([
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `
      insert into users (id, email, plan_status) values ('${USER_ID}', 'owner@example.com', 'active');
      insert into sites (id, user_id, domain) values ('${SITE_ID}', '${USER_ID}', 'example.com');
      insert into scans (id, site_id, domain, tier, status) values ('${SCAN_ID}', '${SITE_ID}', 'example.com', 'free', 'done');
      insert into opportunities (id, site_id, scan_id, type, family, target_query, proposed_slug, title)
        values ('${DRAFT_OPP_ID}', '${SITE_ID}', '${SCAN_ID}', 't', 'f', 'q', 's', 'title');
      insert into drafts (id, opportunity_id, site_id, state, title)
        values ('${DRAFT_ID}', '${DRAFT_OPP_ID}', '${SITE_ID}', 'drafting', 'title');
      insert into publications (id, draft_id, site_id, destination, mode)
        values ('${PUB_ID}', '${DRAFT_ID}', '${SITE_ID}', 'hosted', 'autopilot');
      insert into destinations (id, site_id, kind) values ('${DEST_ID}', '${SITE_ID}', 'hosted');
      insert into leads (id, scan_id, email) values ('${LEAD_ID}', '${SCAN_ID}', 'lead@example.com');
      `,
    ]);
  });

  it("sanity: before tombstoning, the owner's client can read their own site", async () => {
    const client = asUser(userJwt(USER_ID));
    const { data, error } = await client.from("sites").select("id").eq("id", SITE_ID);
    expect(error).toBeNull();
    expect(data).toEqual([{ id: SITE_ID }]);
  });

  it("tombstones the fixture user", () => {
    psql(["-v", "ON_ERROR_STOP=1", "-c", `update users set deleted_at = now() where id = '${USER_ID}';`]);
    const rows = psqlRows(`select deleted_at is not null from users where id = '${USER_ID}';`);
    expect(rows[0]?.[0]).toBe("t");
  });

  it("select: every owned table returns zero rows through the request-scoped client", async () => {
    const client = asUser(userJwt(USER_ID));
    for (const table of EIGHT_TABLES) {
      const { data, error } = await client.from(table).select("id");
      expect(error, `${table} select should not error`).toBeNull();
      expect(data, `${table} should be invisible`).toEqual([]);
    }
  });

  it("insert: a new destination for the tombstoned owner's site is rejected", async () => {
    const client = asUser(userJwt(USER_ID));
    const { error, status } = await client
      .from("destinations")
      .insert({ site_id: SITE_ID, kind: "wordpress" });
    expect(error).not.toBeNull();
    expect(status).toBe(403);
  });

  it("update: the tombstoned owner cannot change their site's domain", async () => {
    const client = asUser(userJwt(USER_ID));
    const { data, error } = await client
      .from("sites")
      .update({ domain: "changed.example.com" })
      .eq("id", SITE_ID)
      .select();
    expect(error).toBeNull();
    expect(data).toEqual([]);
    const rows = psqlRows(`select domain from sites where id = '${SITE_ID}';`);
    expect(rows[0]?.[0]).toBe("example.com"); // unchanged
  });

  it("update: the tombstoned owner cannot edit their own draft", async () => {
    const client = asUser(userJwt(USER_ID));
    const { data, error } = await client
      .from("drafts")
      .update({ title: "edited" })
      .eq("id", DRAFT_ID)
      .select();
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("delete: the tombstoned owner cannot remove their own destination", async () => {
    const client = asUser(userJwt(USER_ID));
    const { data, error } = await client.from("destinations").delete().eq("id", DEST_ID).select();
    expect(error).toBeNull();
    expect(data).toEqual([]);
    const rows = psqlRows(`select 1 from destinations where id = '${DEST_ID}';`);
    expect(rows).toHaveLength(1); // still there
  });

  it('BP-002 `## Error & edge behavior` — "`dbAdmin()` bypasses RLS by design and is the narrow, named exception BP-063\'s deletion mail and the purge reach through" — the service-role client still reads the tombstoned user\'s rows', async () => {
    const { data, error } = await dbAdmin().from("sites").select("id").eq("id", SITE_ID);
    expect(error).toBeNull();
    expect(data).toEqual([{ id: SITE_ID }]);
  });
});

describe('BP-002 `## Error & edge behavior` — "The public report is served by `dbAdmin()` from the server, never by an anon read of `scans`"', () => {
  it("an anon-key select on `scans` returns zero rows and no error", async () => {
    const { data, error } = await db().from("scans").select("id, cost_cents, report");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
