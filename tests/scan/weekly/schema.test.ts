// tests/scan/weekly/schema.test.ts — BUILD §11, REQ-065 c1 (issue #41)
//
// `scans.week_start` and the partial unique index that makes a second
// measurement of one site's week unrepresentable.
//
// **Why this file asserts source and not a live schema, flagged once.**
// The live-schema suites are named one by one in `vitest.config.ts`'s
// `LIVE_SCHEMA_TESTS`, which is both the `db` project's `include` and the
// `node` project's `exclude` — a file absent from that list runs under
// `node`, where there is no database, and fails. `vitest.config.ts` is an
// owner file (`CODEOWNERS`) and is not editable from a feature PR, so this
// suite asserts the migration's own text, exactly as
// `tests/db/domainblocks.test.ts` does and for the same reason; the PR
// names the one-line owner change that would promote it. **The migration
// was applied to the native scratch database by hand and the index
// verified there** — a second claim for `(site, 2026-09-07)` raised
// `duplicate key value violates unique constraint
// "scans_one_weekly_per_site_week"`, a claim for the following week was
// accepted, and two free scans (no site, no week) were accepted outside
// the partial index. The transcript is in the PR body.
//
// The behaviour that rests on the index — a second claim resolving to
// `already_measured` rather than a second measurement — is asserted
// against the module in `run.test.ts`, with the violation planted at the
// seam. This file is about the constraint existing at all.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { topicOf } from "../../../src/lib/db/topics";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const MIGRATION_NAME = "20260906120000_scans_weekly.sql";
const MIGRATION = readFileSync(path.join(REPO_ROOT, "supabase/migrations", MIGRATION_NAME), "utf8");
const FLIP = readFileSync(
  path.join(REPO_ROOT, "supabase/migrations/20260905120000_scans_current_flip.sql"),
  "utf8"
);

/** Text with every `--` comment line stripped, so an assertion about what
 *  the schema *does* is never satisfied — or failed — by prose describing
 *  it. */
function statementsOf(sql: string): string {
  return sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

const STATEMENTS = statementsOf(MIGRATION);

describe("the week a scan belongs to is a calendar date on the row", () => {
  it("adds `week_start` as a `date`, never a timestamp", () => {
    expect(STATEMENTS).toMatch(/alter table scans\s+add column week_start date null;/);
    expect(STATEMENTS).not.toMatch(/week_start\s+timestamp/i);
  });

  it("is nullable — a free scan has no site and no week, and a deep pass is not a week's measurement", () => {
    expect(STATEMENTS).toMatch(/week_start date null/);
    expect(STATEMENTS).not.toMatch(/week_start date not null/);
  });

  it("carries no default: a week is computed in the site's own zone, never by the server's clock", () => {
    expect(STATEMENTS).not.toMatch(/default\s+(now\(\)|current_date)/i);
  });
});

describe("the index, not the schedule, is what makes it once a week (ADR-060)", () => {
  it("is unique over the pair, and partial on the weekly tier", () => {
    expect(STATEMENTS).toMatch(
      /create unique index scans_one_weekly_per_site_week\s+on scans \(site_id, week_start\)\s+where tier = 'weekly';/
    );
  });

  it("scopes to weekly, so a domain may still be scanned freely as often as §6.4 allows", () => {
    const index = /create unique index[\s\S]*?;/.exec(STATEMENTS)?.[0] ?? "";
    expect(index).toContain("where tier = 'weekly'");
  });

  it("adds no second index on week_start alone — every read of it is keyed by the site", () => {
    expect(STATEMENTS.match(/create\s+(unique\s+)?index/g)).toHaveLength(1);
  });
});

describe("the week is written once and never recomputed", () => {
  it("the migration adds no writer of its own — the claim insert is the only one", () => {
    expect(STATEMENTS).not.toMatch(/update scans/i);
    expect(STATEMENTS).not.toMatch(/create (or replace )?(trigger|function)/i);
  });

  it("the report-storing function does not touch week_start, so storing a report cannot move a week", () => {
    expect(statementsOf(FLIP)).not.toContain("week_start");
  });
});

describe("the file is named for the topic that owns it", () => {
  it("resolves to the `scans` topic and to exactly one owner", () => {
    expect(topicOf(MIGRATION_NAME)).toEqual({ token: "scans", owner: "BP-012" });
  });
});
