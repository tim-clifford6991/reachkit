// SPEC §6 (owner D64, issue 1301): a search that is only a rival's brand
// name is navigational and never a topic. reachkit.app's re-measure of
// 2026-10-07 stored "rankscale ai" (90 a month) as a page to write.
import { describe, expect, it } from "vitest";
import type { MarketConclusion } from "@/lib/market/infer/types";
import { productsNamed, rivalBrandOnly } from "@/lib/opportunities/derive/topics";

const market: MarketConclusion = {
  buyer: "",
  job: "",
  category: "generative engine optimization",
  synonyms: [],
  differentiators: [],
  notOurMarket: [],
  categoryReason: "",
  rivals: [
    { domain: "rankscale.ai", name: "Rankscale", basis: "ai_answer", reason: "", searchNames: ["rankscale", "rankscale ai"], volume: 480 },
    { domain: "tryprofound.com", name: "Profound", basis: "ai_answer", reason: "", searchNames: ["profound ai"], volume: 6600 },
  ],
  demand: { at: "2026-10-06T00:00:00.000Z", own: 0, brands: { rankscale: 480, "rankscale ai": 90, "profound ai": 6600, "peec ai": 2400, reachkit: 0 } },
};
const judged = (query: string): boolean => rivalBrandOnly(query, { market, own: ["reachkit"], rivals: [] });

describe("a search that is only a rival's brand name", () => {
  it("is one under any name the rival is searched by, and for a product the market read and did not keep", () => {
    for (const query of ["rankscale ai", "Rankscale", "rankscale.ai", "profound ai", "tryprofound", "peec ai"]) expect(judged(query), query).toBe(true);
  });

  it("is not one where the name stands beside anything else, or is the business's own", () => {
    for (const query of ["rankscale alternatives", "profound vs rankscale", "rankscale pricing", "how to rank in ai overview", "reachkit"]) {
      expect(judged(query), query).toBe(false);
    }
  });
});

describe("two searches are one question only where they name the same products", () => {
  const products = (query: string): string => productsNamed(query, { market, rivals: [] });

  it("a rival's alternatives are not another rival's, and a pair is the same pair in either order", () => {
    expect(products("profound alternatives")).not.toBe(products("rankscale alternatives"));
    expect(products("profound vs rankscale")).toBe(products("rankscale ai vs profound ai"));
    expect(products("aeo pricing")).toBe(products("answer engine optimization pricing"));
  });
});
