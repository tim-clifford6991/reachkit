// A "vs" between rivals that leaves the business out is written only from
// first-hand evidence about each rival (owner ruling R31, 2026-10-24):
// a claim off its own site, a study or a primary source, never a top result.
import "../env";
import { describe, expect, it } from "vitest";
import { buildPack, type PackInputs } from "../../../src/lib/generate/pipeline/pack";
import type { MarketFact } from "../../../src/lib/generate/pipeline/research";
import { AT, FACTS, opportunity, report } from "../fixtures";

/** One business of each kind, with two rivals of its market. */
const KINDS = [
  { kind: "software", name: "Acme", domain: "acme.example", category: "meeting scheduling software", rivals: [{ name: "Bookwell", domain: "bookwell.example" }, { name: "Slotly", domain: "slotly.example" }] },
  { kind: "local service", name: "Dale's Drains", domain: "dalesdrains.example", category: "drain cleaning", rivals: [{ name: "Pipeline Pros", domain: "pipelinepros.example" }, { name: "Clearflow", domain: "clearflow.example" }] },
  { kind: "shop", name: "Inkly", domain: "inkly.example", category: "temporary tattoos", rivals: [{ name: "Skinprint", domain: "skinprint.example" }, { name: "Flashink", domain: "flashink.example" }] },
] as const;

type Kind = (typeof KINDS)[number];

const fact = (over: Partial<MarketFact> & Pick<MarketFact, "url" | "kind">): MarketFact => ({
  title: over.url,
  readAt: AT,
  passage: `What ${over.url} states, word for word.`,
  ...over,
});
/** A claim off the rival's own pricing page. */
const ownSite = (domain: string) => fact({ url: `https://${domain}/pricing`, kind: "rival_pricing", product: domain });
/** A third party's ranking page that names the rival. */
const topResult = (domain: string) => fact({ url: `https://reviews.example.org/${domain}`, kind: "top_result", about: domain });
const study = (domain: string) => fact({ url: `https://research.example.edu/${domain}`, kind: "study", about: domain });

function pack(site: Kind, search: string, facts: MarketFact[], type: PackInputs["type"] = "listicle") {
  return buildPack({
    type,
    opportunity: opportunity({ targetQuery: search, targetRef: search, title: null, family: "write" }),
    site: { businessName: site.name, domain: site.domain, doNotClaim: [], rivals: site.rivals.map((rival) => rival.domain) },
    category: site.category,
    market: { from: "site", category: site.category, rivals: site.rivals },
    byline: null,
    voice: null,
    profile: null,
    facts: FACTS,
    research: { facts, products: [] },
    report: report(),
    sitePages: [],
    links: [],
    now: AT,
  });
}

describe("a rival-only 'vs' needs first-hand evidence about each rival", () => {
  for (const site of KINDS) {
    const [a, b] = site.rivals;
    const search = `${a.name.toLowerCase()} vs ${b.name.toLowerCase()}`;

    describe(`${site.kind} (${site.domain}): "${search}"`, () => {
      it("is short where the only claims about the rivals are off top search results", () => {
        expect(pack(site, search, [topResult(a.domain), topResult(b.domain)]).missing).toContain("rival_evidence");
      });

      it("is short where one rival has a first-hand claim and the other has none", () => {
        expect(pack(site, search, [ownSite(a.domain), topResult(b.domain)]).missing).toContain("rival_evidence");
      });

      it("holds where each rival has a claim off its own site, or off a study about it", () => {
        expect(pack(site, search, [ownSite(a.domain), ownSite(b.domain)]).missing).not.toContain("rival_evidence");
        expect(pack(site, search, [ownSite(a.domain), study(b.domain)]).missing).not.toContain("rival_evidence");
      });

      it("a 'vs' the business is a side of, and an update of a live page, are not held to it", () => {
        const own = `${site.name.toLowerCase()} vs ${a.name.toLowerCase()}`;
        expect(pack(site, own, [topResult(a.domain)]).missing).not.toContain("rival_evidence");
        expect(pack(site, search, [topResult(a.domain), topResult(b.domain)], "update").missing).not.toContain("rival_evidence");
      });
    });
  }
});
