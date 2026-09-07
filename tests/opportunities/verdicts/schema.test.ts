// BUILD §9, §10 — the invariants `page_verdicts` holds, asserted against
// the applied schema.
//
// **Promoted to a live-schema suite (issue #78, via #6).** These were
// ordinarily database tests — insert the second row for a week, watch the
// unique index refuse it — written as substring assertions over the
// migration text only because `vitest.config.ts`'s `LIVE_SCHEMA_TESTS` was
// an owner file a feature PR could not add a row to. Issue #6 owns that
// file and adds the row, so the baseline, `00000000000002_rls.sql` (the
// policy below reads `users.deleted_at`) and
// `*_opportunities_verdicts*.sql` are applied to the scratch database, and
// Postgres refusing the row is now the assertion.
//
// **Run this file with `--no-file-parallelism`** alongside the rest of the
// `db` project — every file in it resets and rebuilds the same physical
// `public` schema.
import "../env";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { topicOf } from "../../../src/lib/db/topics";
import { NOT_JUDGEABLE_CAUSES } from "../../../src/lib/opportunities/verdicts/types";

const DB_HOST = "127.0.0.1";
const DB_PORT = "5432";
const DB_USER = "reachkit";
const DB_PASSWORD = "reachkit";
const DB_NAME = "reachkit_scratch";
const MIGRATIONS = path.resolve(import.meta.dirname, "../../../supabase/migrations");
const FILE = "20260906140000_opportunities_verdicts.sql";
const APPLIED = ["00000000000001_baseline.sql", "00000000000002_rls.sql", FILE];

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
let PUBLICATION_ID = "";
let SECOND_PUBLICATION_ID = "";

function makePublication(slug: string): string {
  const [scan] = psqlRows(
    `insert into scans (site_id, domain, tier, status) values ('${SITE_ID}', 'verdicts.example.com', 'weekly', 'done') returning id;`
  );
  const [opportunity] = psqlRows(
    `insert into opportunities (site_id, scan_id, type, family, target_query, proposed_slug, title) values (` +
      `'${SITE_ID}', '${scan?.[0]}', 'answer_page', 'write', 'q ${slug}', '${slug}', 'T ${slug}') returning id;`
  );
  const [draft] = psqlRows(
    `insert into drafts (opportunity_id, site_id, state, title) values ('${opportunity?.[0]}', '${SITE_ID}', 'published', 'T ${slug}') returning id;`
  );
  const [publication] = psqlRows(
    `insert into publications (draft_id, site_id, destination, mode) values ('${draft?.[0]}', '${SITE_ID}', 'hosted', 'autopilot') returning id;`
  );
  return publication?.[0] ?? "";
}

beforeAll(() => {
  resetSchema();
  for (const file of APPLIED) psql(["-v", "ON_ERROR_STOP=1", "-f", path.join(MIGRATIONS, file)]);
  const [user] = psqlRows(
    `insert into users (email, plan_status) values ('verdicts@example.com', 'active') returning id;`
  );
  const [site] = psqlRows(
    `insert into sites (user_id, domain) values ('${user?.[0]}', 'verdicts.example.com') returning id;`
  );
  SITE_ID = site?.[0] ?? "";
  PUBLICATION_ID = makePublication("first");
  SECOND_PUBLICATION_ID = makePublication("second");
  if (!PUBLICATION_ID || !SECOND_PUBLICATION_ID) throw new Error("fixture rows returned no id");
});

afterAll(() => {
  resetSchema();
});

/** A verdict row, and whether the database refused it. */
function refuses(opts: {
  publicationId?: string;
  weekStart?: string;
  verdict?: string;
  cause?: string | null;
}): boolean {
  const { publicationId = PUBLICATION_ID, weekStart = "2026-09-07", verdict = "working", cause = null } = opts;
  return raises(
    `insert into page_verdicts (publication_id, site_id, week_start, verdict, cause) values (` +
      `'${publicationId}', '${SITE_ID}', '${weekStart}', '${verdict}', ${cause === null ? "null" : `'${cause}'`});`
  );
}

describe("ARCHITECTURE rule 6: the migration is topic-prefixed and topic-owned", () => {
  it("resolves to the opportunities_verdicts sub-token and to no other topic", () => {
    expect(topicOf(FILE)).toEqual({ token: "opportunities_verdicts", owner: "BP-051" });
  });
});

describe("REQ-063 c1: one verdict per page per week", () => {
  it("the unique key is (publication_id, week_start), which is what makes a re-run idempotent", () => {
    expect(refuses({ weekStart: "2026-09-07" })).toBe(false);
    expect(refuses({ weekStart: "2026-09-07", verdict: "too_early" })).toBe(true);
    // The next week, and another page's same week, are both free.
    expect(refuses({ weekStart: "2026-09-14" })).toBe(false);
    expect(refuses({ publicationId: SECOND_PUBLICATION_ID, weekStart: "2026-09-07" })).toBe(false);
  });

  it("week_start is a date — the site-local Monday, never an instant", () => {
    const [row] = psqlRows(
      `select data_type, is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'page_verdicts' and column_name = 'week_start';`
    );
    expect(row).toEqual(["date", "NO"]);
  });
});

