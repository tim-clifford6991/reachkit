// The ADR-072 pin, and the test that has to exist before somebody files
// the bug report.
//
// The fixture below is the one ADR-072's warning block describes, asserted
// as **correct behaviour and not as a defect**: a page marked no longer
// judgeable in week 1 because its search left the tracked set is still no
// longer judgeable in week 12, with the same cause and the same
// `lastJudgedWeek`, while that search has been back in the tracked set
// since week 2 and the page has been live throughout. REQ-063 criterion 7,
// the resumption path, was withdrawn outright on 2026-09-01 and its number
// was not reused.
//
// Removing the short-circuit so a returning search lifts the cause fails
// here and nowhere else. It will be proposed as a *bug fix*.
import "../env";
import { afterEach, describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { judgeWeek } from "../../../src/lib/opportunities/verdicts/judge";
import { NOT_JUDGEABLE_CAUSES } from "../../../src/lib/opportunities/verdicts/types";
import {
  fakeStore,
  pageOf,
  record,
  releaseStore,
  reportWithOwnPlace,
} from "./harness";
import { AT, SITE_ID } from "../fixtures";

afterEach(releaseStore);

const WEEK_ONE = "2026-06-01";
const RETIRED_IN = "2026-06-08";

/** Twelve consecutive site-local Mondays from `RETIRED_IN`. */
function weeksFrom(start: string, count: number): string[] {
  const first = Date.parse(`${start}T00:00:00Z`);
  return Array.from({ length: count }, (_, i) =>
    new Date(first + i * 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
}

describe("every cause is terminal, and nothing restores a page to judgement", () => {
  for (const cause of NOT_JUDGEABLE_CAUSES) {
    it(`a page retired for ${cause} in week 1 reads the same cause and the same lastJudgedWeek in weeks 2 through 12`, async () => {
      const store = fakeStore({
        // The page is live throughout, its search is measured every week
        // from week 2 on, and the customer is paying. None of that lifts
        // anything.
        pages: [pageOf({ publicationId: "retired" })],
        report: reportWithOwnPlace(1),
        history: [
          record({ publicationId: "retired", week: WEEK_ONE, verdict: "working" }),
          record({
            publicationId: "retired",
            week: RETIRED_IN,
            verdict: "not_judgeable",
            cause,
            measuredAt: null,
            measured: null,
          }),
        ],
      });

      for (const week of weeksFrom("2026-06-15", 11)) {
        const { standings } = await judgeWeek({ siteId: SITE_ID, week });
        expect(standings[0]?.standing).toEqual({
          kind: "not_judgeable",
          cause,
          lastJudgedWeek: WEEK_ONE,
        });
      }
      // And it is retired once: the row that retired it stays the one row
      // that did, so the history c6 reads is not rewritten week after week.
      expect(store.inserted).toEqual([]);
    });
  }

  it("the short-circuit runs before evaluation — a week whose measurements would decide the test changes nothing", async () => {
    // The page holds position 1 for its recorded search this week, so an
    // evaluation would return `working`. A re-ordering that evaluates
    // first and reads the row second fails here rather than in production.
    fakeStore({
      pages: [pageOf({ publicationId: "retired" })],
      report: reportWithOwnPlace(1),
      history: [
        record({
          publicationId: "retired",
          week: RETIRED_IN,
          verdict: "not_judgeable",
          cause: "search_untracked",
          measuredAt: null,
          measured: null,
        }),
      ],
    });
    const { standings } = await judgeWeek({ siteId: SITE_ID, week: "2026-09-07" });
    expect(standings[0]?.standing).toMatchObject({ kind: "not_judgeable", cause: "search_untracked" });
  });

  it("a page retired in an earlier week is judged in no later week, whatever this week measured", async () => {
    const store = fakeStore({
      pages: [pageOf({ publicationId: "retired" }), pageOf({ publicationId: "live" })],
      report: reportWithOwnPlace(2),
      history: [
        record({
          publicationId: "retired",
          week: RETIRED_IN,
          verdict: "not_judgeable",
          cause: "unpublished",
          measuredAt: null,
          measured: null,
        }),
      ],
    });
    await judgeWeek({ siteId: SITE_ID, week: "2026-09-07" });
    // Exactly one row this week, and it belongs to the page that is still
    // judged.
    expect(store.rows.map((row) => row.publicationId)).toEqual(["live"]);
  });
});

describe("terminality is a row and a missing grant, never a flag", () => {
  const DIR = "src/lib/opportunities/verdicts";
  const sources = readdirSync(DIR).map((name) => ({
    name,
    // Comments are stripped: the modules discuss the lift condition they
    // refuse to write, and this assertion is about code.
    code: readFileSync(join(DIR, name), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, ""),
  }));

  it("nothing under verdicts/ writes an is_judgeable column or clears a cause", () => {
    // ADR-072 decision 5c's whole content is that no such writer exists: a
    // flag would need one, and the writer is the thing that gets called by
    // mistake.
    for (const { name, code } of sources) {
      expect(code, `${name} names an is_judgeable flag`).not.toMatch(/is_?[Jj]udgeable/);
      expect(code, `${name} clears a cause`).not.toMatch(/cause\s*=\s*null|cause:\s*null\s*,?\s*\/\/\s*clear/);
    }
  });

  it("the schema grants no update and no delete on page_verdicts", () => {
    const migration = readFileSync(
      "supabase/migrations/20260906140000_opportunities_verdicts.sql",
      "utf8"
    ).replace(/^--.*$/gm, "");
    expect(migration).toMatch(/grant\s+select\s+on\s+page_verdicts/);
    expect(migration).toMatch(/grant\s+insert\s+on\s+page_verdicts\s+to\s+service_role/);
    expect(migration).not.toMatch(/grant[^;]*\bupdate\b[^;]*page_verdicts/i);
    expect(migration).not.toMatch(/grant[^;]*\bdelete\b[^;]*page_verdicts/i);
  });

  it("nothing under verdicts/ issues an update or a delete against page_verdicts", () => {
    for (const { name, code } of sources) {
      expect(code, `${name} updates a verdict row`).not.toMatch(/\.update\(/);
      expect(code, `${name} deletes a verdict row`).not.toMatch(/\.delete\(/);
    }
  });
});

describe("the withdrawn resumption path is built nowhere", () => {
  it("no module names a lift, a resumption or an is_judgeable flag in its code", () => {
    const code = readdirSync("src/lib/opportunities/verdicts")
      .map((name) => readFileSync(join("src/lib/opportunities/verdicts", name), "utf8"))
      .join("\n")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/\blift(ed|s|Condition)?\b/i);
    expect(code).not.toMatch(/\bresum(e|ed|ption)\b/i);
    expect(code).not.toMatch(/\brestore[sd]?\b/i);
    expect(AT).toBeInstanceOf(Date);
  });
});
