// A new site (fewer than 30 searches ranked) writes its own offering and
// what buyers ask before comparisons, and fills one cluster before a third
// (owner ruling R31, 2026-10-24). Rows are the customer panel's stored
// topics; the asked questions are the "People also ask" its stored SERPs hold.
import "./env";
import { afterEach, describe, expect, it } from "vitest";
import { measured, unmeasured } from "../../src/lib/measure/measured";
import { choose, type ChooseInput } from "../../src/lib/opportunities/choose";
import { rankOpen } from "../../src/lib/opportunities/rank/open";
import { setOpportunityStore, type OpportunityRow } from "../../src/lib/opportunities/store";
import type { StoredReport } from "../../src/lib/scan/report";
import { AT, panelSite, rowOf, SITE_ID } from "../golden/plan/panel";
import { memoryStore, newMemoryState } from "./memory-store";

const FROM = AT.toISOString().slice(0, 10);

/** Per kind of business: a stored comparison topic, a stored topic on its
 *  own offering, and a question its stored SERPs show buyers asking. */
const KINDS = {
  saas: { domain: "savvycal.com", comparison: "acuity scheduling alternatives", offering: "appointment scheduling online software", asked: "Does Google have an appointment scheduling tool?" },
  local: { domain: "austinplumbery.com", comparison: "abacus plumbing alternatives", offering: "emergency plumber austin texas", asked: "Do plumbers deal with drains?" },
  shop: { domain: "tattly.com", comparison: "inkbox alternatives", offering: "temporary tattoos for adults", asked: "Are temporary tattoos safe for kids?" },
} as const;

type Kind = (typeof KINDS)[keyof typeof KINDS];

/** Three ready Write rows of equal fit and volume, the comparison oldest, so
 *  an established site's tie puts it first. */
function rows(kind: Kind): OpportunityRow[] {
  const topic = (query: string, type: "comparison_page" | "keyword_page" | "answer_page") => ({ query, status: "open", type, fit: 3, volume: 90, ready: true });
  const [comparison, offering, asked] = [
    rowOf(kind.domain, topic(kind.comparison, "comparison_page"), 0),
    rowOf(kind.domain, topic(kind.offering, "keyword_page"), 1),
    rowOf(kind.domain, topic(kind.asked, "answer_page"), 2),
  ];
  const created = (row: OpportunityRow, minutes: number) => ({ ...row, created_at: new Date(AT.getTime() - minutes * 60_000).toISOString() });
  return [
    created(comparison!, 30),
    created({ ...offering!, evidence: { ...(offering!.evidence as object), shape: "offering" } }, 20),
    created({ ...asked!, evidence: { ...(asked!.evidence as object), askedBeside: { term: kind.asked, serpAt: AT } } }, 10),
  ];
}

function week(kind: Kind, site: Partial<ChooseInput>) {
  const { profile } = panelSite(kind.domain);
  return choose({ rows: [], fixRows: [], profile, latest: null, drafted: [], cited: [], topTens: new Map(), at: AT, from: FROM, ...site });
}

const queries = (kind: Kind, input: Partial<ChooseInput>) => {
  const byId = new Map((input.rows ?? []).map((row) => [row.id, row.target_query]));
  return week(kind, input).committed.map((entry) => byId.get(entry.opportunityId));
};

describe("a new site ranks its own offering and what buyers ask ahead of a comparison of equal fit", () => {
  for (const [name, kind] of Object.entries(KINDS)) {
    it(`${name} (${kind.domain})`, () => {
      const held = rows(kind);
      // Established, or with no readable report: the tie goes to the older comparison, as before.
      expect(queries(kind, { rows: held, ownRanked: 30 })[0]).toBe(kind.comparison);
      expect(queries(kind, { rows: held, ownRanked: null })[0]).toBe(kind.comparison);
      // New: the comparison goes last, and only the two led rows carry the part.
      const choice = week(kind, { rows: held, ownRanked: 29 });
      expect(queries(kind, { rows: held, ownRanked: 29 })).toEqual([kind.offering, kind.asked, kind.comparison]);
      const parts = choice.committed.map((entry) => entry.reason.parts.some((part) => part.part === "new_site"));
      expect(parts).toEqual([true, true, false]);
      for (const entry of choice.committed) expect(entry.reason.points).toBe(entry.reason.parts.reduce((sum, part) => sum + part.n, 0));
    });
  }

  it("a fit-3 comparison still outranks a fit-2 offering page: the part orders equals, never lifts a lower fit over a higher", () => {
    const [comparison, offering] = rows(KINDS.saas);
    const lower = { ...offering!, business_fit: 2 };
    expect(queries(KINDS.saas, { rows: [comparison!, lower], ownRanked: 0 })[0]).toBe(KINDS.saas.comparison);
  });
});

