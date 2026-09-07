// BUILD §7, §10 — the invariants the schema holds, asserted against the
// applied schema.
//
// **Promoted to a live-schema suite (issue #78, via #6).** These were
// ordinarily database tests — create a row, watch the constraint refuse it
// — written as substring assertions over the migration text only because
// `vitest.config.ts`'s `LIVE_SCHEMA_TESTS` was an owner file a feature PR
// could not add a row to. Issue #6 owns that file and adds the row, so the
// baseline plus `*_opportunities_core*.sql` and `*_opportunities_supply*.sql`
// are applied to the scratch database and every invariant below is now
// proved by Postgres refusing the row, not by the constraint being spelled
// somewhere.
//
// **Run this file with `--no-file-parallelism`** alongside the rest of the
// `db` project — every file in it resets and rebuilds the same physical
// `public` schema.
import "./env";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { topicOf } from "../../src/lib/db/topics";
import { FAMILY_OF, OPPORTUNITY_TYPES } from "../../src/lib/opportunities/types";

const DB_HOST = "127.0.0.1";
const DB_PORT = "5432";
const DB_USER = "reachkit";
const DB_PASSWORD = "reachkit";
const DB_NAME = "reachkit_scratch";
const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const MIGRATIONS = path.join(REPO_ROOT, "supabase/migrations");
const CORE = "20260906090000_opportunities_core.sql";
const SUPPLY = "20260906090100_opportunities_supply.sql";
const BASELINE_MIGRATION = path.join(MIGRATIONS, "00000000000001_baseline.sql");

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
let SCAN_ID = "";

beforeAll(() => {
  resetSchema();
  psql(["-v", "ON_ERROR_STOP=1", "-f", BASELINE_MIGRATION]);
  psql(["-v", "ON_ERROR_STOP=1", "-f", path.join(MIGRATIONS, CORE)]);
  psql(["-v", "ON_ERROR_STOP=1", "-f", path.join(MIGRATIONS, SUPPLY)]);
  const [user] = psqlRows(
    `insert into users (email, plan_status) values ('opps@example.com', 'active') returning id;`
  );
  const [site] = psqlRows(
    `insert into sites (user_id, domain) values ('${user?.[0]}', 'opps.example.com') returning id;`
  );
  const [scan] = psqlRows(
    `insert into scans (domain, tier, status) values ('opps.example.com', 'deep', 'done') returning id;`
  );
  SITE_ID = site?.[0] ?? "";
  SCAN_ID = scan?.[0] ?? "";
  if (!SITE_ID || !SCAN_ID) throw new Error("fixture rows returned no id");
});

afterAll(() => {
  resetSchema();
});

let rowCounter = 0;

type Row = {
  type?: string;
  family?: string;
  targetQuery?: string | null;
  targetRef?: string;
  proposedSlug?: string | null;
  fitBand?: string | null;
  effort?: string;
  evidence?: string | null;
  acceptance?: string | null;
  status?: string;
};

/** The `insert … returning id` for one opportunity, as SQL. Defaults form a
 *  valid Write row; each test varies the one field it is about. */
function insertSql(row: Row): string {
  rowCounter += 1;
  const {
    type = "answer_page",
    family = "write",
    targetQuery = `query ${rowCounter}`,
    targetRef = `ref-${rowCounter}`,
    proposedSlug = `slug-${rowCounter}`,
    fitBand = "winnable",
    effort = "0.50",
    evidence = `{"family":"${family}"}`,
    acceptance = `{"check":"row ${rowCounter}"}`,
    status = "open",
  } = row;
  const sqlText = (value: string | null) => (value === null ? "null" : `'${value.replace(/'/g, "''")}'`);
  return (
    `insert into opportunities (site_id, scan_id, type, family, target_query, target_ref, proposed_slug, ` +
    `fit_band, effort, evidence, acceptance, status) values (` +
    `'${SITE_ID}', '${SCAN_ID}', '${type}', '${family}', ${sqlText(targetQuery)}, '${targetRef}', ` +
    `${sqlText(proposedSlug)}, ${sqlText(fitBand)}, ${effort}, ` +
    `${evidence === null ? "null" : `'${evidence}'::jsonb`}, ` +
    `${acceptance === null ? "null" : `'${acceptance}'::jsonb`}, '${status}') returning id`
  );
}

