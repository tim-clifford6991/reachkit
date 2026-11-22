// Issue 1285 — the dry run: reachkit.app as production stored it after the
// re-measure of 2026-10-06 (scan 17f5bbff), through the product's own
// functions. Nothing is bought and nothing is written.
import "../../generate/env.ts";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { brandKeywords, byDemand } from "../../../src/lib/market/infer/demand.ts";
import { parseStoredMarket } from "../../../src/lib/market/infer/stored.ts";
import { searchedName, spokenMarket } from "../../../src/lib/market/infer/terms.ts";
import { generatePrompts } from "../../../src/lib/market/prompts/generate.ts";
import { followRivals, nextPromptSet, parsePromptSet } from "../../../src/lib/market/prompts/set.ts";
import { comparisonWithoutDemand } from "../../../src/lib/opportunities/derive/topics.ts";

const stored = JSON.parse(readFileSync("tests/market/fixtures/reachkit-scan-17f5bbff.json", "utf8")) as {
  siteName: string;
  founderBuyers: string;
  market: unknown;
  trackedPrompts: unknown;
  rows: { staleComparison: string };
};
const concluded = parseStoredMarket(stored.market).current!;
const DROPPED = /AEO Engine|MaxAEO|Meltwater/;
const JOB = "understand where AI and search send buyers";

describe("reachkit.app after scan 17f5bbff", () => {
  const rivals = byDemand(concluded.rivals, concluded.demand!);
  const market = { ...concluded, rivals };
  const generated = generatePrompts(spokenMarket(market, stored.founderBuyers), stored.siteName);
  const asked = parsePromptSet(stored.trackedPrompts);

  it("no polluted brand leads the rivals: Brandi is read as \"brandi ai\", and the owner's four come first", () => {
    expect(concluded.rivals[0]).toMatchObject({ name: "Brandi", volume: 22200 });
    expect(brandKeywords(concluded.rivals[0]!)).toEqual(["brandi ai"]);
    expect(rivals.map((r) => `${r.name} ${r.volume}`)).toEqual([
      "Profound 6600",
      "Otterly 880",
      "Omniscient 590",
      "Rankscale 480",
      "Brandi 260",
    ]);
  });

  it("the prompts that name rivals follow the concluded rivals, outside the rotation allowance", () => {
    expect(asked.prompts.filter((p) => DROPPED.test(p.text))).toHaveLength(5);
    const at = new Date("2026-10-06T11:25:22Z");
    const set = followRivals(asked, generated, at);
    const named = set.prompts.filter((p) => p.kind === "comparison" || p.kind === "branded").map((p) => p.text);
    expect(named).toEqual([
      "How does Profound compare with Otterly for generative engine optimization?",
      "What are the best alternatives to Profound for founders and business owners?",
      "Otterly or Omniscient: which is the better choice for generative engine optimization?",
      "Which is better value for generative engine optimization: Profound, Otterly or Omniscient?",
      "What is ReachKit, and is it any good for generative engine optimization?",
      "Is ReachKit a good alternative to Profound for generative engine optimization?",
    ]);
    expect(set.prompts).toHaveLength(25);
    expect(set.rotations).toEqual([]);
    expect(set.rebuiltAt).toBe(asked.rebuiltAt);
    expect(set.prompts.some((p) => p.precheck === true)).toBe(false);
    // The branded prompt that names no rival is the one already tracked.
    expect(set.prompts.find((p) => p.id === "8c891360")?.addedAt).toBe("2026-10-06T11:21:50.646Z");
    expect(followRivals(set, generated, new Date("2026-10-12T04:00:00Z"))).toBe(set);
  });

  it("the rebuild, run once more, names the concluded rivals and never quotes the job", () => {
    // What the one statement of the pull request leaves stored: the set as
    // it was before its rebuild was recorded.
    const undone = parsePromptSet({ ...(stored.trackedPrompts as object), rebuiltAt: undefined, builtFrom: concluded.category });
    const at = new Date("2026-10-07T04:00:00Z");
    const set = nextPromptSet(undone, generated, at, searchedName(market));
    expect(set.rebuiltAt).toBe(at.toISOString());
    expect(set.prompts).toHaveLength(25);
    const all = set.prompts.map((p) => p.text).join("\n");
    expect(all).not.toMatch(DROPPED);
    expect(all.toLowerCase()).not.toContain(JOB);
    expect(all).not.toContain("AI discovery monitoring and content");
    expect(set.prompts.filter((p) => p.kind === "use-case").map((p) => p.text)).toEqual([
      "Which generative engine optimization tools work on a small budget?",
      "Which answer engine optimization tools can I use without hiring an agency?",
      "Which AI search visibility tools suit a team of one?",
      "Which AEO tools can I set up in a single day?",
      "Which generative engine optimization tools need no engineering team?",
      "Which answer engine optimization tools work for a brand new website?",
      "Which AI search visibility tools have a free trial?",
    ]);
    expect(set.prompts.filter((p) => p.kind === "problem").map((p) => p.text)).toEqual([
      "I am getting nowhere with generative engine optimization. Which tools can fix that?",
      "Nothing I have tried for generative engine optimization is working. What software should I try next?",
      "What is the fastest way to get results from generative engine optimization, and which products do it for me?",
    ]);
  });

  it("a comparison row for a product the pass read and did not keep is one nobody searches", () => {
    const own = ["reachkit"];
    expect(comparisonWithoutDemand(stored.rows.staleComparison, { market, own })).toBe(true);
    expect(comparisonWithoutDemand("profound alternatives", { market, own })).toBe(false);
    expect(comparisonWithoutDemand("geo vs seo", { market, own })).toBe(false);
  });
});
