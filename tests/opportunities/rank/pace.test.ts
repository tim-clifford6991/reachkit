// SPEC §7 (2026-09-29, *Pace*; issue 1139) — at most four new pages in any
// seven days; the other days refresh pages already live, ReachKit's own
// first; a site with nothing to refresh fills its week with new pages.
import "../env";
import { describe, expect, it } from "vitest";
import { PACE } from "../../../src/lib/config/constants";
import { orderRanked, type Scored } from "../../../src/lib/opportunities/rank/open";
import {
  refreshCandidates,
  refreshCauseOf,
  linkBackCandidates,
  type OwnLivePage,
  type RefreshPools,
} from "../../../src/lib/opportunities/refresh";
import { isOwnRefresh, type Opportunity } from "../../../src/lib/opportunities/types";

const AT = new Date("2026-10-05T06:00:00.000Z");
const daysAgo = (days: number) => new Date(AT.getTime() - days * 86_400_000);
const NO_POOLS: RefreshPools = { siteText: [], market: [] };

function row(id: string, type: Opportunity["type"], targetQuery: string, shortfall?: string): Opportunity {
  const family = shortfall === undefined ? "write" : "improve";
  const evidence = shortfall === undefined ? { family } : { family, shortfall: { kind: shortfall } };
  return {
    id,
    siteId: "site",
    scanId: "scan",
    family,
    type,
    status: "open",
    clusterKey: null,
    targetQuery,
    targetRef: id,
    absorbedQueries: [],
    volume: null,
    fitBand: "winnable",
    acceptance: { form: "top20", query: targetQuery },
    evidence,
    createdAt: AT,
  } as unknown as Opportunity;
}

function livePage(a: Partial<OwnLivePage> & { age: number }): OwnLivePage {
  return {
    url: "https://blog.example.com/crm-pricing",
    publishedAt: daysAgo(a.age),
    row: row("written", "keyword_page", "crm pricing for small teams"),
    declined: false,
    facts: [],
    marketFacts: [],
    ...a,
  };
}

/** Twelve new pages of three kinds, and what there is to update. */
function supply(updates: Opportunity[]): Scored[] {
  const queries = ["best crm", "what is a crm", "how to import contacts"];
  const fresh = Array.from({ length: 12 }, (_, i) => row(`new${i}`, "keyword_page", `${queries[i % 3]} ${i}`));
  return [...fresh, ...updates].map((opportunity, index) => ({ opportunity, points: 100 - index, parts: [] }));
}

describe("a week holds at most four new pages", () => {
  const updates = [
    row("improve0", "answerable_page", "crm reporting", "position"),
    ...Array.from({ length: 6 }, (_, i) => row(`refresh${i}`, "refresh_page", `live page ${i}`, "due")),
  ];
  const scored = supply(updates);
  const byId = new Map(scored.map((entry) => [entry.opportunity.id, entry.opportunity]));
  const days = orderRanked(scored, { mix: { from: 100, recent: [] } })
    .slice(0, 14)
    .map((entry) => byId.get(entry.opportunityId)!);

  it("no seven days running publish a fifth, and the other days are updates", () => {
    for (let start = 0; start + 7 <= days.length; start++) {
      const week = days.slice(start, start + 7);
      expect(week.filter((page) => page.family === "write").length, `from day ${start}`).toBe(PACE.NEW_PAGES_PER_WEEK);
    }
  });

  it("a refresh of a page of ours is taken before an Improve that outscores it", () => {
    const taken = days.filter((page) => page.family === "improve");
    expect(taken.slice(0, 6).every(isOwnRefresh)).toBe(true);
  });

  it("four new pages already this week: today is an update, whatever scores first", () => {
    const recent = [96, 97, 98, 99].map((day) => ({ day, kind: "qa" as const, offering: false }));
    const [today] = orderRanked(scored, { mix: { from: 100, recent } });
    expect(byId.get(today!.opportunityId)?.family).toBe("improve");
  });

  it("a site with nothing to refresh fills the week with new pages", () => {
    const only = supply([]);
    expect(orderRanked(only, { mix: { from: 100, recent: [] } }).slice(0, 7)).toHaveLength(7);
  });
});

