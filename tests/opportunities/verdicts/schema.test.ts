// BUILD §9, §10 — the invariants `page_verdicts` holds, asserted against
// the migration itself.
//
// These are ordinarily database tests: insert the second row for a week,
// watch the unique index refuse it. The `db` project's file list
// (`LIVE_SCHEMA_TESTS` in `vitest.config.ts`) is the owner's, so this suite
// reads the migration SQL and asserts that each invariant is *written down
// in the schema* rather than left to application code. That is the weaker
// half of the check and it is stated plainly: it proves the constraint
// exists, not that Postgres enforces it. The PR asks the owner for the
// `LIVE_SCHEMA_TESTS` entry that would close the gap; the constraints were
// applied by hand against a scratch database in the meantime.
import "../env";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { topicOf } from "../../../src/lib/db/topics";
import { NOT_JUDGEABLE_CAUSES } from "../../../src/lib/opportunities/verdicts/types";

const MIGRATIONS = path.resolve(import.meta.dirname, "../../../supabase/migrations");
const FILE = "20260906140000_opportunities_verdicts.sql";
const sql = readFileSync(path.join(MIGRATIONS, FILE), "utf8");

/** The statements only. A "not present" assertion over a file that
 *  explains in prose why the thing is absent would fail on its own
 *  explanation. */
const statements = sql
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

describe("ARCHITECTURE rule 6: the migration is topic-prefixed and topic-owned", () => {
  it("resolves to the opportunities_verdicts sub-token and to no other topic", () => {
    expect(topicOf(FILE)).toEqual({ token: "opportunities_verdicts", owner: "BP-051" });
  });
});

describe("REQ-063 c1: one verdict per page per week", () => {
  it("the unique key is (publication_id, week_start), which is what makes a re-run idempotent", () => {
    expect(statements).toMatch(
      /create unique index page_verdicts_one_per_page_per_week\s+on page_verdicts \(publication_id, week_start\)/
    );
  });

  it("week_start is a date — the site-local Monday, never an instant", () => {
    expect(statements).toMatch(/week_start date not null/);
    expect(statements).not.toMatch(/week_start timestamptz/);
  });
});

describe("REQ-063 c6: the cause is written exactly when the verdict is not_judgeable", () => {
  it("the four verdict values are closed in the schema", () => {
    for (const verdict of ["working", "too_early", "not_working", "not_judgeable"]) {
      expect(statements).toContain(`'${verdict}'`);
    }
  });

  it("all five causes are closed in the schema, and no sixth is admitted", () => {
    const constraint = statements.slice(statements.indexOf("cause text null"));
    for (const cause of NOT_JUDGEABLE_CAUSES) expect(constraint).toContain(`'${cause}'`);
    // The one value that must never appear: `could_not_confirm` is a
    // `VerifyNote` and never a cause (ADR-085 decision 4). A schema that
    // admitted it would make the merge storable.
    expect(statements).not.toContain("could_not_confirm");
  });

  it("the biconditional is stated in both directions, so neither a causeless retirement nor a caused verdict is representable", () => {
    expect(statements).toMatch(
      /constraint page_verdicts_cause_iff_not_judgeable check \(\(verdict = 'not_judgeable'\) = \(cause is not null\)\)/
    );
  });
});

describe("ADR-071 point 2: two of the four standings have no row shape at all", () => {
  it("no value in the schema names not_measured or no_week — their absence is their representation", () => {
    expect(statements).not.toContain("not_measured");
    expect(statements).not.toContain("no_week");
  });
});

describe("ADR-072 decision 5c: insert-only is a permission, not a convention", () => {
  it("select and insert are granted; update and delete are granted to nobody", () => {
    expect(statements).toMatch(/grant select on page_verdicts to anon, authenticated, service_role;/);
    expect(statements).toMatch(/grant insert on page_verdicts to service_role;/);
    expect(statements).not.toMatch(/grant[^;]*\bupdate\b[^;]*page_verdicts/i);
    expect(statements).not.toMatch(/grant[^;]*\bdelete\b[^;]*page_verdicts/i);
  });

  it("there is no is_judgeable column, and nothing a writer could clear", () => {
    expect(statements).not.toMatch(/is_?judgeable/i);
  });

  it("row-level security is on and the select policy is site-scoped", () => {
    expect(statements).toMatch(/alter table page_verdicts enable row level security;/);
    expect(statements).toMatch(/create policy page_verdicts_select_own on page_verdicts for select/);
  });
});

describe("BP-051 decision 1: there is no column anywhere holding one latest verdict per publication", () => {
  it("no migration adds publications.verdict", () => {
    const everyMigration = readdirSync(MIGRATIONS)
      .filter((name) => name.endsWith(".sql"))
      .map((name) =>
        readFileSync(path.join(MIGRATIONS, name), "utf8")
          .split("\n")
          .filter((line) => !line.trimStart().startsWith("--"))
          .join("\n")
      )
      .join("\n");
    expect(everyMigration).not.toMatch(/alter table publications[\s\S]{0,120}?\bverdict\b/i);
  });
});

describe("the two indexes are the two reads, and no third is written", () => {
  it("one site's week, and one publication's history", () => {
    expect(statements).toMatch(/create index page_verdicts_site_week_idx on page_verdicts \(site_id, week_start\)/);
    expect(statements).toMatch(
      /create index page_verdicts_publication_idx on page_verdicts \(publication_id, week_start desc\)/
    );
  });
});
