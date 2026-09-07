// tests/publish/publishable/schema.test.ts — the columns the veto leaf
// writes, and the two statements it depends on.
//
// **Promoted to a live-schema suite (issue #78, via #6).** Every assertion
// here used to be against the migration *text*, because a line in
// `LIVE_SCHEMA_TESTS` (`vitest.config.ts`) was the owner's to add and a
// feature PR could not add it. Issue #6 owns that file: the baseline plus
// `*_sites_timezone_column*`, `*_drafts_core*`, `*_drafts_veto*` and
// `*_sites_settings*` are applied to the scratch database, and the two
// functions are now called rather than read.
//
// **Run this file with `--no-file-parallelism`** alongside the rest of the
// `db` project — every file in it resets and rebuilds the same physical
// `public` schema.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { topicOf } from "@/lib/db/topics";

const DB_HOST = "127.0.0.1";
const DB_PORT = "5432";
const DB_USER = "reachkit";
const DB_PASSWORD = "reachkit";
const DB_NAME = process.env.REACHKIT_DB_NAME ?? "reachkit_scratch";
const MIGRATIONS = path.resolve(import.meta.dirname, "../../../supabase/migrations");
const DRAFTS_VETO = "20260906120300_drafts_veto.sql";
const SITES_SETTINGS = "20260906120400_sites_settings.sql";
const APPLIED = [
  "00000000000001_baseline.sql",
  "00000000000004_sites_timezone_column.sql",
  "20260906120000_drafts_core.sql",
  DRAFTS_VETO,
  SITES_SETTINGS,
];

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
let OTHER_SITE_ID = "";
let OPPORTUNITY_ID = "";
let OTHER_OPPORTUNITY_ID = "";

function makeSite(email: string, domain: string): { siteId: string; opportunityId: string } {
  const [user] = psqlRows(`insert into users (email, plan_status) values ('${email}', 'active') returning id;`);
  const [site] = psqlRows(
    `insert into sites (user_id, domain) values ('${user?.[0]}', '${domain}') returning id;`
  );
  const [scan] = psqlRows(
    `insert into scans (site_id, domain, tier, status) values ('${site?.[0]}', '${domain}', 'deep', 'done') returning id;`
  );
  const [opportunity] = psqlRows(
    `insert into opportunities (site_id, scan_id, type, family, target_query, proposed_slug, title) values (` +
      `'${site?.[0]}', '${scan?.[0]}', 'answer_page', 'write', 'a query', 'a-slug', 'A title') returning id;`
  );
  return { siteId: site?.[0] ?? "", opportunityId: opportunity?.[0] ?? "" };
}

beforeAll(() => {
  resetSchema();
  for (const file of APPLIED) psql(["-v", "ON_ERROR_STOP=1", "-f", path.join(MIGRATIONS, file)]);
  const mine = makeSite("veto@example.com", "veto.example.com");
  const theirs = makeSite("other@example.com", "other.example.com");
  SITE_ID = mine.siteId;
  OPPORTUNITY_ID = mine.opportunityId;
  OTHER_SITE_ID = theirs.siteId;
  OTHER_OPPORTUNITY_ID = theirs.opportunityId;
  if (!SITE_ID || !OTHER_SITE_ID) throw new Error("fixture rows returned no id");
});

afterAll(() => {
  resetSchema();
});

/** A draft on the fixture site, in `in_review` unless told otherwise. */
function insertDraft(opts: { state?: string; other?: boolean; columns?: Record<string, string> } = {}): string {
  const { state = "in_review", other = false, columns = {} } = opts;
  const names = ["opportunity_id", "site_id", "state", "title", ...Object.keys(columns)];
  const values = [
    `'${other ? OTHER_OPPORTUNITY_ID : OPPORTUNITY_ID}'`,
    `'${other ? OTHER_SITE_ID : SITE_ID}'`,
    `'${state}'`,
    "'A page'",
    ...Object.values(columns),
  ];
  const [row] = psqlRows(
    `insert into drafts (${names.join(", ")}) values (${values.join(", ")}) returning id;`
  );
  const id = row?.[0];
  if (!id) throw new Error("draft insert returned no id");
  return id;
}

