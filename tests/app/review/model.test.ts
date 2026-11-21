// The review's six figures count one week: a short week is a site with fewer dated pages in that week than a week has
// days, so "7 of 7" never sits beside a short week, and a row, stop or flag outside the week counts in no figure. 0¢.
import "../../opportunities/env";
import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EMPTY_LINK_MAP } from "@/lib/known-content/link-map";
import { reviewWeek, storedChoice } from "@/lib/opportunities/review/week";
import { markKey, reviewModel, type SiteRead } from "@/app/(account)/app/review/model";
import { FROM, storedRows } from "./stored";

const DOMAINS = readdirSync(new URL("../../golden/plan/", import.meta.url)).flatMap((name) => (name.endsWith(".md") ? [name.slice(0, -3)] : []));
const nextWeek = (day: string) => new Date(Date.parse(`${day}T00:00:00.000Z`) + 7 * 86_400_000).toISOString().slice(0, 10);

function read(domain: string, n: number): SiteRead {
  const rows = storedRows(domain);
  const week = reviewWeek(rows, storedChoice(rows));
  return { id: `site-${n}`, domain, week, pages: [], links: EMPTY_LINK_MAP, difficulty: new Map(), stops: [], verdicts: [] };
}

describe("every review figure counts the week the header names", () => {
  const sites = DOMAINS.map(read);

  it("a short week is a site with fewer dated pages than days, so a full week is never short", () => {
    const { figures, sites: shown } = reviewModel(FROM, sites, new Map());
    expect(figures.short).toBe(shown.filter((site) => site.dated < 7).length);
    expect(figures.committed === figures.of).toBe(figures.short === 0);
  });

  it("a row, a stop and a flag dated outside the week count in no figure", () => {
    const [moved, ...rest] = sites;
    const later = { ...moved!, week: { ...moved!.week, committed: moved!.week.committed.map((row) => ({ ...row, day: row.day === null ? null : nextWeek(row.day) })) }, stops: [`${nextWeek(FROM)}T09:00:00.000Z`] };
    const row = later.week.committed.find((one) => one.day !== null)!;
    const flag = new Map([[markKey(later.id, row.id), { mark: "flag" as const, note: null, at: `${FROM}T10:00:00.000Z` }]]);
    const before = reviewModel(FROM, rest, new Map()).figures;
    const after = reviewModel(FROM, [later, ...rest], flag).figures;
    expect(after.committed).toBe(before.committed);
    expect(after.short).toBe(before.short + 1);
    expect(after.stopped).toBe(0);
    expect(after.flags).toBe(0);
  });
});