describe("REQ-063 c6: the cause is written exactly when the verdict is not_judgeable", () => {
  it("the four verdict values are closed in the schema", () => {
    for (const verdict of ["working", "too_early", "not_working"]) {
      expect(refuses({ weekStart: `2026-10-0${["working", "too_early", "not_working"].indexOf(verdict) + 1}`, verdict })).toBe(false);
    }
    expect(refuses({ weekStart: "2026-10-05", verdict: "not_judgeable", cause: "unpublished" })).toBe(false);
    expect(refuses({ weekStart: "2026-10-06", verdict: "inconclusive" })).toBe(true);
  });

  it("all five causes are closed in the schema, and no sixth is admitted", () => {
    let week = 10;
    for (const cause of NOT_JUDGEABLE_CAUSES) {
      week += 1;
      expect(refuses({ weekStart: `2026-11-${week}`, verdict: "not_judgeable", cause }), cause).toBe(false);
    }
    // The one value that must never appear: `could_not_confirm` is a
    // `VerifyNote` and never a cause (ADR-085 decision 4). A schema that
    // admitted it would make the merge storable.
    expect(refuses({ weekStart: "2026-11-30", verdict: "not_judgeable", cause: "could_not_confirm" })).toBe(true);
  });

  it("the biconditional holds in both directions, so neither a causeless retirement nor a caused verdict is representable", () => {
    expect(refuses({ weekStart: "2026-12-01", verdict: "not_judgeable", cause: null })).toBe(true);
    expect(refuses({ weekStart: "2026-12-02", verdict: "working", cause: "unpublished" })).toBe(true);
  });
});

describe("ADR-071 point 2: two of the four standings have no row shape at all", () => {
  it("neither not_measured nor no_week is storable — their absence is their representation", () => {
    expect(refuses({ weekStart: "2026-12-03", verdict: "not_measured" })).toBe(true);
    expect(refuses({ weekStart: "2026-12-04", verdict: "not_judgeable", cause: "no_week" })).toBe(true);
  });
});

describe("ADR-072 decision 5c: insert-only is a permission, not a convention", () => {
  it("select and insert are granted; update and delete are granted to nobody", () => {
    const grants = psqlRows(
      `select grantee, privilege_type from information_schema.role_table_grants ` +
        `where table_schema = 'public' and table_name = 'page_verdicts' ` +
        `and grantee in ('anon', 'authenticated', 'service_role') order by grantee, privilege_type;`
    );
    expect(grants).toEqual([
      ["anon", "SELECT"],
      ["authenticated", "SELECT"],
      ["service_role", "INSERT"],
      ["service_role", "SELECT"],
    ]);
  });

  it("there is no is_judgeable column, and nothing a writer could clear", () => {
    const columns = psqlRows(
      `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'page_verdicts';`
    ).map(([name]) => name);
    expect(columns.filter((name) => /is_?judgeable/i.test(name ?? ""))).toEqual([]);
  });

  it("row-level security is on and the select policy is site-scoped", () => {
    expect(psqlRows(`select relrowsecurity from pg_class where oid = 'public.page_verdicts'::regclass;`)).toEqual([
      ["t"],
    ]);
    const [policy] = psqlRows(
      `select policyname, cmd from pg_policies where schemaname = 'public' and tablename = 'page_verdicts';`
    );
    expect(policy).toEqual(["page_verdicts_select_own", "SELECT"]);
    // A reader holding no identity sees nothing: `auth.uid()` is null, so
    // the site subquery is empty.
    expect(psqlRows(`set role authenticated; select count(*) from page_verdicts;`)).toEqual([["0"]]);
  });
});

describe("BP-051 decision 1: there is no column anywhere holding one latest verdict per publication", () => {
  it("`publications` carries no verdict column", () => {
    const columns = psqlRows(
      `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'publications';`
    ).map(([name]) => name);
    expect(columns).not.toContain("verdict");
  });
});

describe("the two indexes are the two reads, and no third is written", () => {
  it("one site's week, and one publication's history", () => {
    const indexes = psqlRows(
      `select indexname, indexdef from pg_indexes where schemaname = 'public' and tablename = 'page_verdicts' order by indexname;`
    );
    expect(indexes.map(([name]) => name)).toEqual([
      "page_verdicts_one_per_page_per_week",
      "page_verdicts_pkey",
      "page_verdicts_publication_idx",
      "page_verdicts_site_week_idx",
    ]);
    expect(indexes.find(([name]) => name === "page_verdicts_site_week_idx")?.[1]).toMatch(
      /ON public\.page_verdicts USING btree \(site_id, week_start\)/
    );
    expect(indexes.find(([name]) => name === "page_verdicts_publication_idx")?.[1]).toMatch(
      /ON public\.page_verdicts USING btree \(publication_id, week_start DESC\)/
    );
  });
});