function columnOf(table: string, column: string): string[] {
  const [row] = psqlRows(
    `select data_type, is_nullable from information_schema.columns ` +
      `where table_schema = 'public' and table_name = '${table}' and column_name = '${column}';`
  );
  return row ?? [];
}

/** Does the named function's body contain `fragment`? Asked as a boolean:
 *  `prosrc` spans lines and carries `|`, which `psqlRows` splits on. */
function bodyContains(fn: string, fragment: string): boolean {
  const [row] = psqlRows(
    `select bool_or(p.prosrc like '%${fragment}%') from pg_proc p ` +
      `join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = '${fn}';`
  );
  return row?.[0] === "t";
}

describe("the migrations carry their own sub-tokens", () => {
  it("`drafts_veto` is the veto leaf's, not the state machine's", () => {
    expect(topicOf(DRAFTS_VETO)).toEqual({ token: "drafts_veto", owner: "BP-046" });
  });

  it("`sites_settings` is the settings leaf's", () => {
    expect(topicOf(SITES_SETTINGS)).toEqual({ token: "sites_settings", owner: "BP-057" });
  });
});

describe("the approval, the telling and the token are columns on `drafts`", () => {
  it.each([
    ["approved_at", "timestamp with time zone"],
    ["approved_by", "jsonb"],
    ["told", "jsonb"],
    ["veto_token_hash", "text"],
    ["veto_token_expires_at", "timestamp with time zone"],
    ["veto_token_used_at", "timestamp with time zone"],
  ])("adds `%s`, nullable", (column, type) => {
    expect(columnOf("drafts", column)).toEqual([type, "YES"]);
  });

  it("the token column holds a hash, and no column holds the token itself", () => {
    expect(columnOf("drafts", "veto_token")).toEqual([]);
  });

  it("two drafts cannot share a token, and any number may hold none", () => {
    insertDraft({ columns: { veto_token_hash: "'shared-hash'" } });
    expect(raises(`insert into drafts (opportunity_id, site_id, state, title, veto_token_hash) values ('${OPPORTUNITY_ID}', '${SITE_ID}', 'in_review', 'A page', 'shared-hash');`)).toBe(
      true
    );
    // The index is partial: a draft with no link is not a draft sharing one.
    expect(() => insertDraft()).not.toThrow();
    expect(() => insertDraft()).not.toThrow();
  });
});

describe("the redemption is one statement", () => {
  it("it marks the token used in the same statement that reads it, so a double click cannot skip twice", () => {
    const id = insertDraft({
      columns: {
        veto_token_hash: "'redeem-once'",
        veto_token_expires_at: "now() + interval '1 hour'",
      },
    });
    const first = psqlRows(`select draft_id, state from redeem_veto_token('redeem-once', now());`);
    expect(first).toEqual([[id, "in_review"]]);
    // The second click redeems nothing: the row no longer matches.
    expect(psqlRows(`select count(*) from redeem_veto_token('redeem-once', now());`)).toEqual([["0"]]);
    expect(psqlRows(`select veto_token_used_at is null from drafts where id = '${id}';`)).toEqual([["f"]]);
  });

  it("it refuses an expired token", () => {
    insertDraft({
      columns: {
        veto_token_hash: "'redeem-expired'",
        veto_token_expires_at: "now() - interval '1 second'",
      },
    });
    expect(psqlRows(`select count(*) from redeem_veto_token('redeem-expired', now());`)).toEqual([["0"]]);
    expect(
      psqlRows(`select veto_token_used_at is null from drafts where veto_token_hash = 'redeem-expired';`)
    ).toEqual([["t"]]);
  });

  it("it moves no page — the `in_review → skipped` move stays `transition()`'s", () => {
    const id = insertDraft({
      columns: {
        veto_token_hash: "'redeem-no-move'",
        veto_token_expires_at: "now() + interval '1 hour'",
      },
    });
    psql(["-v", "ON_ERROR_STOP=1", "-c", `select * from redeem_veto_token('redeem-no-move', now());`]);
    expect(psqlRows(`select state from drafts where id = '${id}';`)).toEqual([["in_review"]]);
    expect(bodyContains("redeem_veto_token", "skipped")).toBe(false);
  });

  it("it compares a hash the caller computed, so no token reaches the database", () => {
    const [row] = psqlRows(
      `select pg_get_function_arguments(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace ` +
        `where n.nspname = 'public' and p.proname = 'redeem_veto_token';`
    );
    expect(row?.[0]).toContain("p_token_hash text");
  });
});