/** The panel site's ready rows, each in a cluster: the best of them in a third cluster. */
function clustered(domain: string): { rows: OpportunityRow[]; third: string } {
  const ready = panelSite(domain).rows.filter((row) => row.ready && (row.family === "write" || row.family === "earn"));
  // A row no comparison cap places, so the rule that placed it is the cluster's.
  const first = ready.find((row) => row.type !== "comparison_page");
  const rest = ready.filter((row) => row !== first);
  const third = { ...first!, cluster_key: "third", business_fit: 3, volume: 5000, evidence: { ...(first!.evidence as object), volume: measured(5000, AT) } };
  return { rows: [third, ...rest.slice(0, 3).map((row, n) => ({ ...row, cluster_key: n % 2 === 0 ? "a" : "b" }))], third: third.target_query! };
}

const live = (cluster: string, n: number) => Array.from({ length: n }, (_, i) => ({ opportunityId: `live-${cluster}-${i}`, clusterKey: cluster }));

describe("a new site fills one cluster to five pages before it opens a third", () => {
  for (const domain of [KINDS.saas.domain, KINDS.local.domain]) {
    it(domain, () => {
      const { rows: held, third } = clustered(domain);
      const kind = { domain } as Kind;
      const twoOpen = [...live("a", 2), ...live("b", 1)];
      // Two clusters open, neither holds five: the third waits behind every row that keeps to them.
      const waiting = queries(kind, { rows: held, ownRanked: 3, livePages: twoOpen });
      expect(waiting.indexOf(third)).toBe(held.length - 1);
      const rule = week(kind, { rows: held, ownRanked: 3, livePages: twoOpen }).committed.find((entry) => entry.opportunityId === held[0]!.id)?.reason.rule;
      // It is still written once nothing else may fill the day.
      expect(rule).toBe("best, a third cluster");
      // One cluster at five, an established site, or only one cluster open: the third is not held.
      expect(queries(kind, { rows: held, ownRanked: 3, livePages: [...live("a", 5), ...live("b", 1)] })[0]).toBe(third);
      expect(queries(kind, { rows: held, ownRanked: 300, livePages: twoOpen })[0]).toBe(third);
      expect(queries(kind, { rows: held, ownRanked: 3, livePages: live("a", 2) })[0]).toBe(third);
    });
  }
});

describe("the ranking reads whether the site is new from its current report", () => {
  afterEach(() => setOpportunityStore(null));

  const rank = async (report: StoredReport | null) => {
    const held = rows(KINDS.local).map((row) => ({ ...row, site_id: SITE_ID }));
    const state = newMemoryState({ rows: held, profile: panelSite(KINDS.local.domain).profile, report, now: AT });
    setOpportunityStore({ ...memoryStore(state), livePageClusters: async () => [] });
    const ranked = await rankOpen(SITE_ID, AT);
    const byId = new Map(held.map((row) => [row.id, row.target_query]));
    return ranked.map((entry) => byId.get(entry.opportunityId));
  };
  const reportWith = (ownRanked: StoredReport["ownRanked"]) => ({ ownRanked }) as unknown as StoredReport;

  it("a count not measured is the cold-start 0; a measured 30 or more, or no report, is an established site", async () => {
    expect((await rank(reportWith(unmeasured("not_attempted", AT))))[0]).toBe(KINDS.local.offering);
    expect((await rank(reportWith(measured(4, AT))))[0]).toBe(KINDS.local.offering);
    expect((await rank(reportWith(measured(30, AT))))[0]).toBe(KINDS.local.comparison);
    expect((await rank(null))[0]).toBe(KINDS.local.comparison);
  });
});
