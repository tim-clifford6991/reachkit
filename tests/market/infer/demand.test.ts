// SPEC §6 (owner D50 of 2026-10-05, issue 1271): rival choice weighs how
// often buyers search a candidate's brand, and a pass buys a brand's volume
// once.
import { describe, expect, it } from "vitest";
import { byDemand, keywordsOwed, mergeDemand } from "@/lib/market/infer/demand";
import { settleRivals, type StoredMarketWithChange } from "@/lib/market/infer/stability";
import { EMPTY_STORED_MARKET, type BrandDemand, type RivalConclusion } from "@/lib/market/infer/types";

const AT = new Date("2026-10-06T12:00:00Z");

const rival = (domain: string, name: string, basis: RivalConclusion["basis"], searchNames?: string[]): RivalConclusion => ({
  domain,
  name,
  basis,
  reason: "",
  ...(searchNames === undefined ? {} : { searchNames }),
});

/** reachkit.app's candidates, in the order its evidence named them. */
const CANDIDATES = [
  rival("aeoengine.ai", "AEO Engine", "ai_answer"),
  rival("maxaeo.com", "MaxAEO", "ranks"),
  rival("tryprofound.com", "Profound", "same_job", ["profound ai"]),
  rival("peec.ai", "Peec AI", "same_job"),
  rival("otterly.ai", "Otterly", "ai_answer", ["otterly", "otterly ai"]),
];
const DEMAND: BrandDemand = {
  at: "2026-10-05T00:00:00.000Z",
  own: 0,
  brands: { "aeo engine": 70, maxaeo: 0, "profound ai": 6600, "peec ai": 2400, "otterly ai": 720, reachkit: 0 },
};

describe("rivals weighed by brand search volume", () => {
  it("puts the rivals buyers search for first, most searched first, and the rest after in the evidence's order", () => {
    const ordered = byDemand(CANDIDATES, DEMAND);
    expect(ordered.map((r) => r.name)).toEqual(["Profound", "Peec AI", "Otterly", "AEO Engine", "MaxAEO"]);
    expect(ordered.map((r) => r.volume)).toEqual([6600, 2400, 720, 70, 0]);
  });

  it("replaces a standing rival nobody searches with a searched one, and keeps a searched standing rival", () => {
    const stored: StoredMarketWithChange = {
      ...EMPTY_STORED_MARKET,
      lastChange: null,
      current: { buyer: "", job: "", category: "AI visibility", synonyms: [], differentiators: [], notOurMarket: [], categoryReason: "", rivals: [] },
    };
    const more = [
      ...CANDIDATES,
      rival("scrunchai.com", "Scrunch AI", "same_job"),
      rival("athenahq.ai", "AthenaHQ", "same_job"),
      rival("rankscale.ai", "Rankscale", "same_job"),
    ];
    const demand = { ...DEMAND, brands: { ...DEMAND.brands, "scrunch ai": 480, athenahq: 390, rankscale: 260 } };
    const settled = settleRivals({
      stored,
      standing: ["aeoengine.ai", "maxaeo.com", "otterly.ai"],
      fresh: byDemand(more, demand),
      scanId: "scan-2",
      at: AT,
    });
    expect(settled.rivals).toEqual(["tryprofound.com", "peec.ai", "otterly.ai", "scrunchai.com", "athenahq.ai"]);
    expect(settled.next.lastChange?.dropped).toEqual(["aeoengine.ai", "maxaeo.com"]);
  });

  it("buys only the names it does not hold, and every name again once the read is 30 days old", () => {
    const rivals = [...CANDIDATES, rival("scrunchai.com", "Scrunch AI", "same_job")];
    expect(keywordsOwed({ demand: DEMAND, rivals, own: ["reachkit"], at: AT })).toEqual(["otterly", "scrunch ai"]);
        expect(keywordsOwed({ demand: DEMAND, rivals: CANDIDATES, own: ["reachkit"], at: new Date("2026-11-10T00:00:00Z") })).toHaveLength(7);
  });

  it("reads a name the vendor holds nothing for as searched by no one", () => {
    const merged = mergeDemand({
      demand: undefined,
      bought: ["reachkit", "profound ai", "maxaeo"],
      volumes: [{ keyword: "profound ai", searchVolume: 6600 }],
      own: ["reachkit"],
      at: AT,
    });
    expect(merged).toEqual({ at: AT.toISOString(), own: 0, brands: { reachkit: 0, "profound ai": 6600, maxaeo: 0 } });
  });
});
