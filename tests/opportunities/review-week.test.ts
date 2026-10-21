// The owner's review prints a site's week in the golden plans' columns:
// for one SaaS and one local panel site, `reviewWeek` returns the rows the
// golden `.md` shows, from `choose` and from the rows a commit stored. 0¢.
import "./env";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readingOf } from "@/lib/measure/page-reading";
import { pageLabel, reviewWeek, storedChoice, type ReviewWeek } from "@/lib/opportunities/review/week";
import { panelSite } from "../golden/plan/panel";
import { chosen, storedRows } from "../app/review/stored";

const SITES = { saas: "savvycal.com", local: "austinplumbery.com" } as const;

const cell = (value: string | number | null) => (value === null ? "—" : String(value));

/** The rows of the golden table whose head starts with `head`. */
function goldenTable(domain: string, head: string): string[][] {
  const lines = readFileSync(new URL(`../golden/plan/${domain}.md`, import.meta.url), "utf8").split("\n");
  const start = lines.findIndex((line) => line.startsWith(`| ${head} |`));
  const rows: string[][] = [];
  for (const line of lines.slice(start + 2)) {
    if (!line.startsWith("|")) break;
    rows.push(line.slice(2, -2).split(" | "));
  }
  return rows;
}

function printed(week: ReviewWeek): { committed: string[][]; rejected: string[][] } {
  return {
    committed: week.committed.map((row) => [
      cell(row.place),
      row.day ?? "spare",
      cell(row.search),
      row.type,
      cell(row.page),
      cell(row.fit),
      cell(row.volume),
      cell(row.points),
      row.parts.map((part) => `${part.part} ${part.n}`).join(" + ") || "—",
      cell(row.rule),
      cell(row.writeAs),
    ]),
    rejected: week.rejected.map((row) => [cell(row.search), row.type, cell(row.fit), cell(row.volume), row.reason]),
  };
}

describe("reviewWeek prints the golden week", () => {
  for (const [kind, domain] of Object.entries(SITES)) {
    it(`${kind} (${domain}): the committed and not-chosen rows equal the golden plan's`, () => {
      const site = panelSite(domain);
      const out = printed(reviewWeek(site.rows, chosen(site)));
      const committed = goldenTable(domain, "Place");
      const rejected = goldenTable(domain, "Not chosen");
      expect(committed.length).toBeGreaterThan(0);
      expect(out.committed).toEqual(committed);
      expect(out.rejected.slice(0, rejected.length)).toEqual(rejected);
    });

    it(`${kind} (${domain}): the stored commit reads back as the same committed week`, () => {
      const rows = storedRows(domain);
      const out = printed(reviewWeek(rows, storedChoice(rows)));
      expect(out.committed).toEqual(goldenTable(domain, "Place"));
      for (const row of out.rejected) expect(row[4]).toBe("unready");
    });
  }

  it("a commit stored with no reason has no points, never 0", () => {
    const rows = storedRows(SITES.saas).map((row) => ({ ...row, plan_reason: null }));
    const week = reviewWeek(rows, storedChoice(rows));
    expect(week.committed.length).toBeGreaterThan(0);
    for (const row of week.committed) expect(row.points).toBeNull();
  });
});

describe("a live page's label comes from its stored reading", () => {
  const now = new Date("2026-10-19T06:00:00.000Z");
  it("a page with no reading has no label", () => {
    expect(pageLabel(readingOf(null), now)).toBeNull();
  });
  it("a page read at place 7 is working", () => {
    const reading = readingOf({ at: now.toISOString(), place: { value: 7, source: "serp", query: "q" }, first: null, best: null });
    expect(pageLabel(reading, now)).toBe("working");
  });
});
