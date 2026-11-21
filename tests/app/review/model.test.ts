// The review's figures count each site's own committed week: a short week is a committed site with fewer dated pages
// than a week has days, so "7 of 7" never sits beside a short week, whatever weekday the commit starts on; a site whose
// commit is last week's counts in neither, and a stop or flag outside the header's week counts in none. 0¢.
import "../../opportunities/env";
import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EMPTY_LINK_MAP } from "@/lib/known-content/link-map";
import { choose } from "@/lib/opportunities/choose";
import { reviewWeek, storedChoice, type ReviewWeek } from "@/lib/opportunities/review/week";
import { markKey, reviewModel, type SiteRead } from "@/app/(account)/app/review/model";
import { panelSite } from "../../golden/plan/panel";
import { FROM, storedRows } from "./stored";

const DOMAINS = readdirSync(new URL("../../golden/plan/", import.meta.url)).flatMap((name) => (name.endsWith(".md") ? [name.slice(0, -3)] : []));
const dayAfter = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00.000Z`) + n * 86_400_000).toISOString().slice(0, 10);
const TUESDAY = dayAfter(FROM, 1), LAST_MONDAY = dayAfter(FROM, -7);

function site(n: number, week: ReviewWeek, weeklyCommit: string | null = FROM): SiteRead {
  return { id: `site-${n}`, domain: `site-${n}`, week, pages: [], links: EMPTY_LINK_MAP, difficulty: new Map(), stops: [], verdicts: [], siteWeek: FROM, weeklyCommit };
}

const stored = (domain: string) => { const rows = storedRows(domain); return reviewWeek(rows, storedChoice(rows)); };

/** The week the planner commits when its first open date is a Tuesday: Tuesday to the next Monday. */
function fromTuesday(domain: string): ReviewWeek {
  const panel = panelSite(domain);
  return reviewWeek(panel.rows, choose({ rows: panel.rows, fixRows: [], profile: panel.profile, cited: [], topTens: new Map(), at: new Date(`${TUESDAY}T06:00:00.000Z`), from: TUESDAY }));
}

describe("every review figure counts the site's own committed week", () => {
  const sites = DOMAINS.map((domain, n) => site(n, stored(domain)));

  it("a short week is a committed site with fewer dated pages than days, so a full week is never short", () => {
    const { figures, sites: shown } = reviewModel(FROM, sites, new Map());
    expect(figures.short).toBe(shown.filter((one) => one.dated < 7).length);
    expect(figures.committed === figures.of).toBe(figures.short === 0);
  });

  it("a week committed Tuesday to Monday is full, though Monday to Sunday holds fewer of its days", () => {
    const week = fromTuesday(DOMAINS[0]!);
    const days = week.committed.flatMap((row) => (row.day === null ? [] : [row.day]));
    expect(days.filter((day) => day >= FROM && day < dayAfter(FROM, 7)).length).toBeLessThan(7);
    const { figures } = reviewModel(FROM, [site(0, week)], new Map());
    expect(figures).toMatchObject({ committed: 7, of: 7, short: 0 });
  });

  it("a site whose commit is last week's counts in no figure and shows no row; a stop or flag outside the week counts in none", () => {
    const [stale, ...rest] = sites;
    const old = { ...stale!, weeklyCommit: LAST_MONDAY, stops: [`${dayAfter(FROM, 7)}T09:00:00.000Z`] };
    const row = old.week.committed[0]!;
    const flag = new Map([[markKey(old.id, row.id), { mark: "flag" as const, note: null, at: `${FROM}T10:00:00.000Z` }]]);
    const before = reviewModel(FROM, rest, new Map()).figures;
    const after = reviewModel(FROM, [old, ...rest], flag);
    expect(after.figures).toMatchObject({ committed: before.committed, of: before.of, short: before.short, stopped: 0, flags: 0 });
    expect(after.sites[0]!.committed).toEqual([]);
  });
});
