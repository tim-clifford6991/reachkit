// The writer is told the title rules stage 4 holds, and offered only specifics, and titles, that pass them: on
// ecf4f99d's own pack, whose three written titles each stopped the page.
import "../env";
import { describe, expect, it } from "vitest";
import type { ContextPack } from "@/lib/generate/pipeline/pack";
import { promiseFigures, titleBrief, titleRuleFor } from "@/lib/generate/pipeline/title";
import { pickTitle } from "@/lib/generate/rules/title";
import STORED from "../fixtures/q4-ecf4f99d-2026-11.json";

const pack = STORED.meta.pack as unknown as ContextPack;
const brief = titleBrief(pack) as { figures: string[]; titles: string[]; rules: string[] };
const faultsOf = (title: string) => pickTitle([title], titleRuleFor(pack, { description: "" })).candidates[0]!.faults;

describe("ecf4f99d's title brief", () => {
  it("withholds the business's own promise figure, and hands over titles that pass, the floor last", () => {
    expect(brief.figures).not.toContain("Starting from 1,000 search prompts");
    expect(promiseFigures("Is SEO dead now with AI: Starting from 1,000 search prompts", pack)).not.toEqual([]);
    expect(brief.titles.at(-1)).toBe("Generative engine optimization examples");
    // The floor lacks its specific, which never stops a page on its own; the rest pass whole.
    expect(brief.titles.map(faultsOf)).toEqual([[], [], [], ["specific"]]);
  });

  it("states whose figure a title may carry, and no longer offers an engine's name the title check can fail", () => {
    const told = brief.rules.join("\n");
    expect(told).toContain("A figure beside a product's name is one that product's own pages state");
    expect(told).not.toMatch(/engine/i);
  });
});
