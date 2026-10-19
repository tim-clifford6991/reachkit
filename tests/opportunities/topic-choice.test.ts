// SPEC §6 (issue 1506, from the SEO review of 2026-10-17, item 7) — a topic
// is one people search or ask AI about, in the business's own market.
// reachkit.app's stored rows of 18 October are the fixtures.
import "./env";
import { describe, expect, it } from "vitest";
import type { MarketConclusion } from "../../src/lib/market/infer/types";
import { comparisonBrands, sourceOf } from "../../src/lib/opportunities/derive/topics";
import { freshTopTen } from "../../src/lib/opportunities/derive/top-ten-kind";
import { pageTypeOf } from "../../src/lib/opportunities/page-type";
import { opportunityReady, type ReadinessContext } from "../../src/lib/opportunities/readiness";
import { readOpportunity, type OpportunityRow } from "../../src/lib/opportunities/store";
import type { Opportunity } from "../../src/lib/opportunities/types";
import { measured } from "../../src/lib/measure/measured";
import stored from "./fixtures/live-topics-1506.json";
import { AT, PROFILE } from "./fixtures";

const market = stored.market as unknown as MarketConclusion;
const BRANDS = { ...comparisonBrands({ report: null, market }), own: stored.own };
const rowOf = (name: string): Opportunity =>
  readOpportunity(stored.pages.find((page) => page.name === name)!.row as unknown as OpportunityRow);

const CTX: ReadinessContext = {
  grounded: true,
  earnGrounding: { comparison_table: true, integration_page: true, original_data_page: true },
  suppression: { clusters: new Set(), retiredUrls: new Set() },
  profile: PROFILE,
  ownRanks: () => false,
  canUpdate: () => true,
  coveredBy: () => null,
  brands: BRANDS,
  prompts: stored.prompts,
};

/** A "vs" row the way reachkit.app's queue held them. */
const versus = (query: string, over: Partial<Opportunity> = {}): Opportunity => ({
  ...rowOf("B"),
  id: query,
  targetQuery: query,
  clusterKey: null,
  ...over,
});

describe("a \"vs\" between products is ready only with measured demand (condition 1)", () => {
  it("page B: the business against a rival the market dropped, with no volume and no prompt naming it, is not ready", () => {
    expect(opportunityReady(rowOf("B"), CTX)).toBe("no_intent");
  });

  it("a rival against a rival, unmeasured: no tracked prompt makes it ready, answered naming both or not (issue 1552)", () => {
    expect(opportunityReady(versus("rankscale vs temso"), CTX)).toBe("no_intent");
    // The prompt "How does Profound compare with Peec AI…" names both; that alone is no longer demand.
    expect(opportunityReady(versus("profound vs peec ai"), CTX)).toBe("no_intent");
    const answer = (rivals: string[]) => [{ promptId: "cd9577b2", named: false, linked: false, rivals }];
    // Issue 1552: the prompt is ReachKit's own template, so its answer is no demand for the pair.
    expect(opportunityReady(versus("profound vs peec ai"), { ...CTX, answers: answer(["tryprofound.com", "peec.ai"]) })).toBe("no_intent");
    expect(opportunityReady(versus("profound vs peec ai"), { ...CTX, answers: answer(["tryprofound.com"]) })).toBe("no_intent");
    expect(opportunityReady(versus("profound vs peec ai"), { ...CTX, prompts: stored.prompts.slice(0, 2), answers: answer(["tryprofound.com", "peec.ai"]) })).toBe("no_intent");
  });

  it("a measured volume above zero makes it ready; a zero does not", () => {
    const volume = (value: number) => {
      const read = measured(value, AT);
      return { volume: read, evidence: { ...rowOf("B").evidence, volume: read } as Opportunity["evidence"] };
    };
    expect(opportunityReady(versus("reachkit vs aeo engine", volume(70)), CTX)).toBeNull();
    expect(opportunityReady(versus("reachkit vs aeo engine", volume(0)), CTX)).toBe("no_intent");
  });

  it("buyers seen asking it beside the market's searches (D62's store) make it ready; the search's own SERP does not", () => {
    // No tracked prompt, so D60's own rule (an unmeasured search matching no prompt) says nothing here.
    const asked = (term: string, peopleAlsoAsk: string[], related: string[] = []) => ({ ...CTX, prompts: [], asked: [{ term, peopleAlsoAsk, related }] });
    expect(opportunityReady(versus("rankscale vs temso"), asked("answer engine optimization", ["Is Rankscale better than Temso?"]))).toBeNull();
    expect(opportunityReady(versus("rankscale vs temso"), asked("AEO", [], ["rankscale vs temso"]))).toBeNull();
    expect(opportunityReady(versus("rankscale vs temso"), asked("rankscale vs temso", ["Is Rankscale better than Temso?"]))).toBe("no_intent");
    expect(opportunityReady(versus("rankscale vs temso"), asked("AEO", ["Is Rankscale worth it?"]))).toBe("no_intent");
  });

  it("a \"vs\" between two category terms is not held by it", () => {
    expect(
      opportunityReady(versus("answer engine optimization vs generative engine optimization", { source: "category" }), { ...CTX, prompts: [] })
    ).toBeNull();
  });
});

describe("a top ten of six or more of another kind of business is low_fit (condition 2)", () => {
  const topTen = (o: Opportunity) => (stored.topTens as Record<string, { domain: string; title: string }[]>)[o.targetQuery ?? ""] ?? null;

  it("page A: a software product's \"best AEO services\", whose stored top ten is agencies, is low_fit", () => {
    expect(opportunityReady(rowOf("A"), { ...CTX, topTen, business: { kind: "software", serves: null } })).toBe("low_fit");
  });

  it("a stored SERP older than 30 days says nothing", () => {
    const read = { at: new Date("2026-09-28T04:01:33.636Z"), rows: topTen(rowOf("A"))! };
    expect(freshTopTen(read, new Date("2026-10-18T12:00:00Z"))).toHaveLength(9);
    expect(freshTopTen(read, new Date("2026-10-29T12:00:00Z"))).toBeNull();
  });

  it("the same top ten is an agency's own market, and page D's articles are a software product's", () => {
    expect(opportunityReady(rowOf("A"), { ...CTX, topTen, business: { kind: "professional-services", serves: null } })).toBeNull();
    expect(opportunityReady(rowOf("D"), { ...CTX, topTen, business: { kind: "software", serves: null } })).toBeNull();
  });
});

describe("\"X vs Y\" between two category terms is an answer (condition 4)", () => {
  const brands = [...stored.own, "profound", "peec ai", "otterly"];
  const typed = (query: string) =>
    pageTypeOf({ type: "comparison_page", targetQuery: query, source: sourceOf(query, { brands, products: Object.keys(stored.market.demand.brands) }), pageType: null });

  it("two category terms are a question answered", () => {
    expect(typed("answer engine optimization vs generative engine optimization")).toBe("answer");
    expect(typed("aeo vs seo")).toBe("answer");
  });

  it("a product on either side keeps the page the product's, a dropped rival included", () => {
    expect(typed("reachkit vs aeo engine")).toBe("product");
    expect(typed("peec ai vs otterly")).toBe("product");
    expect(typed("rankscale vs temso")).toBe("product");
    expect(typed("aeo vs seo pricing")).toBe("product");
  });
});