describe("the settings save is one statement", () => {
  /** `save_publishing_settings`, called the way the settings leaf calls it. */
  function save(opts: { siteId?: string; drafts: string }): string {
    const { siteId = SITE_ID, drafts } = opts;
    const [row] = psqlRows(
      `select save_publishing_settings('${siteId}'::uuid, 'copilot', 6, '07:30'::time, 'Europe/London', '${drafts}'::jsonb);`
    );
    return row?.[0] ?? "";
  }

  it("it writes the four values and the drafts' deadlines in one call", () => {
    const id = insertDraft({ columns: { told: `'{"kind":"first"}'::jsonb` } });
    const touched = save({
      drafts: `[{"draft_id":"${id}","veto_deadline":"2026-10-01T09:00:00Z","clear_told":false}]`,
    });
    expect(touched).toBe("1");
    expect(psqlRows(`select mode, veto_hours, publish_time, timezone from sites where id = '${SITE_ID}';`)).toEqual([
      ["copilot", "6", "07:30:00", "Europe/London"],
    ]);
    expect(psqlRows(`select veto_deadline at time zone 'UTC' from drafts where id = '${id}';`)).toEqual([
      ["2026-10-01 09:00:00"],
    ]);
  });

  it("it clears the telling rather than sending one, and only where the caller said to", () => {
    const kept = insertDraft({ columns: { told: `'{"kind":"kept"}'::jsonb` } });
    const cleared = insertDraft({ columns: { told: `'{"kind":"cleared"}'::jsonb` } });
    save({
      drafts:
        `[{"draft_id":"${kept}","veto_deadline":"2026-10-02T09:00:00Z","clear_told":false},` +
        `{"draft_id":"${cleared}","veto_deadline":"2026-10-02T09:00:00Z","clear_told":true}]`,
    });
    expect(psqlRows(`select told ->> 'kind' from drafts where id = '${kept}';`)).toEqual([["kept"]]);
    expect(psqlRows(`select coalesce(told ->> 'kind', 'null') from drafts where id = '${cleared}';`)).toEqual([
      ["null"],
    ]);
  });

  it("it re-implements none of REQ-073 c4's rules — the deadlines arrive computed", () => {
    // The four rules live in `newVetoDeadline`. A second copy in PL/pgSQL
    // is the copy that drifts; the function names no mode and no window.
    expect(bodyContains("save_publishing_settings", "copilot")).toBe(false);
    expect(bodyContains("save_publishing_settings", "autopilot")).toBe(false);
    expect(bodyContains("save_publishing_settings", "interval ''")).toBe(false);
  });

  it("it adds no column — all four already exist", () => {
    // The one assertion here that stays textual: "this migration adds
    // nothing" is a property of the file, and a schema query cannot
    // distinguish a column this migration added from one the baseline did.
    const sql = readFileSync(path.join(MIGRATIONS, SITES_SETTINGS), "utf8");
    expect(sql).not.toContain("add column");
  });

  it("it never reaches a draft belonging to another site", () => {
    const theirs = insertDraft({ other: true, columns: { told: `'{"kind":"theirs"}'::jsonb` } });
    const touched = save({
      drafts: `[{"draft_id":"${theirs}","veto_deadline":"2026-10-03T09:00:00Z","clear_told":true}]`,
    });
    expect(touched).toBe("0");
    expect(psqlRows(`select told ->> 'kind' from drafts where id = '${theirs}';`)).toEqual([["theirs"]]);
    expect(psqlRows(`select veto_deadline is null from drafts where id = '${theirs}';`)).toEqual([["t"]]);
  });
});
