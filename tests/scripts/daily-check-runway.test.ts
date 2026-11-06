// The daily check's Runway section: a read-only query, one row per set-up site sorted by what is left, and
// "not measured" where the source gave nothing. The classes themselves are proven on a live schema in tests/db/runway.test.ts.
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { RUNWAY_SQL, runwaySection } from "../../scripts/daily-check/runway.mjs";
import { parseRows } from "../../scripts/daily-check/settings-reads.mjs";

const SCRIPT = path.resolve(import.meta.dirname, "../../scripts/daily-check/runway.mjs");

/** What `execute_sql` answers for three sites. Counts arrive as text from Postgres, the classes as an object. */
const THREE_SITES: NonNullable<Parameters<typeof runwaySection>[0]> = [
  { domain: "steady.example", ready_left: "9", drafted_ahead: "2", days_since_first_live: 40, empty_days_7d: {}, supply_short_at: null, supply_short_dry: null },
  {
    domain: "new.example",
    ready_left: "1",
    drafted_ahead: "1",
    days_since_first_live: null,
    empty_days_7d: { grounding_failed: 2, "other: generate:unknown_new": 1 },
    supply_short_at: "2026-11-05T03:00:00+00:00",
    supply_short_dry: "product,asked",
  },
  { domain: "older.example", ready_left: "2", drafted_ahead: "0", days_since_first_live: "45", empty_days_7d: '{"rules": 1}', supply_short_at: null, supply_short_dry: null },
];

describe("RUNWAY_SQL", () => {
  it("is one select statement that writes nothing", () => {
    const sql = RUNWAY_SQL.trim();
    expect(sql.startsWith("select ")).toBe(true);
    expect(sql.indexOf(";")).toBe(sql.length - 1);
    expect(sql).not.toMatch(/\b(insert|update|delete|alter|create|drop|truncate|grant|merge|copy|nextval|setval|set_config|pg_advisory\w*|lo_\w+|dblink\w*)\b/i);
  });

  it("prints itself on --sql", async () => {
    const { stdout } = await promisify(execFile)(process.execPath, [SCRIPT, "--sql"]);
    expect(stdout.trim()).toBe(RUNWAY_SQL);
  });
});

describe("runwaySection", () => {
  it("gives one row a site, least left first, red only for a young site under three, each empty-day class named", () => {
    expect(runwaySection(THREE_SITES)).toBe(
      [
        "### Runway (new-page topics ready, pages drafted ahead, empty days in 7 d)",
        "",
        "| site | ready | drafted ahead | live for | empty days (7 d) | supply short | status |",
        "|---|---|---|---|---|---|---|",
        "| new.example | 1 | 1 | no live page | grounding_failed 2, other: generate:unknown_new 1 | 2026-11-05 (dry: product,asked) | **RED** (< 3 in the first 30 d) |",
        "| older.example | 2 | 0 | 45 d | rules 1 | not measured | WARN (< 7) |",
        "| steady.example | 9 | 2 | 40 d | none | not measured | ok |",
      ].join("\n")
    );
  });

  it("says not measured, never 0, when the source could not be read", () => {
    for (const unread of ["", "relation \"draft_days\" does not exist", "{}"]) {
      const section = runwaySection(parseRows(unread));
      expect(section).toMatch(/not measured: the query did not answer\./);
      expect(section).not.toMatch(/\b0\b|none/);
    }
  });

  it("runs as the daily check calls it: rows on stdin, the section on stdout", async () => {
    const child = promisify(execFile)(process.execPath, [SCRIPT]);
    child.child.stdin?.end(JSON.stringify(THREE_SITES));
    const { stdout } = await child;
    expect(stdout).toContain("| new.example | 1 | 1 | no live page |");
  });
});
