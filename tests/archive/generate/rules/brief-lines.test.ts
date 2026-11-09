// Issue 2378 condition 2: each hard rule's writer line is built from what its check reads, and holds no number the
// constants already hold.
import "../env";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CITES_MARKET, DISTINCT_HEADINGS, PAGE_BLOCKS, PROSE, TITLE, VOICE } from "@/lib/config/constants";
import { UNSUPPORTED_CLAIM } from "@/lib/generate/claims/fit";
import type { ContextPack } from "@/lib/generate/pipeline/pack";
import { titleRuleFor } from "@/lib/generate/pipeline/title";
import { briefLinesOf, citesMinOf } from "@/lib/generate/rules/brief-lines";
import { isPlaceholderCell } from "@/lib/generate/rules/cells";
import { REGISTER_FLOOR } from "@/lib/generate/rules/figures";
import { HARD_RULES, type HardRule } from "@/lib/generate/rules/types";
import { TEMPLATES } from "@/lib/generate/templates";

const stored = JSON.parse(readFileSync("docs/walk/prose-gate/wesbos.com.pack.json", "utf8")) as ContextPack;
const pack = { ...stored, neverClaim: ["the fastest course on the web"] };
const inputs = { pack, template: TEMPLATES[pack.type], pageType: null, demoPhrases: ["Demo data for an example shop"], titleRule: titleRuleFor(pack, { description: "" }) };
const line = (rule: HardRule): string => briefLinesOf(rule, inputs).join("\n");

describe("each rule's line holds what its check reads", () => {
  it("gives every rule a line, stating the numbers, lists and phrases its check uses", () => {
    for (const rule of HARD_RULES) expect(line(rule), rule).not.toBe("");
    expect(line("traceable_numerals")).toContain(String(REGISTER_FLOOR));
    expect(line("first_block_answers")).toContain(`${PAGE_BLOCKS.answerWords.min} to ${PAGE_BLOCKS.answerWords.max} words`);
    expect(line("required_blocks")).toContain(`${PAGE_BLOCKS.takeaways.min} to ${PAGE_BLOCKS.takeaways.max} key takeaways`);
    expect(line("distinct_headings")).toContain(`${DISTINCT_HEADINGS.overlap * 100}% of another's words or opens with the same ${DISTINCT_HEADINGS.opening} words`);
    expect(line("title")).toContain(`${TITLE.chars.min} to ${TITLE.chars.max} characters`);
    expect(line("plain_prose")).toContain(`run of ${PROSE.repeatedSentence.minWords} words`);
    expect(line("plain_prose")).toContain(`${PAGE_BLOCKS.taglineRepeats} times`);
    expect(line("cites_market")).toContain(`at least ${citesMinOf(TEMPLATES.how_to)} different pages`);
    expect(citesMinOf(TEMPLATES.how_to)).toBe(CITES_MARKET.min);
    expect(line("fit_claim")).toContain(UNSUPPORTED_CLAIM);
    expect(line("do_not_claim")).toContain('"the fastest course on the web"');
    expect(line("no_demo_text")).toContain('"Demo data for an example shop"');
    expect(briefLinesOf("no_demo_text", { ...inputs, demoPhrases: [] })).toEqual([]);
  });

  it("names as a placeholder cell only words the cell check stops", () => {
    const named = [...line("no_placeholder_cell").matchAll(/"([^"]+)"/g)].map((match) => match[1]!);
    expect(named.length > 0 && named.every(isPlaceholderCell)).toBe(true);
  });

  it("holds no number literal that the constants it reads also hold", () => {
    const leaves = (value: unknown): number[] => (typeof value === "number" ? [value] : typeof value === "object" && value !== null ? Object.values(value).flatMap(leaves) : []);
    const pinned = new Set(leaves([DISTINCT_HEADINGS, PAGE_BLOCKS, PROSE, TITLE, VOICE, CITES_MARKET, REGISTER_FLOOR]));
    const code = readFileSync("src/lib/generate/rules/brief-lines.ts", "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    const literals = [...code.matchAll(/(?<![\w.$])\d+(?:\.\d+)?(?![\w])/g)].map((match) => Number(match[0]));
    expect(literals.filter((each) => pinned.has(each))).toEqual([]);
  });
});
