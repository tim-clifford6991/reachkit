// tests/ui/design/strategy.test.ts — owner 2026-10-15, #1463.
//
// The strategy half of a screen change. Layout and axe stay on the
// `no overflow · axe` gate. This file holds the two rules that are sentences
// in the copy registry: a title is at most six words with no em-dash, and a
// retired name does not come back. docs/DESIGN.md names this file. The
// trailing "· ReachKit" on a meta title is the brand, not a seventh word.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const KEYS = path.resolve(import.meta.dirname, "../../../src/lib/presentation/copy/keys");
const ENTRY_RE = /"([\w$.-]+)"\s*:\s*\[\s*"((?:[^"\\]|\\.)*)"/g;
const TITLE_KEY = /\.(title|heading|subject)$/;
const RETIRED = ["AI Visibility", "Measure again", "re-measure", "top ten", "top 20"];

function entries(): { key: string; sentence: string }[] {
  const out: { key: string; sentence: string }[] = [];
  for (const name of readdirSync(KEYS)) {
    if (!name.endsWith(".ts")) continue;
    const text = readFileSync(path.join(KEYS, name), "utf8");
    for (const match of text.matchAll(ENTRY_RE)) {
      out.push({ key: match[1], sentence: JSON.parse(`"${match[2]}"`) });
    }
  }
  return out;
}

function titleWords(sentence: string): { dash: boolean; words: string[] } {
  const core = sentence.replace(/\s*[·|]\s*ReachKit\s*$/u, "");
  return { dash: core.includes("\u2014"), words: core.split(/\s+/).filter(Boolean) };
}

describe("UI strategy: titles and retired names (#1463)", () => {
  const copy = entries();

  it("reads the copy registry", () => {
    expect(copy.length).toBeGreaterThan(100);
  });

  it("a title, heading or subject is at most six words and has no em-dash", () => {
    const titles = copy.filter((entry) => TITLE_KEY.test(entry.key));
    expect(titles.length).toBeGreaterThan(50);
    const offenders = titles.flatMap((entry) => {
      const { dash, words } = titleWords(entry.sentence);
      return dash || words.length > 6 ? [`${entry.key} (${words.length}${dash ? ", em-dash" : ""}): ${entry.sentence}`] : [];
    });
    expect(offenders).toEqual([]);
  });

  it("customer copy does not use a retired name", () => {
    const offenders = copy.flatMap((entry) => {
      const hit = RETIRED.find((name) => entry.sentence.toLowerCase().includes(name.toLowerCase()));
      return hit ? [`${entry.key} uses "${hit}": ${entry.sentence}`] : [];
    });
    expect(offenders).toEqual([]);
  });
});
