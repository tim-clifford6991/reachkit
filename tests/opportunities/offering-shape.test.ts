// SPEC §7 (owner ruling B6, 2026-10-19; SEO review C1) — a search whose
// stored results are mostly providers' own service or product pages is
// written as the business's own offering page. Read on the customer panel's
// stored SERPs (`scripts/panel/evidence/`), through readiness and the
// memory store. 0¢.
import "./env";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import type { MarketConclusion } from "../../src/lib/market/infer/types";
import type { Profile } from "../../src/lib/market/questions/profile";
import { queryKey } from "../../src/lib/opportunities/cluster";
import { contentTypeOf } from "../../src/lib/opportunities/content-type";
import { offeringTopTen, type KindOfBusiness, type TopTenRead, type TopTenRow } from "../../src/lib/opportunities/derive/top-ten-kind";
import { pageTypeOf } from "../../src/lib/opportunities/page-type";
import { assessReadiness } from "../../src/lib/opportunities/readiness";
import { readOpportunity, setOpportunityStore, type OpportunityRow } from "../../src/lib/opportunities/store";
import { TEMPLATES } from "../../src/lib/generate/templates";
import { memoryStore, newMemoryState } from "./memory-store";
import { AT, SITE_ID } from "./fixtures";

/** The newest stored SERP a panel site's passes bought for `search`. */
function storedSerp(domain: string, search: string): TopTenRead {
  const evidence: { source: string; cache_key: string; created_at: string; payload: { organic?: TopTenRow[]; localPack?: unknown[] }[] | null }[] =
    JSON.parse(readFileSync(`scripts/panel/evidence/${domain}.json`, "utf8"));
  const held = evidence
    .filter((row) => row.source === "serp/google/organic" && row.cache_key.split("|")[0] === search && (row.payload?.[0]?.organic ?? []).length > 0)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  if (held === undefined) throw new Error(`no stored SERP for ${domain}: ${search}`);
  const serp = held.payload![0]!;
  return { at: AT, rows: serp.organic!, localPack: (serp.localPack ?? []).length > 0 };
}

const PLUMBER: KindOfBusiness = { kind: "local-service", serves: { name: "Austin" } };
const BAKERY: KindOfBusiness = { kind: "local-service", serves: { name: "Düsseldorf" } };
const SAAS: KindOfBusiness = { kind: "software", serves: null };
const SHOP: KindOfBusiness = { kind: "shop", serves: null };

describe("the stored results page decides an offering page, for each kind of business", () => {
  it.each([
    ["local service", "austinplumbery.com", "emergency plumber austin texas", PLUMBER],
    ["local service, in German", "baeckerei-hinkel.de", "bäckerei düsseldorf", BAKERY],
    ["SaaS feature", "savvycal.com", "find a time to meet", SAAS],
    ["shop category", "tattly.com", "custom temporary tattoos", SHOP],
  ] as const)("%s: %s asks for one", (_kind, domain, search, business) => {
    expect(offeringTopTen(storedSerp(domain, search), business)).toBe(true);
  });

  it.each([
    ["a SaaS round-up", "savvycal.com", "best appointment scheduling software", SAAS],
    ["a SaaS category of lists", "streaksapp.com", "best habit tracker app", SAAS],
    ["an explainer", "baeckerei-hinkel.de", "what is artisan bakery", BAKERY],
    // A local pack is a provider's page only for a business that serves one place.
    ["a local pack beside articles, for a shop that sells everywhere", "tattly.com", "temporary tattoos near me", SHOP],
  ] as const)("%s: %s does not", (_kind, domain, search, business) => {
    expect(offeringTopTen(storedSerp(domain, search), business)).toBe(false);
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
});
