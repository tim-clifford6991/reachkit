// SPEC §7 (owner ruling B6, 2026-10-19; SEO review C1 and its shape ruling
// of 2026-10-20) — a search whose stored results ask for a provider's own
// page is written as the business's own offering page. Read on the customer panel's
// stored SERPs (`scripts/panel/evidence/`), through readiness and the
// memory store. 0¢.
import "./env";
import { afterEach, describe, expect, it } from "vitest";
import type { MarketConclusion } from "../../src/lib/market/infer/types";
import type { Profile } from "../../src/lib/market/questions/profile";
import { queryKey } from "../../src/lib/opportunities/cluster";
import { contentTypeOf } from "../../src/lib/opportunities/content-type";
import { offeringTopTen, resultClass, type KindOfBusiness, type TopTenRead } from "../../src/lib/opportunities/derive/top-ten-kind";
import { pageTypeOf } from "../../src/lib/opportunities/page-type";
import { pageForDay } from "../../src/lib/opportunities/plan";
import { assessReadiness } from "../../src/lib/opportunities/readiness";
import { readOpportunity, setOpportunityStore, type OpportunityRow } from "../../src/lib/opportunities/store";
import { TEMPLATES } from "../../src/lib/generate/templates";
import { memoryStore, newMemoryState } from "./memory-store";
import { AT, SITE_ID } from "./fixtures";
import { businessOf, storedSerps } from "../golden/plan/panel";

/** The newest stored SERP a panel site's passes bought for `search`. */
function storedSerp(domain: string, search: string): TopTenRead {
  const held = storedSerps(domain).get(queryKey(search));
  if (held === undefined) throw new Error(`no stored SERP for ${domain}: ${search}`);
  return { ...held, at: AT };
}

const shapeOf = (domain: string, search: string, business: KindOfBusiness | null = businessOf(domain)) =>
  offeringTopTen(storedSerp(domain, search), business, search) ? "offering" : "article";

describe("the stored results page decides an offering page, for each kind of business", () => {
  it.each([
    // List-shaped, with few providers' pages among articles.
    ["zunicafe.com", "best brunch place in san francisco", "article"],
    ["zunicafe.com", "top restaurants in san francisco ca", "article"],
    ["austinplumbery.com", "best plumber in austin texas", "article"],
    // A job seeker's search, whatever the local pack.
    ["alexander.co.uk", "financial accountant manchester", "article"],
    // The local path: a pack, one place served, no list words, at most 3 articles.
    ["fletcherelectric.co.uk", "eicr electrical leeds", "offering"],
    ["pdxsmiledesign.com", "cosmetic dentist in portland oregon", "offering"],
    // The organic path: a directory and a public body count for neither side.
    ["clearleft.com", "user research agency", "offering"],
    ["pdxsmiledesign.com", "dentist portland tn", "offering"],
    // A list-shaped search the results themselves overrule.
    ["pdxsmiledesign.com", "best dentist portland", "offering"],
    ["austinplumbery.com", "emergency plumber austin texas", "offering"],
    ["baeckerei-hinkel.de", "bäckerei düsseldorf", "offering"],
    ["savvycal.com", "find a time to meet", "offering"],
    ["tattly.com", "custom temporary tattoos", "offering"],
    ["savvycal.com", "best appointment scheduling software", "article"],
    ["streaksapp.com", "best habit tracker app", "article"],
    ["baeckerei-hinkel.de", "what is artisan bakery", "article"],
    // A local pack for a shop that sells everywhere.
    ["tattly.com", "temporary tattoos near me", "article"],
  ] as const)("%s: %s → %s", (domain, search, shape) => {
    expect(shapeOf(domain, search)).toBe(shape);
  });

  it("the first class that matches wins", () => {
    expect(resultClass({ domain: "www.yelp.com", url: "https://www.yelp.com/biz/austins-best-plumbing", title: "THE BEST 10 PLUMBING in Austin" })).toBe("third_party");
    expect(resultClass({ domain: "www.indeed.com", url: "https://www.indeed.com/q-plumber-jobs.html", title: "Plumber Jobs in Austin" })).toBe("job");
    expect(resultClass({ domain: "www.tn.gov", url: "https://www.tn.gov/health/dentists", title: "Dentists" })).toBe("public");
    expect(resultClass({ domain: "www.bestplumbers.com", url: "https://www.bestplumbers.com/austin", title: "Plumbers in Austin" })).toBe("third_party");
    expect(resultClass({ domain: "7x7.com", url: "https://www.7x7.com/brunch", title: "8 Excellent New Restaurants" })).toBe("article");
    expect(resultClass({ domain: "rotorooter.com", url: "https://www.rotorooter.com/austin/", title: "24 Hour Plumber in Austin" })).toBe("provider");
  });
});

