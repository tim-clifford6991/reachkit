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
