// #1185 (owner D28): a new market replaces the standing one only when seen
// twice or clearly better supported; rivals are re-checked every pass; a
// founder's override always stands.
import { describe, expect, it } from "vitest";
import { settleMarket, settleRivals, setupRivalsOverridden, type MarketFields, type StoredMarketWithChange } from "@/lib/market/infer/stability";
import { EMPTY_STORED_MARKET, type RivalConclusion } from "@/lib/market/infer/types";

const AT = new Date("2026-10-02T12:00:00Z");

function market(category: string, synonyms: string[] = []): MarketFields {
  return {
    buyer: "small businesses",
    job: "be named in AI answers",
    category,
    synonyms,
    differentiators: ["writes a page a day"],
    notOurMarket: ["SEO software"],
    categoryReason: `The site leads with ${category}.`,
  };
}

const EMPTY: StoredMarketWithChange = { ...EMPTY_STORED_MARKET, lastChange: null };
const VISIBILITY = market("AI search visibility", ["AI visibility software", "generative engine optimization"]);

function standing(m: MarketFields): StoredMarketWithChange {
  return { ...EMPTY, current: { ...m, rivals: [] }, adoptedAt: "2026-09-01T00:00:00Z" };
}

const settle = (stored: StoredMarketWithChange, fresh: MarketFields, siteText = "") =>
  settleMarket({ stored, standing: "SEO software", fresh, siteText, scanId: "scan-2", at: AT });

describe("the market", () => {
  it("adopts the first conclusion, and records the change from the category set at setup", () => {
    const { next, adopted } = settle(EMPTY, VISIBILITY);
    expect(adopted).toBe(true);
    expect(next.current?.category).toBe("AI search visibility");
    expect(next.lastChange?.category).toEqual({
      from: "SEO software",
      to: "AI search visibility",
      reason: "The site leads with AI search visibility.",
    });
  });

  it("keeps the standing market when a pass concludes it again under one of its other names", () => {
    const { next, adopted } = settle(standing(VISIBILITY), market("generative engine optimization"));
    expect(adopted).toBe(false);
    expect(next.current?.category).toBe("AI search visibility");
    expect(next.pending).toBeNull();
  });

  it("holds a different market as pending on one pass, and adopts it when the next pass concludes it again", () => {
    const content = market("AI content writing");
    const first = settle(standing(VISIBILITY), content);
    expect(first.adopted).toBe(false);
    expect(first.next.current?.category).toBe("AI search visibility");
    expect(first.next.pending?.category).toBe("AI content writing");

    const second = settle(first.next, content);
    expect(second.adopted).toBe(true);
    expect(second.next.current?.category).toBe("AI content writing");
    expect(second.next.pending).toBeNull();
  });

  it("adopts a different market at once when the site's own words clearly carry it and not the standing one", () => {
    const { adopted } = settle(standing(market("SEO software")), VISIBILITY, "See what AI tells buyers: AI search visibility, generative engine optimization");
    expect(adopted).toBe(true);
  });

  it("never replaces a category the founder set", () => {
    const stored = { ...standing(market("payroll software")), categoryOverridden: true };
    const { next, adopted } = settle(stored, VISIBILITY);
    expect(adopted).toBe(false);
    expect(next).toBe(stored);
  });
});

function rival(domain: string): RivalConclusion {
  return { domain, name: domain, basis: "ai_answer", reason: `${domain} sells AI visibility tracking.` };
}

describe("the rivals", () => {
  const stored = standing(VISIBILITY);
  const recheck = (s: StoredMarketWithChange, current: string[], fresh: RivalConclusion[]) =>
    settleRivals({ stored: s, standing: current, fresh, scanId: "scan-2", at: AT });

  it("replaces publishers with the concluded rivals and reports who came and went", () => {
    const { rivals, changed, next } = recheck(stored, ["zapier.com", "ahrefs.com"], [rival("tryprofound.com"), rival("peec.ai"), rival("otterly.ai")]);
    expect(changed).toBe(true);
    expect(rivals).toEqual(["tryprofound.com", "peec.ai", "otterly.ai"]);
    expect(next.lastChange?.added.map((r) => r.domain)).toEqual(["tryprofound.com", "peec.ai", "otterly.ai"]);
    expect(next.lastChange?.dropped).toEqual(["zapier.com", "ahrefs.com"]);
  });

  it("keeps a standing rival the pass concluded again, even below the first five", () => {
    const fresh = ["a.ai", "b.ai", "c.ai", "d.ai", "e.ai", "kept.ai"].map(rival);
    const { rivals, changed } = recheck(stored, ["kept.ai"], fresh);
    expect(rivals).toContain("kept.ai");
    expect(rivals).toHaveLength(5);
    expect(changed).toBe(true);
  });

  it("changes nothing when the pass concluded the same set", () => {
    const { changed, rivals } = recheck(stored, ["peec.ai", "otterly.ai"], [rival("otterly.ai"), rival("peec.ai")]);
    expect(changed).toBe(false);
    expect(new Set(rivals)).toEqual(new Set(["peec.ai", "otterly.ai"]));
  });

  it("keeps the rivals it has when a pass concluded none", () => {
    expect(recheck(stored, ["peec.ai"], [])).toMatchObject({ changed: false, rivals: ["peec.ai"] });
  });

  it("never replaces rivals the founder set", () => {
    const own = { ...stored, rivalsOverridden: true };
    expect(recheck(own, ["mine.com"], [rival("peec.ai")])).toMatchObject({ changed: false, rivals: ["mine.com"] });
  });
});

describe("D55 — keeping ReachKit's own rivals at setup is not the founder's choice", () => {
  const concluded = ["aeoengine.ai", "maxaeo.ai", "meltwater.com"];
  const shown = ["aeoengine.ai", "meltwater.com"];

  it("saving the rivals the step showed marks nothing, though they are two of the three concluded", () => {
    expect(setupRivalsOverridden({ marked: false, shown, concluded, answer: ["meltwater.com", "aeoengine.ai"] })).toBe(false);
  });

  it("adding or removing a rival is the founder's choice (D28)", () => {
    expect(setupRivalsOverridden({ marked: false, shown, concluded, answer: [...shown, "profound.com"] })).toBe(true);
    expect(setupRivalsOverridden({ marked: false, shown, concluded, answer: ["aeoengine.ai"] })).toBe(true);
  });

  it("a choice made on the rivals step survives the submit that saves the same set again", () => {
    const own = ["aeoengine.ai"];
    expect(setupRivalsOverridden({ marked: true, shown: own, concluded, answer: own })).toBe(true);
  });

  it("a set put back to the concluded one is ReachKit's again", () => {
    expect(setupRivalsOverridden({ marked: true, shown: ["aeoengine.ai"], concluded, answer: concluded })).toBe(false);
  });
});
