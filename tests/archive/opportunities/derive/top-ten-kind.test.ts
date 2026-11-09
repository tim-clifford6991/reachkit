// SPEC §6 (issue 1506) — a search whose stored top ten is mostly another
// kind of business is not this business's market, read on the six-type
// panel (`docs/walk/panel/sites.json`) and its stored SERPs
// (`scripts/panel/evidence/`), in English and German. 0¢.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BUSINESS_KIND_NAMES, type BusinessKind } from "../../../src/lib/market/kinds";
import { otherKindTopTen, type TopTenRow } from "../../../src/lib/opportunities/derive/top-ten-kind";
import stored from "../fixtures/live-topics-1506.json";

interface PanelSite {
  domain: string;
  kinds: BusinessKind[];
  language: string;
  place?: string[];
}

const PANEL: PanelSite[] = JSON.parse(readFileSync("docs/walk/panel/sites.json", "utf8")).sites;

/** Every top ten a panel site's passes stored, by its search. */
function storedTopTens(domain: string): { search: string; rows: TopTenRow[] }[] {
  const evidence: { source: string; cache_key: string; payload: { organic?: TopTenRow[] }[] }[] = JSON.parse(
    readFileSync(`scripts/panel/evidence/${domain}.json`, "utf8")
  );
  return evidence
    .filter((row) => row.source === "serp/google/organic")
    .map((row) => ({ search: row.cache_key.split("|")[0]!, rows: row.payload?.[0]?.organic ?? [] }));
}

const row = (title: string, url: string): TopTenRow => ({ title, url, domain: new URL(url).hostname });

describe("the panel's own searches are never read as another kind of business's", () => {
  it("covers the six kinds, and German", () => {
    const kinds = new Set(PANEL.flatMap((site) => site.kinds));
    expect([...BUSINESS_KIND_NAMES].filter((kind) => !kinds.has(kind))).toEqual([]);
    expect(PANEL.some((site) => site.language === "de")).toBe(true);
  });

  it.each(PANEL.map((site) => [site.domain, site] as const))("%s", (_domain, site) => {
    const held = site.kinds.flatMap((kind) =>
      storedTopTens(site.domain)
        .filter(({ rows }) => otherKindTopTen(rows, { kind, serves: site.place?.[0] ?? null }) !== null)
        .map(({ search }) => `${kind}: ${search}`)
    );
    expect(held).toEqual([]);
  });
});

