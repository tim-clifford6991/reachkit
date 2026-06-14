import { describe, it, expect } from "vitest";
import { buildCompetitorNamesPrompt, parseCompetitorNames } from "./competitor-names";

describe("competitor-names", () => {
  it("prompt anchors to the subject category and forbids off-category / same-name products", () => {
    const p = buildCompetitorNamesPrompt({
      subjectName: "Acquire",
      subjectHost: "acquire.com",
      category: "marketplace to buy and sell online businesses",
      content: "Top alternatives: Flippa, Empire Flippers, MicroAcquire. Also Acquire.io live chat.",
    });
    expect(p).toContain("acquire.com");
    expect(p).toContain("marketplace to buy and sell online businesses");
    expect(p.toLowerCase()).toContain("same category");
    expect(p.toLowerCase()).toContain("different product that merely shares");
  });

  it("parses names, drops empties, dedupes case-insensitively, caps at 8", () => {
    const json = JSON.stringify({ competitors: [
      { name: "Flippa" }, { name: "flippa" }, { name: "Empire Flippers" }, { name: "" },
    ] });
    const out = parseCompetitorNames(json);
    expect(out.map((c) => c.name)).toEqual(["Flippa", "Empire Flippers"]);
    const first = out[0];
    expect(first?.source).toBe("llm_extracted");
    expect(first?.url).toBe("");
  });

  it("returns [] on unparseable model output (never throws)", () => {
    expect(parseCompetitorNames("the competitors are Flippa and ...")).toEqual([]);
  });
});
