// A weekly pass run twice rebuilds a template set as the panel once: the second run keeps the first's set and its restart mark.
import { describe, expect, it } from "vitest";
import { panelOf } from "../../../src/lib/market/prompts/generate.ts";
import { nextPromptSet, promptId } from "../../../src/lib/market/prompts/set.ts";

const templates = { prompts: [{ id: promptId("best plumber in austin"), kind: "category" as const, text: "best plumber in austin", addedAt: "2026-10-05T04:00:00.000Z" }], rotations: [] };
const panel = panelOf({
  searches: ["emergency plumber austin", "Plumber Austin", "water heater repair", "drain cleaning cost", "rooter pros plumbing"],
  questions: ["How much does an emergency plumber cost?"],
  siteName: "Harbor Plumbing",
  rivals: [{ name: "Rooter Pros", domain: "rooterpros.com" }],
  language: "en",
});

describe("the panel rebuild, run twice", () => {
  it("the first run rebuilds under the restart mark; the second asks the same set and keeps the mark", () => {
    expect(panel.map((item) => item.text)).toEqual(["emergency plumber austin", "plumber austin", "water heater repair", "drain cleaning cost"]);
    expect(panel[0]?.question).toBe("How much does an emergency plumber cost?");
    const first = nextPromptSet(templates, panel, new Date("2026-11-23T04:00:00Z"));
    expect(first.rebuiltAt).toBe("2026-11-23T04:00:00.000Z");
    expect(nextPromptSet(first, panel, new Date("2026-11-23T04:30:00Z"))).toBe(first);
  });
});
