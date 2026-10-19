// Issue 1538, condition 2 — a page no stored search result has held after
// 28 days live gets one link in from its cluster's strongest live page, and
// a rewrite only where D13's check finds it close to another site's page.
import "../env";
import { describe, expect, it } from "vitest";
import {
  refreshCauseOf,
  unseenLinkCandidates,
  type OwnLivePage,
  type RefreshPools,
} from "../../../src/lib/opportunities/refresh";
import type { Opportunity } from "../../../src/lib/opportunities/types";

const AT = new Date("2026-10-19T06:00:00.000Z");
const daysAgo = (days: number) => new Date(AT.getTime() - days * 86_400_000);
const NO_POOLS: RefreshPools = { siteText: [], market: [] };

function livePage(slug: string, a: Partial<OwnLivePage> & { age: number }): OwnLivePage {
  return {
    url: `https://blog.example.com/${slug}`,
    publishedAt: daysAgo(a.age),
    row: {
      id: slug,
      siteId: "site",
      scanId: "scan",
      family: "write",
      type: "keyword_page",
      status: "done",
      clusterKey: "crm",
      targetQuery: slug.replace(/-/g, " "),
      targetRef: null,
      absorbedQueries: [],
      volume: null,
      fitBand: "winnable",
      acceptance: { form: "top20", query: slug.replace(/-/g, " ") },
      evidence: { family: "write" },
      createdAt: AT,
    } as unknown as Opportunity,
    declined: false,
    facts: [],
    marketFacts: [],
    title: slug,
    markdown: "",
    ...a,
  };
}

const unseen = livePage("crm-for-dentists", { age: 28, seen: false, title: "CRM for dentists" });
const siblings = [
  livePage("crm-pricing", { age: 200, seen: true, place: 12 }),
  livePage("best-crm", { age: 100, seen: true, place: 4 }),
  livePage("crm-setup", { age: 300, seen: true, place: 2, edited: true }),
  livePage("crm-glossary", { age: 90, seen: true, place: 1, row: { ...livePage("x", { age: 1 }).row, clusterKey: "other" } }),
];

describe("a page not verified for 28 days gets a link in from its cluster's strongest page", () => {
  it("the seen sibling with the best place, the customer's own passed over, links it", () => {
    const planned = unseenLinkCandidates([unseen, ...siblings], AT);
    expect(planned.map((candidate) => candidate.targetRef)).toEqual(["https://blog.example.com/best-crm"]);
    expect(planned[0]?.evidence).toMatchObject({
      shortfall: { kind: "due", cause: "link", link: { url: unseen.url, title: "CRM for dentists" } },
    });
  });

  it("nothing before 28 days, nothing for a seen page, nothing where its state is not known", () => {
    expect(unseenLinkCandidates([{ ...unseen, publishedAt: daysAgo(27) }, ...siblings], AT)).toEqual([]);
    expect(unseenLinkCandidates([{ ...unseen, seen: true }, ...siblings], AT)).toEqual([]);
    expect(unseenLinkCandidates([{ ...unseen, seen: undefined }, ...siblings], AT)).toEqual([]);
  });

  it("nothing once a seen sibling links it", () => {
    const linked = siblings.map((page, i) => (i === 0 ? { ...page, markdown: `See [dentists](${unseen.url}).` } : page));
    expect(unseenLinkCandidates([unseen, ...linked], AT)).toEqual([]);
  });
});

describe("the page itself is rewritten only where D13's check, run again, finds it close", () => {
  it("close to a page written for another site: an unseen refresh", () => {
    expect(refreshCauseOf({ ...unseen, publishedAt: daysAgo(30), closeElsewhere: true }, NO_POOLS, AT)).toBe("unseen");
    expect(refreshCauseOf({ ...unseen, publishedAt: daysAgo(30) }, NO_POOLS, AT)).toBeNull();
  });

  it("a page never seen is not retargeted as one that failed its search", () => {
    expect(refreshCauseOf({ ...unseen, publishedAt: daysAgo(60), unmet: true }, NO_POOLS, AT)).toBeNull();
    expect(refreshCauseOf({ ...unseen, publishedAt: daysAgo(60), unmet: true, seen: true }, NO_POOLS, AT)).toBe("unmet");
  });
});
