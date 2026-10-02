// #1185 and D24: a rival is a product in the concluded market — never a
// publisher, aggregator or platform, never the site itself — and a reason
// never claims a sighting the evidence does not hold.
import "../../generate/env";
import { describe, expect, it } from "vitest";
import { concludeRivals, type RivalsAnswer } from "@/lib/market/infer/infer";
import type { MarketEvidence } from "@/lib/market/infer/evidence";

const EVIDENCE: MarketEvidence = {
  domain: "reachkit.app",
  siteName: "ReachKit",
  headline: "See what AI tells buyers about your market",
  measuredUnder: "SEO software",
  pages: [],
  products: [],
  claims: [],
  answers: [{ question: "best ai visibility tools", citedDomains: ["athenahq.ai", "youtube.com"], namesSite: false }],
  ownSearches: [],
  topTens: [{ domain: "zapier.com", appearances: 4, title: "The best SEO tools" }],
};

type Candidate = RivalsAnswer["candidates"][number];
const product = (domain: string, extra: Partial<Candidate> = {}): Candidate => ({
  domain,
  name: domain,
  kind: "product",
  inMarket: true,
  basis: "same_job",
  reason: `${domain} tracks brands in AI answers.`,
  ...extra,
});

describe("concludeRivals", () => {
  it("keeps only products in the market, dropping sources, the site itself and suites outside the market", () => {
    const rivals = concludeRivals(
      {
        candidates: [
          product("athenahq.ai", { basis: "ai_answer" }),
          product("zapier.com", { kind: "publisher", basis: "ranks" }),
          product("youtube.com"),
          product("reachkit.app"),
          product("ahrefs.com", { inMarket: false }),
          product("https://www.tryprofound.com/pricing"),
        ],
      },
      EVIDENCE
    );
    expect(rivals.map((r) => r.domain)).toEqual(["athenahq.ai", "tryprofound.com"]);
  });

  it("restates a sighting the evidence does not hold as a rival known from the market", () => {
    const [rival] = concludeRivals({ candidates: [product("peec.ai", { basis: "ai_answer" })] }, EVIDENCE);
    expect(rival?.basis).toBe("same_job");
  });

  it("keeps at most five, closest first", () => {
    const rivals = concludeRivals({ candidates: ["a.ai", "b.ai", "c.ai", "d.ai", "e.ai", "f.ai"].map((d) => product(d)) }, EVIDENCE);
    expect(rivals.map((r) => r.domain)).toEqual(["a.ai", "b.ai", "c.ai", "d.ai", "e.ai"]);
  });
});
