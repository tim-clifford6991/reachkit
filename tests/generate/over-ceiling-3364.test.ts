// A page over its ceiling is warned of, never marked short of words; one under its floor still is.
import "./env";
import { expect, it } from "vitest";
import { checkRequiredBlocks } from "../../src/lib/generate/rules/blocks";
import { partsOf } from "../../src/lib/generate/standard";
import { TEMPLATES } from "../../src/lib/generate/templates";

const at = (words: number) => checkRequiredBlocks({ markdown: `# H1\n\n${"word ".repeat(words)}`, title: "T", blocks: { template: TEMPLATES.listicle, sections: [], length: { floor: 10, target: 15, ceiling: 20 }, faq: [], domain: "shop.example" } })!;

it("marks a page over its ceiling not short of words and keeps one under its floor short", () => {
  expect([partsOf(at(40)).includes("words"), partsOf(at(3)).includes("words")]).toEqual([false, true]);
});
