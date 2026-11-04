// The writer is told the title rules stage 4 holds, and offered only specifics, and titles, that pass them.
import "../env";
import { describe, expect, it } from "vitest";
import { floorTitle, titleBrief, titleRuleFor } from "@/lib/generate/pipeline/title";
import { pickTitle } from "@/lib/generate/rules/title";
import { OUTSIDE_CLAIMS, pack } from "../fixtures";

const search = "ai engine optimization examples";
const claim = (product: string, passage: string) => ({ ...OUTSIDE_CLAIMS[0]!, url: `https://${product}/pricing`, product, passage });
// ecf4f99d's shape: rivals' claims, one figure beside the wrong rival's name and one that says the search's word again.
const listicle = pack({
  type: "listicle",
  target: { question: search, searches: [search] },
  business: { ...pack().business, rivals: ["otterly.ai", "tryprofound.com"], market: { rivals: [{ name: "Otterly", domain: "otterly.ai" }, { name: "Profound", domain: "tryprofound.com" }] } },
  claims: [claim("otterly.ai", "Otterly starts at $29 a month."), claim("otterly.ai", "Our review puts Profound at $499 a month."), claim("tryprofound.com", "Profound compares 4 AI engines.")],
});
const brief = titleBrief(listicle) as { figures: string[]; names: string[]; titles: string[]; rules: string[] };
const rule = titleRuleFor(listicle, { description: "" });
const faultsOf = (title: string) => pickTitle([title], rule).candidates[0]!.faults;

describe("the title brief", () => {
  it("offers a figure only where the search with it passes the title check: not a rival's figure beside another, nor the search's word again", () => {
    expect(brief.figures).toEqual(["starts at $29 a month"]);
    expect([faultsOf(`Ai engine optimization examples: Profound at $499 a month`), faultsOf(`Ai engine optimization examples: Profound compares 4 AI engines`)]).toEqual([["figure_owner"], ["banned"]]);
  });

  it("hands the writer titles that each pass every wording rule, the floor among them", () => {
    expect(brief.titles).toEqual(["Ai engine optimization examples: starts at $29 a month", "Ai engine optimization examples: Otterly", "Ai engine optimization examples: Profound", "Ai engine optimization examples (2026)"]);
    expect(brief.titles.at(-1)).toBe(floorTitle(listicle));
    // The floor lacks its specific, which never stops a page on its own; the rest pass whole.
    expect(brief.titles.map(faultsOf)).toEqual([[], [], [], ["specific"]]);
  });

  it("states whose figure a title may carry, and no longer offers an engine's name the title check can fail", () => {
    const told = brief.rules.join("\n");
    expect(told).toContain("A figure beside a product's name is one that product's own pages state");
    expect(told).not.toMatch(/engine/i);
  });
});