/** Inserts a row and returns whether the database refused it. */
function refuses(row: Row): boolean {
  return raises(`${insertSql(row)};`);
}

/** Inserts a row that must succeed, returning its id. */
function insert(row: Row): string {
  const [out] = psqlRows(`${insertSql(row)};`);
  const id = out?.[0];
  if (!id) throw new Error("opportunity insert returned no id");
  return id;
}

/** A row of the given family, with the fields that family requires. */
function familyRow(type: string, extra: Row = {}): Row {
  const family = FAMILY_OF[type as keyof typeof FAMILY_OF];
  return {
    type,
    family,
    targetQuery: family === "fix" ? null : `query ${type}`,
    fitBand: family === "fix" ? null : "winnable",
    proposedSlug: family === "write" ? `slug-${type}` : null,
    evidence: `{"family":"${family}"}`,
    ...extra,
  };
}

describe("ARCHITECTURE rule 6: migrations are topic-prefixed and topic-owned", () => {
  it("both files resolve to the opportunities sub-tokens and to no other topic", () => {
    expect(topicOf(CORE)).toEqual({ token: "opportunities_core", owner: "BP-040" });
    expect(topicOf(SUPPLY)).toEqual({ token: "opportunities_supply", owner: "BP-041" });
  });
});

describe("§7: the eight kinds and the three families are closed in the schema", () => {
  it("every type in the enum is admitted, and a ninth is refused", () => {
    for (const type of OPPORTUNITY_TYPES) {
      expect(refuses(familyRow(type)), `${type} was refused`).toBe(false);
    }
    expect(refuses(familyRow("answer_page", { type: "reword_page" }))).toBe(true);
  });

  it("the family column names exactly the three families", () => {
    expect(refuses({ family: "rewrite", evidence: '{"family":"rewrite"}' })).toBe(true);
  });

  it("the stored family is a constrained mirror of the type-to-family map", () => {
    // The map is the source of truth; the constraint is the mirror. A type
    // stored under any other family is refused, so the two cannot diverge.
    for (const type of OPPORTUNITY_TYPES) {
      const right = FAMILY_OF[type];
      for (const wrong of ["write", "improve", "fix"] as const) {
        if (wrong === right) continue;
        expect(
          refuses(familyRow(type, { family: wrong, evidence: `{"family":"${wrong}"}` })),
          `${type} stored as ${wrong} was admitted`
        ).toBe(true);
      }
    }
  });

  it("the evidence blob's discriminator must equal the row's family", () => {
    expect(refuses(familyRow("answer_page", { evidence: '{"family":"improve"}' }))).toBe(true);
    expect(refuses(familyRow("answer_page", { evidence: '{"family":"write"}' }))).toBe(false);
  });
});

describe("§7: `unblock` is instruction-shaped in the schema, not by convention", () => {
  it("a Fix row has no search and no band, and every other row has both", () => {
    expect(refuses(familyRow("unblock", { fitBand: "winnable" }))).toBe(true);
    expect(refuses(familyRow("unblock", { targetQuery: "some query" }))).toBe(true);
    expect(refuses(familyRow("expand_page", { fitBand: null }))).toBe(true);
    expect(refuses(familyRow("expand_page", { targetQuery: null }))).toBe(true);
  });

  it("the band column is closed to the three winnability handles", () => {
    for (const band of ["winnable", "reach", "not-yet"]) {
      expect(refuses(familyRow("answer_page", { fitBand: band })), band).toBe(false);
    }
    expect(refuses(familyRow("answer_page", { fitBand: "maybe" }))).toBe(true);
  });

  it("only a Write row proposes a slug", () => {
    expect(refuses(familyRow("expand_page", { proposedSlug: "slug-improve" }))).toBe(true);
    expect(refuses(familyRow("answer_page", { proposedSlug: null }))).toBe(true);
  });
});

