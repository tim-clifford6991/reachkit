// tests/scan/weekly/schema.test.ts — BUILD §11, REQ-065 c1 (issue #41)
//
// `scans.week_start` and the partial unique index that makes a second
// measurement of one site's week unrepresentable.
//
// **Promoted to a live-schema suite (issue #78, via #6).** This file used
// to assert the migration's *text* and record a hand-run transcript in the
// PR body, because `vitest.config.ts`'s `LIVE_SCHEMA_TESTS` — both the `db`
// project's `include` and the `node` project's `exclude` — was an owner
// file a feature PR could not add a row to. Issue #6 owns that file and
// adds the row: the same claims a person typed at `psql` are the
// assertions below, run every time CI runs.
//
// The behaviour that rests on the index — a second claim resolving to
// `already_measured` rather than a second measurement — is asserted
// against the module in `run.test.ts`, with the violation planted at the
// seam. This file is about the constraint itself.
//
// **Run this file with `--no-file-parallelism`** alongside the rest of the
// `db` project — every file in it resets and rebuilds the same physical
// `public` schema.
import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { topicOf } from "../../../src/lib/db/topics";

const DB_HOST = "127.0.0.1";
const DB_PORT = "5432";
const DB_USER = "reachkit";
const DB_PASSWORD = "reachkit";
const DB_NAME = "reachkit_scratch";
const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const MIGRATION_NAME = "20260906120000_scans_weekly.sql";
const MIGRATIONS = path.join(REPO_ROOT, "supabase/migrations");
const BASELINE_MIGRATION = path.join(MIGRATIONS, "00000000000001_baseline.sql");
const FLIP_MIGRATION = path.join(MIGRATIONS, "20260905120000_scans_current_flip.sql");
const FREEPATH_MIGRATION = path.join(MIGRATIONS, "00000000000005_scans_freepath.sql");
const CURRENT_MIGRATION = path.join(MIGRATIONS, "20260904110000_scans_current.sql");
const VERDICT_MIGRATION = path.join(MIGRATIONS, "20260904100000_scans_verdict.sql");
const WEEKLY_MIGRATION = path.join(MIGRATIONS, MIGRATION_NAME);
// The selection below reads two more columns than the index does:
// `sites.timezone` (whose Monday it is) and `users.paid_through` (ADR-050's
// gate). Both are applied so the whole four-predicate selection can run,
// not just the index it rests on.
const TIMEZONE_MIGRATION = path.join(MIGRATIONS, "00000000000004_sites_timezone_column.sql");
const SUBSCRIPTION_MIGRATION = path.join(MIGRATIONS, "20260906120000_users_subscription_columns.sql");

