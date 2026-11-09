// tests/opportunities/rival-versus-1552.test.ts — SPEC §6 (issue 1552,
// condition 2): a "vs" between two products, neither of them the business,
// needs demand ReachKit did not compose. Every tracked prompt is ReachKit's
// own wording, and its comparison prompts set the rivals against each other
// by template, so an answer to one is no demand for that pair. The fixtures
// are reachkit.app's rows of 18 October and the comparison prompts the
// customer panel stored for a local and a shop site.
import "./env";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { MarketConclusion } from "../../src/lib/market/infer/types";
import { measured } from "../../src/lib/measure/measured";
import { comparisonBrands, comparisonUnasked, type MeasuredAnswer } from "../../src/lib/opportunities/derive/topics";
import { eligible, type ReadinessContext } from "../../src/lib/opportunities/readiness";
import { readOpportunity, type OpportunityRow } from "../../src/lib/opportunities/store";
import type { Opportunity } from "../../src/lib/opportunities/types";
import stored from "./fixtures/live-topics-1506.json";
import { AT, PROFILE } from "./fixtures";

interface StoredSite {
  site: { domain: string };
  siteName: string | null;
  market: MarketConclusion;
  prompts?: { kind: string; text: string }[];
}

function panelSite(run: string, domain: string): StoredSite {
  const sites = (JSON.parse(readFileSync(`docs/walk/panel/${run}.json`, "utf8")) as { sites: StoredSite[] }).sites;
  return sites.find((held) => held.site.domain === domain)!;
}

const CTX: ReadinessContext = {
  now: AT,
  grounded: true,
  earnGrounding: { comparison_table: true, integration_page: true, original_data_page: true },
  suppression: { clusters: new Set(), retiredUrls: new Set() },
  profile: PROFILE,
  ownRanks: () => false,
  canUpdate: () => true,
  coveredBy: () => null,
  prompts: [],
};

const B = readOpportunity(stored.pages.find((page) => page.name === "B")!.row as unknown as OpportunityRow);

/** An open Write comparison row for `query`, measured at `volume`. */
function row(query: string, volume = 0): Opportunity {
  const measuredVolume = measured(volume, AT);
  return {
    ...B,
    id: query,
    targetQuery: query,
    clusterKey: null,
    family: "write",
    type: "comparison_page",
    volume: measuredVolume,
    evidence: { ...B.evidence, volume: measuredVolume } as Opportunity["evidence"],
  };
}

describe("a rival-only \"vs\" needs demand ReachKit did not compose (issue 1552)", () => {
  const market = stored.market as unknown as MarketConclusion;
  const prompts = stored.prompts;
  const ctx: ReadinessContext = { ...CTX, brands: { ...comparisonBrands({ report: null, market }), own: stored.own }, prompts };
  // ReachKit's templated prompt 41bb898a, "Peec AI or Otterly: which is the
  // better choice…", answered naming both.
  const both: MeasuredAnswer[] = [{ promptId: "41bb898a", named: false, linked: false, rivals: ["peec.ai", "otterly.ai"] }];

  it("SaaS: reachkit.app's \"peec ai vs otterly\" at 0 searches, with only the templated prompt, is no_intent", () => {
    expect(eligible(row("peec ai vs otterly"), { ...ctx, answers: both })).toBe("no_intent");
    // Measured volume, or buyers seen asking it beside another search, still makes it ready.
    expect(eligible(row("peec ai vs otterly", 90), { ...ctx, answers: both })).toBeNull();
    const asked = [{ term: "generative engine optimization", peopleAlsoAsk: ["Is Peec AI better than Otterly?"], related: [] }];
    expect(eligible(row("peec ai vs otterly"), { ...ctx, answers: both, asked })).toBeNull();
  });

  it("a \"vs\" the business is a side of still counts its prompt's measured answer", () => {
    const answers: MeasuredAnswer[] = [{ promptId: "cd9577b2", named: true, linked: false, rivals: ["tryprofound.com"] }];
    expect(comparisonUnasked({ query: "reachkit vs profound", volume: 0, brands: ctx.brands!, prompts, answers })).toBe(false);
    expect(comparisonUnasked({ query: "peec ai vs otterly", volume: 0, brands: ctx.brands!, prompts, answers: both })).toBe(true);
  });

  it.each([
    ["2026-10-09", "austinplumbery.com", "radiant plumbing vs reliant plumbing", ["radiantplumbing.com", "reliantplumbing.com"]],
    ["2026-10-14-1423", "tattly.com", "inked by dani vs easytatt", ["inkedbydani.com", "easytatt.com"]],
    ["2026-10-10-1374", "baeckerei-hinkel.de", "zeit für brot vs hercules bäckerei", ["zeitfuerbrot.com", "hercules-baeckerei.de"]],
  ] as const)("panel %s, %s: \"%s\" on its own templated prompt is no_intent", (run, domain, query, rivals) => {
    const site = panelSite(run, domain);
    const read = comparisonBrands({ report: null, market: site.market });
    const brands = { ...read, own: [...new Set([...read.own, (site.siteName ?? "").toLowerCase()])].filter((name) => name.length > 2) };
    const prompt = (site.prompts ?? []).filter((each) => each.kind === "comparison")[2]!;
    const prompts = [{ id: "templated", text: prompt.text }];
    const answers: MeasuredAnswer[] = [{ promptId: "templated", named: false, linked: false, rivals: [...rivals] }];
    expect(eligible(row(query), { ...CTX, brands, prompts, answers })).toBe("no_intent");
  });
});
