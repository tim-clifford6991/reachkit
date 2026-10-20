// SPEC §7 (owner 2026-10-18, issue 1521): the `close` and `stale_prices`
// refresh causes.
import "./env";
import { describe, expect, it } from "vitest";
import { isCloseUpdate } from "../../src/lib/opportunities/close";
import {
  absorbedBy,
  oldestPriceOf,
  refreshCandidates,
  refreshCauseOf,
  stalePriceCandidates,
  type OwnLivePage,
  type RefreshPools,
} from "../../src/lib/opportunities/refresh";
import type { Opportunity } from "../../src/lib/opportunities/types";

const AT = new Date("2026-10-18T06:00:00.000Z");
const daysAgo = (days: number) => new Date(AT.getTime() - days * 86_400_000);
const URL = "https://content.example.com/crm-pricing";
const SEARCH = "crm pricing for small teams";

function livePage(a: Partial<OwnLivePage> & { age: number }): OwnLivePage {
  return {
    url: URL,
    publishedAt: daysAgo(a.age),
    row: {
      id: "written",
      siteId: "site",
      scanId: "scan",
      family: "write",
      type: "keyword_page",
      status: "open",
      targetQuery: SEARCH,
      targetRef: "crm-pricing",
      evidence: { family: "write" },
      acceptance: { form: "top20", query: SEARCH },
    } as unknown as Opportunity,
    declined: false,
    facts: [],
    marketFacts: [],
    ...a,
  };
}

const ranked = (url: string, position: number, keyword = SEARCH): RefreshPools => ({ siteText: [], market: [], ranked: [{ keyword, url, position }] });

describe("a page of ours close to page one is due a `close` refresh", () => {
  it("its own address at 4–20 for its own search, 30 days old or more; no other address or search places it", () => {
    expect(refreshCauseOf(livePage({ age: 40 }), ranked("https://content.example.com/crm-pricing/", 8), AT)).toBe("close");
    expect(refreshCauseOf(livePage({ age: 40 }), ranked(URL, 4), AT)).toBe("close");
    expect(refreshCauseOf(livePage({ age: 40 }), ranked(URL, 20), AT)).toBe("close");
    expect(refreshCauseOf(livePage({ age: 40 }), ranked(URL, 3), AT)).toBeNull();
    expect(refreshCauseOf(livePage({ age: 40 }), ranked(URL, 21), AT)).toBeNull();
    expect(refreshCauseOf(livePage({ age: 20 }), ranked(URL, 8), AT)).toBeNull();
    // Another page of the site, or another search, does not place it.
    expect(refreshCauseOf(livePage({ age: 40 }), ranked("https://example.com/", 6), AT)).toBeNull();
    expect(refreshCauseOf(livePage({ age: 40 }), ranked(URL, 6, "crm pricing"), AT)).toBeNull();
  });

  it("goes ahead of a newer fact and of age, and after a lost place", () => {
    const cited = { url: "https://rival.example.net/pricing", passage: "Team is $49 per seat." };
    const pools = { ...ranked(URL, 9), market: [{ ...cited, passage: "Team is $59 per seat.", readAt: daysAgo(2) }] };
    expect(refreshCauseOf(livePage({ age: 120, marketFacts: [cited] }), pools, AT)).toBe("close");
    expect(refreshCauseOf(livePage({ age: 120, declined: true }), pools, AT)).toBe("lost_position");
  });

  it("ranks as a close update, and takes the place of the page's own `answerable_page`", () => {
    const [refresh] = refreshCandidates([livePage({ age: 40 })], ranked(URL, 9), AT);
    expect(refresh?.evidence).toMatchObject({ shortfall: { kind: "due", cause: "close" } });
    expect(isCloseUpdate(refresh as unknown as Opportunity)).toBe(true);
    const open = [
      { id: "same-page", type: "answerable_page" as const, targetRef: "https://www.content.example.com/crm-pricing" },
      { id: "other-page", type: "answerable_page" as const, targetRef: "https://example.com/" },
      { id: "a-write", type: "keyword_page" as const, targetRef: URL },
    ];
    expect(absorbedBy([refresh!], open)).toEqual(["same-page"]);
    const [aged] = refreshCandidates([livePage({ age: 120 })], { siteText: [], market: [] }, AT);
    expect(absorbedBy([aged!], open)).toEqual([]);
  });
});

describe("a comparison whose rival prices are older than D59's 30 days is due `stale_prices`", () => {
  const facts = (days: number) => [
    { kind: "rival_features", readAt: daysAgo(90).toISOString(), passage: "Has a mobile app.", url: "https://rival.example.net/" },
    { kind: "rival_pricing", readAt: daysAgo(days).toISOString(), passage: "Team is $49 per seat.", url: "https://rival.example.net/pricing" },
  ];

  it("the oldest rival price its version was written from, read off its row", () => {
    expect(oldestPriceOf(facts(31))).toEqual(daysAgo(31));
    expect(oldestPriceOf([facts(31)[0]])).toBeUndefined();
  });

  it("is due once that price is 31 days old, and not at 30", () => {
    expect(refreshCauseOf(livePage({ age: 45, oldestPrice: daysAgo(31) }), { siteText: [], market: [] }, AT)).toBe("stale_prices");
    expect(refreshCauseOf(livePage({ age: 45, oldestPrice: daysAgo(30) }), { siteText: [], market: [] }, AT)).toBeNull();
  });

  it("the hourly re-check plans it, but not for a page whose refresh was stopped or that is under the floor", () => {
    expect(stalePriceCandidates([livePage({ age: 45, oldestPrice: daysAgo(40) })], AT)[0]?.evidence).toMatchObject({ shortfall: { cause: "stale_prices" } });
    expect(stalePriceCandidates([livePage({ age: 45, oldestPrice: daysAgo(40), stopped: true })], AT)).toEqual([]);
    expect(stalePriceCandidates([livePage({ age: 20, oldestPrice: daysAgo(40) })], AT)).toEqual([]);
  });
});
