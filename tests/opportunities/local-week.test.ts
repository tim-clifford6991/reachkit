// SPEC §6 (issue 1561) — a local business fills a week as a software maker
// does. Each site's topics are the searches its panel passes stored a top
// ten for (`scripts/panel/evidence/`), on its market, at the volume the
// vendor gave, judged fit 2, the band winnable: readiness and the ranking
// run for real over them. A German tradesman has no panel site yet, so its
// searches are a drafted fixture of the same shape
// (`fixtures/handwerker-1561.json`). 0¢.
import "./env";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import type { MarketConclusion } from "../../src/lib/market/infer/types";
import type { Profile } from "../../src/lib/market/questions/profile";
import { queryKey } from "../../src/lib/opportunities/cluster";
import type { TopTenRead, TopTenRow } from "../../src/lib/opportunities/derive/top-ten-kind";
import { rankOpen } from "../../src/lib/opportunities/rank/open";
import { assessReadiness } from "../../src/lib/opportunities/readiness";
import { setOpportunityStore, type OpportunityRow } from "../../src/lib/opportunities/store";
import { memoryStore, newMemoryState } from "./memory-store";
import { AT, SITE_ID } from "./fixtures";
import handwerker from "./fixtures/handwerker-1561.json";

/** Seven days and three spares. */
const WEEK = 7 + 3;

interface StoredSearch {
  search: string;
  volume: number | null;
  organic: TopTenRow[];
  /** The business fit a pass judged; 2 where the fixture gives none. */
  fit?: number;
}

interface LocalSite {
  profile: Profile;
  market: MarketConclusion;
  searches: StoredSearch[];
}

/** The searches a panel site's passes stored a top ten for, on its market
 *  (the panel's own `market` stems), with the vendor's volume where a
 *  keyword call read one. */
function panelSearches(domain: string): StoredSearch[] {
  const panel: { domain: string; market: string[] }[] = JSON.parse(readFileSync("docs/walk/panel/sites.json", "utf8")).sites;
  const stems = panel.find((site) => site.domain === domain)!.market;
  const evidence: { source: string; cache_key: string; payload: unknown }[] = JSON.parse(
    readFileSync(`scripts/panel/evidence/${domain}.json`, "utf8")
  );
  const volumes = new Map<string, number>();
  for (const row of evidence) {
    if (!row.source.startsWith("dataforseo_labs/google/keyword_")) continue;
    for (const item of (row.payload as { keyword?: string; searchVolume?: number | null }[] | null) ?? []) {
      if (item.keyword !== undefined && typeof item.searchVolume === "number") volumes.set(item.keyword.toLowerCase(), item.searchVolume);
    }
  }
  const out = new Map<string, StoredSearch>();
  for (const row of evidence) {
    if (row.source !== "serp/google/organic") continue;
    const search = row.cache_key.split("|")[0]!.toLowerCase();
    if (out.has(search) || !stems.some((stem) => search.includes(stem))) continue;
    const organic = ((row.payload as { organic?: TopTenRow[] }[] | null)?.[0]?.organic ?? []) as TopTenRow[];
    out.set(search, { search, volume: volumes.get(search) ?? null, organic });
  }
  return [...out.values()];
}

function market(over: Partial<MarketConclusion> & Pick<MarketConclusion, "category" | "kind" | "serves">): MarketConclusion {
  return { buyer: "", job: "", synonyms: [], differentiators: [], notOurMarket: [], categoryReason: "", rivals: [], ...over };
}

function profile(over: Partial<Profile> & Pick<Profile, "category" | "offeringType" | "job" | "brandTokens">): Profile {
  return { audienceTerms: [], namedRivals: [], vocabulary: [], ...over };
}

const PLUMBER: LocalSite = {
  profile: profile({
    category: "plumbing services",
    offeringType: "plumbing repair",
    job: "fix a leak, a blocked drain or a water heater",
    vocabulary: ["plumber", "plumbing", "drain", "water heater", "leak"],
    brandTokens: ["austin plumbery"],
    kind: "local-service",
    town: "Austin",
  }),
  market: market({
    category: "residential plumbing",
    synonyms: ["plumber", "emergency plumber", "drain cleaning"],
    kind: "local-service",
    serves: { name: "Austin", region: "Texas" },
  }),
  searches: panelSearches("austinplumbery.com"),
};

const RESTAURANT: LocalSite = {
  profile: profile({
    category: "restaurant",
    offeringType: "restaurant",
    job: "eat out in San Francisco",
    vocabulary: ["restaurant", "dining", "brunch", "lunch", "dinner", "places to eat", "cafe"],
    brandTokens: ["zuni"],
    kind: "hospitality",
    town: "San Francisco",
  }),
  market: market({
    category: "restaurant",
    synonyms: ["fine dining", "brunch", "dining"],
    kind: "hospitality",
    serves: { name: "San Francisco", region: "California" },
  }),
  searches: panelSearches("zunicafe.com"),
};

const HANDWERKER = handwerker as unknown as LocalSite;

function topic(n: number, at: StoredSearch): OpportunityRow {
  const volume = at.volume === null ? { kind: "unmeasured", reason: "undeterminable", at: AT.toISOString() } : { kind: "measured", value: at.volume, at: AT.toISOString() };
  return {
    id: `t${n}`, site_id: SITE_ID, scan_id: "scan", target_ref: at.search, proposed_slug: null, title: null,
    type: "keyword_page", family: "write", target_query: at.search,
    volume: at.volume, evidence: { family: "write", volume }, acceptance: { form: "top20", query: at.search },
    fit_band: "winnable", effort: 0.3, status: "open", business_fit: at.fit ?? 2,
    cluster_key: null, absorbed_queries: [], ready: false, unready_reason: "not_assessed", created_at: AT.toISOString(),
  } as OpportunityRow;
}

async function week(site: LocalSite): Promise<{ ranked: number; held: Record<string, string[]> }> {
  const state = newMemoryState({ profile: site.profile, market: site.market, now: AT });
  state.rows.push(...site.searches.map((at, n) => topic(n, at)));
  const topTens = new Map<string, TopTenRead>(site.searches.map((at) => [queryKey(at.search), { at: AT, rows: at.organic }]));
  setOpportunityStore({ ...memoryStore(state), topTenRows: async () => topTens });
  await assessReadiness(SITE_ID, { at: AT, now: AT });
  const held: Record<string, string[]> = {};
  for (const row of state.rows.filter((row) => !row.ready)) (held[row.unready_reason ?? ""] ??= []).push(row.target_query ?? "");
  return { ranked: (await rankOpen(SITE_ID, AT)).length, held };
}

afterEach(() => setOpportunityStore(null));

describe("a local business fills seven days and three spares from its own stored searches (issue 1561)", () => {
  it.each([
    ["a plumber in Austin", PLUMBER],
    ["a restaurant in San Francisco", RESTAURANT],
    ["a German tradesman in Köln", HANDWERKER],
  ] as const)("%s", async (_name, site) => {
    const { ranked, held } = await week(site);
    expect(ranked, `held: ${JSON.stringify(held)}`).toBeGreaterThanOrEqual(WEEK);
  });
});