function psql(args: string[]): string {
  return execFileSync("psql", ["-h", DB_HOST, "-p", DB_PORT, "-U", DB_USER, "-d", DB_NAME, "-q", ...args], {
    env: { ...process.env, PGPASSWORD: DB_PASSWORD },
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
}

/** One tuple-only row per line, `|`-separated columns — easy to split. */
function psqlRows(sql: string): string[][] {
  const out = psql(["-v", "ON_ERROR_STOP=1", "-Atc", sql]);
  return out
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => line.split("|"));
}

/** Runs `sql` and returns whether it raised (never throws itself). */
function raises(sql: string): boolean {
  try {
    psql(["-v", "ON_ERROR_STOP=1", "-c", sql]);
    return false;
  } catch {
    return true;
  }
}

function resetSchema(): void {
  psql([
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    "drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role;",
  ]);
}

let SITE_ID = "";

beforeAll(() => {
  resetSchema();
  // The flip migration replaces `store_current_report`, so the migrations
  // it is built on come with it; `week_start` is the last thing applied.
  for (const file of [
    BASELINE_MIGRATION,
    TIMEZONE_MIGRATION,
    SUBSCRIPTION_MIGRATION,
    FREEPATH_MIGRATION,
    CURRENT_MIGRATION,
    VERDICT_MIGRATION,
    FLIP_MIGRATION,
    WEEKLY_MIGRATION,
  ]) {
    psql(["-v", "ON_ERROR_STOP=1", "-f", file]);
  }
  const [user] = psqlRows(
    `insert into users (email, plan_status) values ('weekly@example.com', 'active') returning id;`
  );
  const [site] = psqlRows(
    `insert into sites (user_id, domain) values ('${user?.[0]}', 'weekly.example.com') returning id;`
  );
  SITE_ID = site?.[0] ?? "";
  if (!SITE_ID) throw new Error("fixture site insert returned no id");
});

afterAll(() => {
  resetSchema();
});

/** A claim, the shape the weekly runner writes: site, tier, week. */
function claim(opts: { tier: string; weekStart?: string | null; siteId?: string | null }): boolean {
  const { tier, weekStart = null, siteId = SITE_ID } = opts;
  return raises(
    `insert into scans (site_id, domain, tier, status, week_start) values (` +
      `${siteId === null ? "null" : `'${siteId}'`}, 'weekly.example.com', '${tier}', 'running', ` +
      `${weekStart === null ? "null" : `'${weekStart}'`});`
  );
}

describe("the week a scan belongs to is a calendar date on the row", () => {
  it("`week_start` is a `date`, never a timestamp", () => {
    const [row] = psqlRows(
      `select data_type from information_schema.columns where table_schema = 'public' and table_name = 'scans' and column_name = 'week_start';`
    );
    expect(row).toEqual(["date"]);
  });

  it("is nullable — a free scan has no site and no week, and a deep pass is not a week's measurement", () => {
    const [row] = psqlRows(
      `select is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'scans' and column_name = 'week_start';`
    );
    expect(row).toEqual(["YES"]);
    expect(claim({ tier: "free", siteId: null })).toBe(false);
    expect(claim({ tier: "deep" })).toBe(false);
  });

  it("carries no default: a week is computed in the site's own zone, never by the server's clock", () => {
    const [row] = psqlRows(
      `select coalesce(column_default, 'no default') from information_schema.columns where table_schema = 'public' and table_name = 'scans' and column_name = 'week_start';`
    );
    expect(row).toEqual(["no default"]);
  });
});

describe("the index, not the schedule, is what makes it once a week (ADR-060)", () => {
  it("is unique over the pair, and partial on the weekly tier", () => {
    const [row] = psqlRows(
      `select indexdef from pg_indexes where schemaname = 'public' and indexname = 'scans_one_weekly_per_site_week';`
    );
    expect(row?.[0]).toMatch(
      /CREATE UNIQUE INDEX scans_one_weekly_per_site_week ON public\.scans USING btree \(site_id, week_start\) WHERE \(tier = 'weekly'::text\)/
    );
  });

  it("a second weekly claim for one site's week is refused, and the following week is not", () => {
    expect(claim({ tier: "weekly", weekStart: "2026-09-07" })).toBe(false);
    expect(claim({ tier: "weekly", weekStart: "2026-09-07" })).toBe(true);
    expect(claim({ tier: "weekly", weekStart: "2026-09-14" })).toBe(false);
  });

  it("scopes to weekly, so a domain may still be scanned freely as often as §6.4 allows", () => {
    expect(claim({ tier: "free", siteId: null, weekStart: null })).toBe(false);
    expect(claim({ tier: "free", siteId: null, weekStart: null })).toBe(false);
    expect(claim({ tier: "deep", weekStart: "2026-09-07" })).toBe(false);
    expect(claim({ tier: "deep", weekStart: "2026-09-07" })).toBe(false);
  });

  it("adds no second index on week_start alone — every read of it is keyed by the site", () => {
    const onWeekStart = psqlRows(
      `select indexname from pg_indexes where schemaname = 'public' and tablename = 'scans' and indexdef like '%week_start%';`
    ).map(([name]) => name);
    expect(onWeekStart).toEqual(["scans_one_weekly_per_site_week"]);
  });
});

describe("the week is written once and never recomputed", () => {
  it("the migration adds no writer of its own — the claim insert is the only one", () => {
    const touching = psqlRows(
      `select tgname from pg_trigger t where t.tgrelid = 'public.scans'::regclass and not t.tgisinternal ` +
        `and pg_get_triggerdef(t.oid) like '%week_start%';`
    );
    expect(touching).toEqual([]);
  });

  it("the report-storing function does not touch week_start, so storing a report cannot move a week", () => {
    // Asked as a boolean rather than as the body itself: `prosrc` spans
    // lines and carries `|`, which `psqlRows` splits on.
    const [row] = psqlRows(
      `select count(*), bool_or(p.prosrc like '%week_start%') from pg_proc p ` +
        `join pg_namespace n on n.oid = p.pronamespace ` +
        `where n.nspname = 'public' and p.proname = 'store_current_report';`
    );
    expect(row).toEqual(["1", "f"]);
  });
});

describe("the file is named for the topic that owns it", () => {
  it("resolves to the `scans` topic and to exactly one owner", () => {
    expect(topicOf(MIGRATION_NAME)).toEqual({ token: "scans", owner: "BP-012" });
  });
});

// ── The selection, through the gate billing registers (issue #180) ─────────
//
// The four predicates `dueSites` applies, run against the live schema: a
// stated zone, the site-local Monday hour, no row for the week it is in,
// and **active access**. The fourth is ADR-050's, and until #180 nothing
// registered it — so this is the part that could not be asserted at all,
// against any database, because the selection threw.
//
// `installActiveAccessGate()` is the same call the boot path makes. The
// gate reaches `users.paid_through` through `sites.user_id`, which is why
// this suite applies the subscription columns above; nothing here writes a
// second expression of "active".
//
// **`fetch` is replaced with a loopback-only stand-in**, exactly as
// `tests/db/rls.test.ts` documents: `tests/setup.ts` refuses the real
// globals process-wide, `db()`/`dbAdmin()` take no `fetch` hook, and the
// regex is what keeps this from becoming a general network allowance.
const SUPABASE_URL = "http://127.0.0.1:3001";
const JWT_SECRET = "reachkit-scratch-jwt-secret-at-least-32-chars-long";

function base64url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function signJwt(claims: Record<string, unknown>): string {
  const header = base64url(Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = base64url(Buffer.from(JSON.stringify(claims)));
  const signingInput = `${header}.${payload}`;
  return `${signingInput}.${base64url(createHmac("sha256", JWT_SECRET).update(signingInput).digest())}`;
}

function keyFor(role: string): string {
  return signJwt({ role, iss: "supabase", exp: Math.floor(Date.now() / 1000) + 3600 });
}

function loopbackFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url =
    typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
  if (!/^https?:\/\/127\.0\.0\.1(:\d+)?\//.test(url)) {
    return Promise.reject(new Error(`loopbackFetch refuses non-loopback URL: ${url}`));
  }
  const headerEntries: [string, string][] = [];
  if (init.headers) {
    new Headers(init.headers as HeadersInit).forEach((value, key) => headerEntries.push([key, value]));
  }
  const bodyText = typeof init.body === "string" ? init.body : init.body ? String(init.body) : undefined;
  const args = ["-s", "-i", "-X", init.method ?? "GET"];
  for (const [key, value] of headerEntries) args.push("-H", `${key}: ${value}`);
  if (bodyText !== undefined) args.push("--data-binary", "@-");
  args.push(url);

  const raw = execFileSync("curl", args, { input: bodyText, maxBuffer: 10 * 1024 * 1024 });
  const separator = Buffer.from("\r\n\r\n");
  const separatorIndex = raw.indexOf(separator);
  const headerLines = raw.subarray(0, separatorIndex).toString("utf8").split("\r\n");
  const responseHeaders = new Headers();
  for (const line of headerLines.slice(1)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    responseHeaders.append(line.slice(0, idx).trim(), line.slice(idx + 1).trim());
  }
  return Promise.resolve(
    new Response(raw.subarray(separatorIndex + separator.length), {
      status: Number((headerLines[0] ?? "").split(" ")[1] ?? "599"),
      headers: responseHeaders,
    })
  );
}

const ENV_FIXTURE: Record<string, string> = {
  SUPABASE_URL,
  SUPABASE_ANON_KEY: keyFor("anon"),
  SUPABASE_SERVICE_ROLE_KEY: keyFor("service_role"),
  STRIPE_SECRET_KEY: "sk_test_fixture",
  STRIPE_WEBHOOK_SECRET: "whsec_fixture",
  STRIPE_PRICE_ID: "price_fixture",
  RESEND_API_KEY: "re_fixture",
  DATAFORSEO_LOGIN: "dfs-login-fixture",
  DATAFORSEO_PASSWORD: "dfs-password-fixture",
  ANTHROPIC_API_KEY: "sk-ant-fixture",
  IP_HASH_SALT: "salt-fixture",
  KILL_SWITCH: "false",
  OWNER_EMAILS: "owner@example.com",
  NEXT_PUBLIC_APP_URL: "https://app.example.com",
  HOSTED_EDGE_CNAME_TARGET: "content.example.com",
};

/** A Monday at 06:00 in the site's own zone — `isWeeklyDue`'s hour. */
const MONDAY_0600_UTC = new Date("2026-08-31T06:00:00.000Z");
const ZONE = "UTC";

describe("ADR-050 · issue #180 — the weekly selection decides who pays, through the gate billing registers", () => {
  let dueSites: (typeof import("../../../src/lib/scan/weekly"))["dueSites"];
  let registerActiveAccessGate: (typeof import("../../../src/lib/scan/weekly"))["registerActiveAccessGate"];
  let installActiveAccessGate: (typeof import("../../../src/lib/account/billing"))["installActiveAccessGate"];
  let ActiveAccessGateNotRegistered: (typeof import("../../../src/lib/scan/weekly/access"))["ActiveAccessGateNotRegistered"];

  beforeAll(async () => {
    for (const [key, value] of Object.entries(ENV_FIXTURE)) process.env[key] = value;
    globalThis.fetch = loopbackFetch as unknown as typeof fetch;
    // Imported after `process.env` is populated: `env.ts` parses at module
    // load, so `@/lib/db` cannot be reached before the bindings exist.
    ({ dueSites, registerActiveAccessGate } = await import("../../../src/lib/scan/weekly"));
    ({ installActiveAccessGate } = await import("../../../src/lib/account/billing"));
    ({ ActiveAccessGateNotRegistered } = await import("../../../src/lib/scan/weekly/access"));
  });

  /** One site with a stated zone, whose owner's access runs to `paidThrough`. */
  function givenSite(name: string, paidThrough: string): string {
    const [user] = psqlRows(
      `insert into users (email, plan_status, paid_through) values ('${name}@example.com', 'active', '${paidThrough}') returning id;`
    );
    const [site] = psqlRows(
      `insert into sites (user_id, domain, timezone) values ('${user?.[0]}', '${name}.example.com', '${ZONE}') returning id;`
    );
    return site?.[0] ?? "";
  }

  function clearRows(): void {
    psql(["-v", "ON_ERROR_STOP=1", "-c", "delete from scans; delete from sites; delete from users;"]);
  }

  it("with no gate registered the selection throws rather than guess who pays", async () => {
    clearRows();
    givenSite("paying", "2026-12-31T00:00:00Z");
    registerActiveAccessGate(null);
    await expect(dueSites(MONDAY_0600_UTC)).rejects.toBeInstanceOf(ActiveAccessGateNotRegistered);
  });

  it("selects a paying site and refuses one whose access has ended", async () => {
    clearRows();
    const paying = givenSite("paying", "2026-12-31T00:00:00Z");
    givenSite("ended", "2026-01-01T00:00:00Z");
    await installActiveAccessGate();

    const due = await dueSites(MONDAY_0600_UTC);
    expect(due.map((site) => site.siteId)).toEqual([paying]);
    expect(due[0]).toMatchObject({ domain: "paying.example.com", zone: ZONE, weekStart: "2026-08-31" });
  });

  it("a cancelled customer inside their paid month is still selected — ADR-050 reads one column", async () => {
    clearRows();
    // `plan_status` and `cancelled_at` are on the row precisely so this
    // holds: the gate reads neither (REQ-076 c3).
    const [user] = psqlRows(
      `insert into users (email, plan_status, paid_through, cancelled_at) values ` +
        `('cancelled@example.com', 'canceled', '2026-12-31T00:00:00Z', now()) returning id;`
    );
    const [site] = psqlRows(
      `insert into sites (user_id, domain, timezone) values ('${user?.[0]}', 'cancelled.example.com', '${ZONE}') returning id;`
    );
    await installActiveAccessGate();

    expect((await dueSites(MONDAY_0600_UTC)).map((s) => s.siteId)).toEqual([site?.[0]]);
  });

  it("a week already measured is not selected again, and the gate is still what decided it", async () => {
    clearRows();
    const paying = givenSite("paying", "2026-12-31T00:00:00Z");
    await installActiveAccessGate();
    expect(await dueSites(MONDAY_0600_UTC)).toHaveLength(1);

    psql([
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `insert into scans (site_id, domain, tier, status, week_start) values ` +
        `('${paying}', 'paying.example.com', 'weekly', 'done', '2026-08-31');`,
    ]);
    expect(await dueSites(MONDAY_0600_UTC)).toEqual([]);
  });

  it("a site with no stated zone is never selected, whoever is paying for it", async () => {
    clearRows();
    const [user] = psqlRows(
      `insert into users (email, plan_status, paid_through) values ('nozone@example.com', 'active', '2026-12-31T00:00:00Z') returning id;`
    );
    psql([
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `insert into sites (user_id, domain) values ('${user?.[0]}', 'nozone.example.com');`,
    ]);
    await installActiveAccessGate();
    expect(await dueSites(MONDAY_0600_UTC)).toEqual([]);
  });
});
