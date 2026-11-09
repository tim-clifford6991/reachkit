// Every Monday a page's own results decide what happens to it next (owner,
// 2026-10-19, B3 · M6): a stalled page near page one is refreshed for the
// gap, a climbing page is left alone, a cluster AI linked earns one more
// page, and a page not moving is refreshed once, then its question retired.
// Fixtures are customer-panel sites, a local service and a SaaS. 0¢.
import "./env";
import { describe, expect, it } from "vitest";
import { choose } from "../../src/lib/opportunities/choose";
import { refreshCandidates, refreshCauseOf, type OwnLivePage, type RefreshPools } from "../../src/lib/opportunities/refresh";
import { readOpportunity, type OpportunityRow } from "../../src/lib/opportunities/store";
import type { Opportunity } from "../../src/lib/opportunities/types";
import { AT, panelSite, type PanelSite } from "../golden/plan/panel";

const DAY_MS = 86_400_000;
const daysAgo = (days: number) => new Date(AT.getTime() - days * DAY_MS);
const weeksAgo = (weeks: number) => daysAgo(7 * weeks).toISOString();

const LOCAL = panelSite("austinplumbery.com");
const SAAS = panelSite("savvycal.com");
const PAGES: readonly [PanelSite, string][] = [
  [LOCAL, "emergency plumber austin texas"],
  [SAAS, "meeting scheduler tool"],
];

function rowFor(site: PanelSite, search: string): OpportunityRow {
  return site.rows.find((row) => row.target_query === search)!;
}

/** One of the site's pages, live `age` days. */
function live(site: PanelSite, search: string, a: Partial<OwnLivePage> & { age: number }): OwnLivePage {
  const { age, ...rest } = a;
  return {
    url: `https://blog.${site.domain}/${search.replaceAll(" ", "-")}`,
    publishedAt: daysAgo(age),
    row: readOpportunity(rowFor(site, search)),
    declined: false,
    facts: [],
    marketFacts: [],
    ...rest,
  };
}

/** The page's own address at `place` for its own search. */
const placed = (page: OwnLivePage, place: number): RefreshPools => ({
  siteText: [],
  market: [],
  ranked: [{ keyword: page.row.targetQuery!, url: page.url, position: place }],
});

describe("a page at 11–30 is refreshed for the gap only after 3 readings without a gain and 30 days live", () => {
  for (const [site, search] of PAGES) {
    it(site.domain, () => {
      const page = (a: Partial<OwnLivePage> & { age: number }) => live(site, search, a);
      expect(refreshCauseOf(page({ age: 40, readings: [25, 25, 25] }), placed(page({ age: 40 }), 25), AT)).toBe("close");
      expect(refreshCauseOf(page({ age: 40, readings: [11, 11, 11] }), placed(page({ age: 40 }), 11), AT)).toBe("close");
      expect(refreshCauseOf(page({ age: 40, readings: [30, 30, 30] }), placed(page({ age: 40 }), 30), AT)).toBe("close");
      // Two readings; 29 days live; a gain inside the three; past 30.
      expect(refreshCauseOf(page({ age: 40, readings: [25, 25] }), placed(page({ age: 40 }), 25), AT)).toBeNull();
      expect(refreshCauseOf(page({ age: 29, readings: [25, 25, 25] }), placed(page({ age: 29 }), 25), AT)).toBeNull();
      expect(refreshCauseOf(page({ age: 40, readings: [40, 27, 26, 25] }), placed(page({ age: 40 }), 25), AT)).toBeNull();
      expect(refreshCauseOf(page({ age: 40, readings: [31, 31, 31] }), placed(page({ age: 40 }), 31), AT)).toBeNull();
    });
  }
});

describe("a climbing page, a gain within the last 8 weeks, is left alone", () => {
  for (const [site, search] of PAGES) {
    it(site.domain, () => {
      const climbed = { first: { place: 48, at: weeksAgo(7) }, best: { place: 25, at: weeksAgo(2) } };
      const page = live(site, search, { age: 60, readings: [25, 25, 25], reading: climbed, declined: true });
      expect(refreshCauseOf(page, placed(page, 25), AT)).toBeNull();
      expect(refreshCandidates([page], placed(page, 25), AT)).toEqual([]);
      // Its best place 8 weeks old, it is no longer climbing.
      const settled = { ...page, declined: false, reading: { ...climbed, best: { place: 25, at: weeksAgo(8) } } };
      expect(refreshCauseOf(settled, placed(page, 25), AT)).toBe("close");
    });
  }
});

describe("a page flat for 8 weeks is refreshed once; still flat 8 weeks after, its question is retired", () => {
  for (const [site, search] of PAGES) {
    it(site.domain, () => {
      const flat = live(site, search, { age: 60, unmet: true });
      const [refresh] = refreshCandidates([flat], { siteText: [], market: [] }, AT);
      expect(refresh?.evidence).toMatchObject({ family: "improve", shortfall: { kind: "due", cause: "unmet" } });

      // The refresh is the page's current version, live 60 days and not moving again.
      const refreshed: OwnLivePage = {
        ...flat,
        row: { ...flat.row, type: "refresh_page", family: "improve", evidence: refresh!.evidence } as Opportunity,
        flatRefreshed: true,
      };
      expect(refreshCauseOf(refreshed, placed(refreshed, 25), AT)).toBeNull();
      expect(refreshCandidates([{ ...refreshed, readings: [25, 25, 25], declined: true }], placed(refreshed, 25), AT)).toEqual([]);
      // Before its 8 weeks are up, it is judged as any page is.
      expect(refreshCauseOf({ ...refreshed, unmet: false, readings: [25, 25, 25] }, placed(refreshed, 25), AT)).toBe("close");
    });
  }
});

describe("a page linked by AI earns one more page in its cluster", () => {
  const CLUSTER = "austin plumbery rivals";
  const IN_CLUSTER = ["austin plumbery vs clarke kent plumbing", "austin plumbery vs beyond wow plumbing"];
  const rows = LOCAL.rows.map((row) => (IN_CLUSTER.includes(row.target_query!) ? { ...row, cluster_key: CLUSTER } : row));
  const week = (linkedClusters: readonly string[]) =>
    choose({ rows, fixRows: [], profile: LOCAL.profile, latest: null, drafted: [], cited: [], topTens: new Map(), linkedClusters, at: AT, from: "2026-10-19" });

  it("a cluster with no open new page earns nothing, and no other row moves", () => {
    expect(week(["no such cluster"]).committed).toEqual(week([]).committed);
  });
});