describe("each threshold, at its edge", () => {
  const provider = (n: number) => ({ domain: `provider${n}.com`, url: `https://provider${n}.com/services/`, title: "Emergency plumbing in Leeds" });
  const article = (n: number) => ({ domain: `press${n}.com`, url: `https://press${n}.com/blog/leeds`, title: "Plumbing in Leeds" });
  const listing = (n: number) => ({ domain: "www.yelp.com", url: `https://www.yelp.com/biz/plumber-${n}`, title: "Plumber" });
  const job = (n: number) => ({ domain: `hire${n}.com`, url: `https://hire${n}.com/jobs/plumber`, title: "Plumber vacancy" });
  const rows = (p: number, a: number, t: number, j = 0) => [
    ...Array.from({ length: p }, (_, n) => provider(n)),
    ...Array.from({ length: a }, (_, n) => article(n)),
    ...Array.from({ length: t }, (_, n) => listing(n)),
    ...Array.from({ length: j }, (_, n) => job(n)),
  ];
  const LEEDS: KindOfBusiness = { kind: "local-service", serves: { name: "Leeds" } };
  const EVERYWHERE: KindOfBusiness = { kind: "software", serves: null };
  const offering = (read: Pick<TopTenRead, "rows" | "localPack">, query = "emergency plumber", business = EVERYWHERE) => offeringTopTen(read, business, query);

  it("organic: 4 providers ahead of the articles is one, 3 is not, and 4 beside 4 articles is not", () => {
    expect(offering({ rows: rows(4, 3, 3) })).toBe(true);
    expect(offering({ rows: rows(3, 0, 7) })).toBe(false);
    expect(offering({ rows: rows(4, 4, 2) })).toBe(false);
  });

  it("2 job pages leave it a buyer's search and 3 make it a job seeker's", () => {
    expect(offering({ rows: rows(5, 0, 3, 2) })).toBe(true);
    expect(offering({ rows: rows(5, 0, 2, 3) })).toBe(false);
  });

  it("6 results say something and 5 say nothing", () => {
    expect(offering({ rows: rows(6, 0, 0) })).toBe(true);
    expect(offering({ rows: rows(5, 0, 0) })).toBe(false);
  });

  it("a search to learn something is never one", () => {
    expect(offering({ rows: rows(7, 0, 3) }, "how to fix a leaking pipe")).toBe(false);
  });

  it("local: 3 articles beside the pack is one, 4 is not, a list-shaped search is not, a business that serves everywhere is not", () => {
    expect(offering({ rows: rows(0, 3, 7), localPack: true }, "plumber leeds", LEEDS)).toBe(true);
    expect(offering({ rows: rows(0, 4, 6), localPack: true }, "plumber leeds", LEEDS)).toBe(false);
    expect(offering({ rows: rows(0, 0, 10), localPack: true }, "best plumber leeds", LEEDS)).toBe(false);
    expect(offering({ rows: rows(0, 3, 7), localPack: true }, "plumber leeds", EVERYWHERE)).toBe(false);
  });
});

function market(over: Partial<MarketConclusion> & Pick<MarketConclusion, "category" | "kind" | "serves">): MarketConclusion {
  return { buyer: "", job: "", synonyms: [], differentiators: [], notOurMarket: [], categoryReason: "", rivals: [], ...over };
}

const PROFILE: Profile = {
  category: "plumbing services",
  offeringType: "plumbing repair",
  job: "fix a leak, a blocked drain or a water heater",
  audienceTerms: [],
  namedRivals: [],
  vocabulary: ["plumber", "plumbing", "drain", "water heater", "leak"],
  brandTokens: ["austin plumbery"],
};

function row(id: string, search: string, type: "keyword_page" | "answer_page" | "listed_page"): OpportunityRow {
  const volume = { kind: "measured", value: 880, at: AT.toISOString() };
  const evidence =
    type === "listed_page"
      ? { family: "earn", query: search, volume, source: { surface: "search_result", ref: search }, rival: { domain: "rotorooter.com" }, asset: "comparison_table" }
      : { family: "write", query: search, volume, rival: { domain: "rotorooter.com", url: { kind: "unmeasured", reason: "not_attempted", at: AT.toISOString() }, position: { kind: "unmeasured", reason: "not_attempted", at: AT.toISOString() } } };
  return {
    id, site_id: SITE_ID, scan_id: "scan", target_ref: search, proposed_slug: null, title: null,
    type, family: type === "listed_page" ? "earn" : "write", target_query: search,
    volume: 880, evidence, acceptance: { form: "top20", query: search },
    fit_band: "winnable", effort: 0.3, status: "open", business_fit: 3,
    cluster_key: null, absorbed_queries: [], ready: false, unready_reason: "not_assessed", created_at: AT.toISOString(),
  } as OpportunityRow;
}