describe("§7: the acceptance test is written once", () => {
  it("a before-update trigger refuses any change to it", () => {
    const id = insert(
      familyRow("answer_page", { targetRef: "acceptance-immutable", acceptance: '{"check":"written once"}' })
    );
    expect(raises(`update opportunities set acceptance = '{"check":"rewritten"}'::jsonb where id = '${id}';`)).toBe(
      true
    );
    // Everything else on the row still updates — the trigger guards the one
    // column and not the row.
    expect(raises(`update opportunities set status = 'queued' where id = '${id}';`)).toBe(false);
    expect(psqlRows(`select acceptance ->> 'check' from opportunities where id = '${id}';`)).toEqual([
      ["written once"],
    ]);
  });

  it("the invariant is the schema's, and no module in the engine restates it", () => {
    // Application-level guarding here would be a second home for the rule
    // and would not bind a hand-written update.
    const engine = path.join(REPO_ROOT, "src/lib/opportunities");
    const sources = readAllTs(engine);
    for (const [file, text] of sources) {
      expect(text, `${file} appears to re-implement acceptance immutability`).not.toMatch(
        /acceptance\s*!==?\s*.*acceptance/
      );
    }
  });

  it("acceptance and evidence cannot be null", () => {
    expect(refuses(familyRow("answer_page", { evidence: null }))).toBe(true);
    expect(refuses(familyRow("answer_page", { acceptance: null }))).toBe(true);
  });
});

describe("de-duplication is the index's, and it survives a null search", () => {
  it("the partial unique index covers open and queued rows only", () => {
    const shape: Row = { targetRef: "dedupe-ref", targetQuery: "dedupe query" };
    expect(refuses(familyRow("answer_page", shape))).toBe(false);
    expect(refuses(familyRow("answer_page", shape))).toBe(true);
    // Closed rows are outside the predicate: the same target may be
    // recorded again once the open one is done or dismissed.
    expect(refuses(familyRow("answer_page", { ...shape, status: "done" }))).toBe(false);
    expect(refuses(familyRow("answer_page", { ...shape, status: "dismissed" }))).toBe(false);
  });

  it("a null target_query is coalesced, so two instructions cannot both be admitted", () => {
    // Nulls are distinct in a unique index; without the coalesce the Fix
    // family would de-duplicate against nothing.
    const shape: Row = { targetRef: "dedupe-fix-ref" };
    expect(refuses(familyRow("unblock", shape))).toBe(false);
    expect(refuses(familyRow("unblock", shape))).toBe(true);
  });

  it("effort is a number in the unit interval", () => {
    const [row] = psqlRows(
      `select data_type, numeric_precision, numeric_scale from information_schema.columns ` +
        `where table_schema = 'public' and table_name = 'opportunities' and column_name = 'effort';`
    );
    expect(row).toEqual(["numeric", "3", "2"]);
    expect(refuses(familyRow("answer_page", { effort: "1.01" }))).toBe(true);
    expect(refuses(familyRow("answer_page", { effort: "-0.01" }))).toBe(true);
    expect(refuses(familyRow("answer_page", { effort: "1.00" }))).toBe(false);
    expect(refuses(familyRow("answer_page", { effort: "0" }))).toBe(false);
  });
});

describe("the supply migration adds one column and no counter", () => {
  it("`status_changed_at` and its trigger, and nothing else", () => {
    const [row] = psqlRows(
      `select data_type, is_nullable from information_schema.columns ` +
        `where table_schema = 'public' and table_name = 'opportunities' and column_name = 'status_changed_at';`
    );
    expect(row).toEqual(["timestamp with time zone", "NO"]);
    const columns = psqlRows(
      `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'opportunities';`
    ).map(([name]) => name);
    expect(columns).not.toContain("supply_depth");
    expect(
      psqlRows(`select matviewname from pg_matviews where schemaname = 'public';`)
    ).toEqual([]);
  });

  it("the column moves only when the status does", () => {
    const id = insert(familyRow("answer_page", { targetRef: "status-clock" }));
    const before = psqlRows(`select status_changed_at from opportunities where id = '${id}';`);

    // An unconditional touch would move the date supply exhaustion is
    // dated from on any update at all.
    psql(["-v", "ON_ERROR_STOP=1", "-c", `update opportunities set volume = 42 where id = '${id}';`]);
    expect(psqlRows(`select status_changed_at from opportunities where id = '${id}';`)).toEqual(before);

    psql(["-v", "ON_ERROR_STOP=1", "-c", `update opportunities set status = 'queued' where id = '${id}';`]);
    expect(psqlRows(`select status_changed_at from opportunities where id = '${id}';`)).not.toEqual(before);
  });
});

function readAllTs(dir: string): [string, string][] {
  const out: [string, string][] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...readAllTs(full));
    else if (entry.endsWith(".ts")) out.push([full, readFileSync(full, "utf8")]);
  }
  return out;
}
