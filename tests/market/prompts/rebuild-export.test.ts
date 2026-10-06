// Issue 1281 (owner D54) — the dry run: reachkit.app's committed export,
// through the product's own rebuild. Nothing is bought and nothing is
// written. The stored set is the one its last pass asked.
//
// The export was taken before D49, and no pass has read the site's terms
// since (production, read 2026-10-06). So the dry run lays over it the
// terms issue 1270's proof read for this market, and the audience answer
// production holds today.
import "../../generate/env.ts";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseStoredMarket } from "../../../src/lib/market/infer/stored.ts";
import { searchedName, searchedTerms, spokenMarket } from "../../../src/lib/market/infer/terms.ts";
import { TRACKED_PROMPTS } from "../../../src/lib/config/constants.ts";
import { PROMPT_KINDS, generatePrompts } from "../../../src/lib/market/prompts/generate.ts";
import { nextPromptSet, parsePromptSet } from "../../../src/lib/market/prompts/set.ts";

const snapshot = JSON.parse(readFileSync("scripts/page/snapshot/reachkit.app.json", "utf8")) as {
  market: unknown;
  report: { prompts: { asked: unknown[]; siteName: string } };
};

const TERMS = searchedTerms(
  ["generative engine optimization", "answer engine optimization", "AI search visibility"].map((term) => ({ term, polluted: false })),
  [
    { keyword: "generative engine optimization", searchVolume: 4400 },
    { keyword: "answer engine optimization", searchVolume: 2400 },
    { keyword: "ai search visibility", searchVolume: 390 },
  ]
);
const BUYERS = "Founders and Business Owners";

describe("D54 on reachkit.app's export", () => {
  it("rebuilds 25 prompts that name the search term and the founder's audience, and none the old label", () => {
    const concluded = parseStoredMarket(snapshot.market).current;
    if (concluded === null) throw new Error("the export holds no market");
    const market = { ...concluded, ...TERMS, termsAt: "2026-10-06T00:00:00.000Z" };
    const stored = parsePromptSet({ prompts: snapshot.report.prompts.asked });
    const term = searchedName(market);
    const generated = generatePrompts(spokenMarket(market, BUYERS), snapshot.report.prompts.siteName);
    const set = nextPromptSet(stored, generated, new Date("2026-10-12T04:00:00Z"), term);

    expect(stored.prompts).toHaveLength(25);
    expect(term).toBe("generative engine optimization");
    expect(set.rebuiltAt).toBeDefined();
    expect(set.prompts).toHaveLength(25);
    expect(Object.fromEntries(PROMPT_KINDS.map((kind) => [kind, set.prompts.filter((p) => p.kind === kind).length]))).toEqual(TRACKED_PROMPTS.SPLIT);
    const all = set.prompts.map((p) => p.text).join("\n");
    expect(all).toContain("generative engine optimization");
    expect(all).toContain("founders and business owners");
    expect(all).not.toContain("AI discovery monitoring and content");
  });
});