/** The plumber's open rows behind the store, with the SERPs `topTens` holds. */
function standUp(rows: OpportunityRow[], topTens: ReadonlyMap<string, TopTenRead>) {
  const state = newMemoryState({ profile: PROFILE, market: market({ category: "residential plumbing", kind: "local-service", serves: { name: "Austin", region: "Texas" } }), now: AT });
  state.rows.push(...rows);
  setOpportunityStore({ ...memoryStore(state), topTenRows: async () => topTens });
  return state;
}

const typed = (stored: OpportunityRow) => contentTypeOf(readOpportunity(stored));

describe("readiness stores the shape, and every reader types the row by it", () => {
  afterEach(() => setOpportunityStore(null));

  const emergency = storedSerp("austinplumbery.com", "emergency plumber austin texas");

  it("a keyword page and a listed page on the plumber's stored local results are offering pages, of the product type, with the offering template", async () => {
    const state = standUp(
      [row("k", "emergency plumber austin texas", "keyword_page"), row("e", "austin emergency plumber", "listed_page")],
      new Map([
        [queryKey("emergency plumber austin texas"), emergency],
        [queryKey("austin emergency plumber"), storedSerp("austinplumbery.com", "austin emergency plumber")],
      ])
    );
    await assessReadiness(SITE_ID, { at: AT, now: AT });
    for (const stored of state.rows) {
      expect(typed(stored)).toBe("offering");
      expect(pageTypeOf(readOpportunity(stored))).toBe("product");
    }
    expect(TEMPLATES.offering.type).toBe("offering");
  });

  it("a results page of articles keeps its search's own type, and clears a shape stored before", async () => {
    const articles = storedSerp("austinplumbery.com", "fix leaking pipe");
    const held = row("k", "fix leaking pipe", "answer_page");
    const state = standUp([{ ...held, evidence: { ...(held.evidence as object), shape: "offering" } }], new Map([[queryKey("fix leaking pipe"), articles]]));
    await assessReadiness(SITE_ID, { at: AT, now: AT });
    expect(typed(state.rows[0]!)).toBe("how_to");
  });

  it("with no stored results page, or one older than 30 days, the row is typed as before", async () => {
    const stale = { ...emergency, at: new Date(AT.getTime() - 31 * 86_400_000) };
    const state = standUp(
      [row("none", "plumber austin weekends", "keyword_page"), row("stale", "emergency plumber austin texas", "keyword_page")],
      new Map([[queryKey("emergency plumber austin texas"), stale]])
    );
    await assessReadiness(SITE_ID, { at: AT, now: AT });
    expect(state.rows.map(typed)).toEqual(["qa", "qa"]);
  });

  it("a comparison stays a comparison whatever its results page shows", async () => {
    const state = standUp([{ ...row("c", "emergency plumber austin texas", "keyword_page"), type: "comparison_page" }], new Map([[queryKey("emergency plumber austin texas"), emergency]]));
    await assessReadiness(SITE_ID, { at: AT, now: AT });
    expect(typed(state.rows[0]!)).toBe("listicle");
  });

  it("a week already committed keeps its types through the evening check, and only the week's full pass reshapes it", async () => {
    const searches = ["emergency plumber austin texas", "austin emergency plumber", "plumbing services austin tx"];
    const week = searches.map((search, n) => ({ ...row(`d${n}`, search, "keyword_page"), plan_place: n, planned_for: `2026-10-2${n}` }));
    const state = standUp(week, new Map(searches.map((search) => [queryKey(search), storedSerp("austinplumbery.com", search)])));

    await pageForDay(SITE_ID, "2026-10-20", AT);
    expect(state.rows.map(typed)).toEqual(["qa", "qa", "qa"]);

    await assessReadiness(SITE_ID, { at: AT, now: AT });
    expect(state.rows.map(typed)).toEqual(["offering", "offering", "offering"]);
  });

  it("a row that already holds its shape is not written again, whatever order its stored keys come back in", async () => {
    const held = row("k", "emergency plumber austin texas", "keyword_page");
    // jsonb hands keys back in its own order, not the order they were written.
    const state = standUp([{ ...held, evidence: { shape: "offering", ...(held.evidence as object) } }], new Map([[queryKey("emergency plumber austin texas"), emergency]]));
    const writes: string[] = [];
    const store = memoryStore(state);
    setOpportunityStore({ ...store, topTenRows: async () => new Map([[queryKey("emergency plumber austin texas"), emergency]]), setEvidence: async (id) => void writes.push(id) });
    await assessReadiness(SITE_ID, { at: AT, now: AT });
    expect(writes).toEqual([]);
    expect(typed(state.rows[0]!)).toBe("offering");
  });
});
