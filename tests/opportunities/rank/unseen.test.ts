// Issue 1538 — a page whose stored reading holds no Found step 28 days after
// it went live gets one link in from its cluster's strongest live page, and
// a rewrite only where D13's check finds it close to another site's page.
import "../env";
import { describe, expect, it } from "vitest";
import {
  foundIn,
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

const unseen = livePage("crm-for-dentists", { age: 28, found: false, seen: false, title: "CRM for dentists" });
const siblings = [
  livePage("crm-pricing", { age: 200, found: true, readPlace: 12 }),
  livePage("best-crm", { age: 100, found: true, readPlace: 4 }),
  livePage("crm-setup", { age: 300, found: true, readPlace: 2, edited: true }),
  livePage("crm-glossary", { age: 90, found: true, readPlace: 1, row: { ...livePage("x", { age: 1 }).row, clusterKey: "other" } }),
];
const linkedTo = (pages: readonly OwnLivePage[]) => unseenLinkCandidates(pages, AT).map((candidate) => candidate.targetRef);

describe("a page not found 28 days after going live gets a link in from its cluster's strongest page", () => {
  it("the sibling with the best reading, the customer's own passed over, links it as its refresh", () => {
    const planned = unseenLinkCandidates([unseen, ...siblings], AT);
    expect(planned.map((candidate) => candidate.targetRef)).toEqual(["https://blog.example.com/best-crm"]);
    expect(planned[0]).toMatchObject({ type: "refresh_page" });
    expect(planned[0]?.evidence).toMatchObject({
      shortfall: { kind: "due", cause: "link", link: { url: unseen.url, title: "CRM for dentists" } },
    });
  });

  it("27 days live: nothing; 28 days: the link", () => {
    expect(linkedTo([{ ...unseen, publishedAt: daysAgo(27) }, ...siblings])).toEqual([]);
    expect(linkedTo([{ ...unseen, publishedAt: daysAgo(28) }, ...siblings])).toEqual(["https://blog.example.com/best-crm"]);
  });

  it("a page found, and a page whose Found is not measured, get nothing", () => {
    expect(linkedTo([{ ...unseen, found: true }, ...siblings])).toEqual([]);
    expect(linkedTo([{ ...unseen, found: undefined }, ...siblings])).toEqual([]);
  });

  it("no sibling: nothing, and a sibling itself not found is no sibling", () => {
    expect(linkedTo([unseen, siblings[3]!])).toEqual([]);
    expect(linkedTo([unseen, { ...siblings[1]!, found: false }])).toEqual([]);
  });

  it("a sibling that already links it: nothing", () => {
    const linked = siblings.map((page, i) => (i === 0 ? { ...page, markdown: `See [dentists](${unseen.url}).` } : page));
    expect(linkedTo([unseen, ...linked])).toEqual([]);
  });

  it("a link into it planned lately: nothing", () => {
    expect(linkedTo([{ ...unseen, linkedLately: true }, ...siblings])).toEqual([]);
  });
});

describe("Found is measured only on a hosted page with a stored reading", () => {
  const reading = (reached: Record<string, string>) => ({ at: "2026-10-19T06:00:00.000Z", crawled: false, reached });
  it("hosted: found where the reading reached Found, not found where it did not", () => {
    expect(foundIn(reading({ found: "2026-09-20T06:00:00.000Z" }), "hosted")).toBe(true);
    expect(foundIn(reading({}), "hosted")).toBe(false);
  });

  it("no reading, or WordPress: not measured, never not found", () => {
    expect(foundIn(null, "hosted")).toBeUndefined();
    expect(foundIn(reading({}), "wordpress")).toBeUndefined();
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
