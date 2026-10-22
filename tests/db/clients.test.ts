// tests/db/clients.test.ts
//
// BP-002: exactly two clients (`db`, `dbAdmin`), `dbAdmin()` refuses to run
// where `window` exists, the per-request and singleton lifetimes, and the
// generated types match a fresh generation against the applied schema.
// The lexical halves are lint rules in eslint.config.mjs:
// `local/no-create-client-outside-db`, `local/no-db-admin-in-client` and
// `local/db-logs-no-rows` (tests/build/lint/source-rules.test.ts).
//
// `structure.md` rule 4: tests live beside the module they exercise —
// `tests/db/**` is BP-002's.
//
// **Run this file, `baseline.test.ts` and `rls.test.ts` with
// `--no-file-parallelism`** — see `baseline.test.ts`'s header for why.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DB_HOST,
  DB_NAME,
  DB_PASSWORD,
  DB_PORT,
  DB_USER,
  REST_URL,
  psql,
} from "./substrate";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const TYPES_FILE_PATH = path.join(REPO_ROOT, "src/lib/db/types.generated.ts");

const MIGRATIONS = [
  path.join(REPO_ROOT, "supabase/migrations/00000000000001_baseline.sql"),
  path.join(REPO_ROOT, "supabase/migrations/00000000000002_rls.sql"),
];
// The generator `supabase gen types typescript --local` shells out to,
// asked directly. Issue #6 moved this script into the repository
// (`scripts/db-substrate/`) so CI can run this row too; it was an absolute
// path outside the tree while the substrate was one machine's fixture.
const GEN_TYPES_SCRIPT = path.join(REPO_ROOT, "scripts/db-substrate/gen-types.sh");

function resetAndApplySchema(): void {
  psql([
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    "drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role;",
  ]);
  for (const file of MIGRATIONS) psql(["-v", "ON_ERROR_STOP=1", "-f", file]);
}

function generateTypes(): string {
  return execFileSync("bash", [GEN_TYPES_SCRIPT], {
    cwd: path.dirname(GEN_TYPES_SCRIPT),
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
}

/** The checked-in file's body, stripped of the hand-written header comment
 * (everything from the first `export type Json` line on) — the part a
 * fresh generation actually reproduces. */
function checkedInBody(): string {
  const full = readFileSync(TYPES_FILE_PATH, "utf8");
  const marker = "export type Json";
  const index = full.indexOf(marker);
  if (index === -1) throw new Error(`${TYPES_FILE_PATH}: no "${marker}" marker found`);
  return full.slice(index);
}

function normalize(text: string): string {
  return text.trim().replace(/\r\n/g, "\n");
}

// A complete, validly-shaped set of the bindings `env.ts` requires (BP-005,
// moved onto decision 6) — none of these tests execute a query, so the
// three Supabase bindings need only be syntactically valid, not reachable.
// `DATABASE_URL` is no longer a member of `Env` (decision 6c) but stays in
// this fixture: this file reads it for its own `pg` connection.
const ENV_FIXTURE: Record<string, string> = {
  DATABASE_URL: `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`,
  SUPABASE_URL: REST_URL,
  SUPABASE_ANON_KEY: "anon-key-fixture",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key-fixture",
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

let dbIndexModule: typeof import("../../src/lib/db/index");

beforeAll(async () => {
  for (const [key, value] of Object.entries(ENV_FIXTURE)) process.env[key] = value;
  dbIndexModule = await import("../../src/lib/db/index");
});

describe('BP-002 responsibility — "expose exactly two clients … so no other module chooses how it reaches the database"', () => {
  it("the module's exported (runtime) value set is exactly db and dbAdmin", () => {
    // `export type { Database } from './types.generated'` is type-only and
    // carries no runtime property — the compiled namespace object holds
    // only the two functions.
    expect(Object.keys(dbIndexModule).sort()).toEqual(["db", "dbAdmin"]);
    expect(typeof dbIndexModule.db).toBe("function");
    expect(typeof dbIndexModule.dbAdmin).toBe("function");
  });
});

describe('BP-002 error behaviour — "A `dbAdmin()` import from a client component is a build error, not a runtime one." — runtime half', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // TST-004 Deviation 1: `env.ts` (BP-005/WO-005) carries its own,
  // independent `SUPABASE_SERVICE_ROLE_KEY` guard whose message also
  // contains the substring "server-only" — `dbAdmin()` reads
  // `env.SUPABASE_SERVICE_ROLE_KEY` (renamed by WO-284, BP-005 decision 6a)
  // in the same function body, so a bare `/server-only/` match does not
  // discriminate removal of *this* guard: the throw would still come from
  // `env.ts` and still satisfy that regex. Both assertions below match only
  // the substring unique to `dbAdmin()`'s own message (see `src/lib/db/
  // index.ts`), so deleting `dbAdmin()`'s `typeof window` check fails these
  // tests even though `env.ts`'s guard still throws on the same call.
  const DB_ADMIN_OWN_MESSAGE = "dbAdmin() is server-only and cannot be evaluated in a client bundle.";

  it("dbAdmin() throws when evaluated where window exists", () => {
    vi.stubGlobal("window", {});
    expect(() => dbIndexModule.dbAdmin()).toThrow(DB_ADMIN_OWN_MESSAGE);
  });

  it("dbAdmin() does not throw outside a client bundle", () => {
    expect(() => dbIndexModule.dbAdmin()).not.toThrow();
  });
});

describe('BP-002 NFR budget — "the request-scoped client per request, the admin client as a module singleton in server code only"', () => {
  it("two db() calls yield two distinct clients", () => {
    const a = dbIndexModule.db();
    const b = dbIndexModule.db();
    expect(a).not.toBe(b);
  });

  it("two dbAdmin() calls yield the same singleton client", () => {
    const a = dbIndexModule.dbAdmin();
    const b = dbIndexModule.dbAdmin();
    expect(a).toBe(b);
  });
});

describe('BP-002 public interface — "export type { Database } from \'./types.generated\'" — staleness check', () => {
  beforeAll(() => {
    resetAndApplySchema();
  });

  afterAll(() => {
    resetAndApplySchema();
    psql([
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      "drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role;",
    ]);
  });

  it("matches a fresh generation against the applied schema", () => {
    const fresh = generateTypes();
    expect(normalize(fresh)).toEqual(normalize(checkedInBody()));
  });

  it("watch it fail first: a column added without regenerating types is caught", () => {
    psql(["-v", "ON_ERROR_STOP=1", "-c", "alter table users add column temp_wo267_fixture_column text;"]);
    const fresh = generateTypes();
    expect(normalize(fresh)).not.toEqual(normalize(checkedInBody()));
    // Restore.
    psql(["-v", "ON_ERROR_STOP=1", "-c", "alter table users drop column temp_wo267_fixture_column;"]);
    const restored = generateTypes();
    expect(normalize(restored)).toEqual(normalize(checkedInBody()));
  });

  it("the checked-in file states it was generated by postgres-meta, not the Supabase CLI (rule 1.2 — never claim the CLI ran)", () => {
    expect(existsSync(TYPES_FILE_PATH)).toBe(true);
    const fullFile = readFileSync(TYPES_FILE_PATH, "utf8");
    expect(fullFile).toMatch(/postgres-meta/);
    expect(fullFile).not.toMatch(/supabase gen types typescript --local` did run|the CLI ran/);
  });
});