describe("which live pages of ours are due a refresh", () => {
  it("a version 90 days old is; one of 89 days with nothing else against it is not", () => {
    expect(refreshCauseOf(livePage({ age: 90 }), NO_POOLS, AT)).toBe("aged");
    expect(refreshCauseOf(livePage({ age: 89 }), NO_POOLS, AT)).toBeNull();
  });

  it("a page the Monday verdict found lower is, unless it is younger than 30 days", () => {
    expect(refreshCauseOf(livePage({ age: 45, declined: true }), NO_POOLS, AT)).toBe("lost_position");
    expect(refreshCauseOf(livePage({ age: 20, declined: true }), NO_POOLS, AT)).toBeNull();
  });

  it("a page whose source no longer says the fact it recorded is", () => {
    const page = livePage({ age: 45, facts: [{ url: "https://example.com/pricing", passage: "Plans start at $29 a month." }] });
    const reading = (text: string, age: number) => ({
      siteText: [{ url: "https://example.com/pricing", text, measuredAt: daysAgo(age) }],
      market: [],
    });
    expect(refreshCauseOf(page, reading("Plans start at $39 a month.", 3), AT)).toBe("newer_fact");
    expect(refreshCauseOf(page, reading("Plans  start at $29 a month. Cancel any time.", 3), AT)).toBeNull();
    // A reading from before this version went live is not newer than it.
    expect(refreshCauseOf(page, reading("Plans start at $19 a month.", 60), AT)).toBeNull();
  });

  it("a page citing a public page a later draft read a new claim from is", () => {
    const cited = { url: "https://rival.example.net/pricing", passage: "Team is $49 per seat." };
    const page = livePage({ age: 45, marketFacts: [cited] });
    const later = { url: cited.url, passage: "Team is $59 per seat.", readAt: daysAgo(2) };
    expect(refreshCauseOf(page, { siteText: [], market: [later] }, AT)).toBe("newer_fact");
    expect(refreshCauseOf(page, { siteText: [], market: [{ ...cited, readAt: daysAgo(2) }] }, AT)).toBeNull();
  });

  it("the refresh is an update of the page's own address for the search it was written for", () => {
    const [candidate] = refreshCandidates([livePage({ age: 120 })], NO_POOLS, AT);
    expect(candidate).toMatchObject({
      type: "refresh_page",
      family: "improve",
      targetRef: "https://blog.example.com/crm-pricing",
      targetQuery: "crm pricing for small teams",
      acceptance: { form: "top20", query: "crm pricing for small teams" },
    });
    expect(refreshCandidates([livePage({ age: 10 })], NO_POOLS, AT)).toEqual([]);
  });
});

describe("links in both directions (issue 1391): a page going live is linked from its nearest older pages", () => {
  const page = (slug: string, title: string, age: number, over: Partial<OwnLivePage> = {}): OwnLivePage =>
    livePage({ age, url: `https://blog.example.com/${slug}`, title, row: row(slug, "keyword_page", title.toLowerCase()), ...over });
  const fresh = page("crm-import", "How to import contacts into a CRM", 0);
  const older = [
    page("crm-pricing", "CRM pricing for small teams", 60),
    page("import-csv", "How to import a CSV of contacts", 45),
    page("email-tips", "Email subject lines that get opened", 90),
    page("crm-export", "How to export contacts from a CRM", 40),
  ];
  const targets = (pages: OwnLivePage[]): (string | null)[] =>
    linkBackCandidates(pages, fresh.url, AT).map((candidate) => candidate.targetRef);

  it("plans a refresh of the two nearest, each carrying the new page to link", () => {
    const planned = linkBackCandidates([...older, fresh], fresh.url, AT);
    expect(planned.map((candidate) => candidate.targetRef).sort()).toEqual([
      "https://blog.example.com/crm-export",
      "https://blog.example.com/import-csv",
    ]);
    expect(planned[0]).toMatchObject({
      type: "refresh_page",
      evidence: { shortfall: { kind: "due", cause: "link", link: { url: fresh.url, title: "How to import contacts into a CRM" } } },
    });
  });

  it("never touches a page the customer edited or stopped, one that already links it, or one inside §6's floor", () => {
    const [pricing, csv, , exported] = older as [OwnLivePage, OwnLivePage, OwnLivePage, OwnLivePage];
    expect(targets([{ ...pricing, stopped: true }, { ...csv, edited: true }, exported, fresh])).toEqual([exported.url]);
    expect(targets([{ ...csv, markdown: `See [the import guide](${fresh.url}).` }, fresh])).toEqual([]);
    expect(targets([page("import-csv", "How to import a CSV of contacts", 5), fresh])).toEqual([]);
  });

  it("a refresh going live is not news: nothing is planned for it", () => {
    const refreshed = { ...fresh, row: row("crm-import", "refresh_page", "how to import contacts into a crm", "due") };
    expect(linkBackCandidates([...older, refreshed], fresh.url, AT)).toEqual([]);
  });
});