describe("a top ten with six or more of the other kind is read as it, for each kind that has one", () => {
  const AGENCIES = (stored.topTens as Record<string, TopTenRow[]>)["best answer engine optimization services for ai visibility"]!;
  const ROUNDUPS = [
    row("10 Best Plumbers in Austin (2026)", "https://www.example-news.com/best-plumbers-austin"),
    row("Top 7 plumbing companies in Austin, TX", "https://citymag.example/top-7-plumbing-companies-austin"),
    row("The 12 best plumbers in Austin, reviewed", "https://localguide.example/blog/best-plumbers-austin"),
    row("Best plumbers in Austin 2026", "https://homeblog.example/guides/austin-plumbers"),
    row("Austin Plumbing Co | 24/7 Plumber", "https://austinplumbing.example/"),
    row("8 best emergency plumbers in Austin", "https://reviews.example/best-emergency-plumbers-austin"),
    row("Top 10 Austin plumbing services, ranked", "https://austinblog.example/top-10-austin-plumbing-services"),
  ];
  const LISTINGS = [
    row("Temporary Tattoos - Yelp", "https://www.yelp.com/search?find_desc=temporary+tattoos"),
    row("Temporary tattoo reviews | Trustpilot", "https://www.trustpilot.com/categories/tattoos"),
    row("Temporary tattoos - Reddit", "https://www.reddit.com/r/tattoos/"),
    row("Temporary tattoo boards on Pinterest", "https://www.pinterest.com/ideas/temporary-tattoos/"),
    row("Tattly | Temporary Tattoos", "https://tattly.com/"),
    row("Temporary tattoo shops - Yellow Pages", "https://www.yellowpages.com/search?search_terms=temporary+tattoos"),
    row("Temporary tattoos: questions and answers - Quora", "https://www.quora.com/topic/Temporary-Tattoos"),
  ];
  const AGENTUREN = [
    row("Die 10 besten SEO-Agenturen in Deutschland", "https://www.example.de/seo-agenturen"),
    row("KI-Sichtbarkeit: Agentur für Answer Engine Optimization", "https://aeo-agentur.example.de/"),
    row("GEO Beratung für Unternehmen", "https://beratung.example.de/geo"),
    row("Sichtbarkeit in ChatGPT messen – Software", "https://tool.example.de/"),
    row("Dienstleister für KI-Suche im Vergleich", "https://vergleich.example.de/dienstleister"),
    row("Agentur für generative Suchmaschinenoptimierung", "https://geo-agentur.example.de/"),
    row("SEO Agentur Berlin – KI-Sichtbarkeit", "https://seo-berlin.example.de/"),
  ];
  const RATGEBER = [
    row("Die 10 besten Elektriker in Düsseldorf 2026", "https://www.stadtmagazin.example.de/beste-elektriker-duesseldorf"),
    row("Top 5 Elektriker in Düsseldorf", "https://ratgeber.example.de/top-5-elektriker-duesseldorf"),
    row("Elektriker Düsseldorf: die besten 2026", "https://blog.example.de/blog/elektriker-duesseldorf"),
    row("Elektro Meier – Ihr Elektriker in Düsseldorf", "https://elektro-meier.example.de/"),
    row("Beste Elektriker in Düsseldorf: 8 Betriebe im Vergleich", "https://vergleich.example.de/elektriker-duesseldorf"),
    row("Die 7 besten Elektrobetriebe in Düsseldorf", "https://nrw-magazin.example.de/beste-elektrobetriebe-duesseldorf"),
    row("Top 10 Elektriker Düsseldorf – Bewertungen 2026", "https://bewertet.example.de/top-10-elektriker-duesseldorf"),
  ];

  it.each<[string, TopTenRow[], BusinessKind, unknown, string | null]>([
    ["a software product, a top ten of agencies (page A)", AGENCIES, "software", null, "agency"],
    ["a software product in German, a top ten of Agenturen", AGENTUREN, "software", null, "agency"],
    ["a local service, a top ten of round-ups", ROUNDUPS, "local-service", { name: "Austin" }, "publisher"],
    ["a local service in German, a top ten of round-ups", RATGEBER, "local-service", { name: "Düsseldorf" }, "publisher"],
    ["a shop that sells everywhere, a top ten of listings", LISTINGS, "shop", null, "directory"],
    ["a shop that serves one place: listings are its market", LISTINGS, "shop", { name: "Düsseldorf" }, null],
    ["a café: listings are its market", LISTINGS, "hospitality", { name: "San Francisco" }, null],
    ["an agency: agencies are its market", AGENCIES, "professional-services", null, null],
    ["a creator: articles are its market", ROUNDUPS, "creator", null, null],
  ])("%s", (_name, rows, kind, serves, expected) => {
    expect(otherKindTopTen(rows, { kind, serves })).toBe(expected);
  });

  it("five of the other kind are not enough, and a market read before kinds says nothing", () => {
    // Page A's top ten holds six agencies; five of them are not its market's make-up.
    const agencies = AGENCIES.filter((result) => /agenc|services|companies/i.test(result.title ?? ""));
    expect(agencies).toHaveLength(6);
    expect(otherKindTopTen(AGENCIES.filter((result) => result !== agencies[0]), { kind: "software", serves: null })).toBeNull();
    expect(otherKindTopTen(AGENCIES, { kind: null, serves: null })).toBeNull();
  });
});
