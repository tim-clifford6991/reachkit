// The match rule: 80% of a string's word 3-grams, or the exact words for a shorter string.
import { describe, expect, it } from "vitest";
import { compare, matches, segments, shipIndex } from "../../../scripts/design/parity.mjs";

const ship = (...texts: string[]) => shipIndex(texts);

describe("a board string against the ship text", () => {
  it("misses a reworded sentence", () => {
    expect(
      matches("Up to 7 pages a week, new or updated. Never filler.", ship("Each week we publish a handful of new or updated pages.")),
    ).toBe(false);
  });

  it("matches across a punctuation-only difference, curly quotes and dashes", () => {
    const index = ship("Your market, and your pages: checked every Monday. What's next");
    expect(matches("Your market — and your pages — checked every Monday", index)).toBe(true);
    expect(matches("What’s next", index)).toBe(true);
  });

  it("reads a reserved .example domain as .com", () => {
    expect(matches("harborplumbing.com/emergency", ship("Seen on harborplumbing.example/emergency"))).toBe(true);
  });

  it("needs a short string's exact words", () => {
    expect(matches("Free scans", ship("Free scans"))).toBe(true);
    expect(matches("Plan", ship("Planning ahead"))).toBe(false);
  });

  it("holds the line at 80% of the 3-grams", () => {
    const index = ship("one two three four five six seven eight nine ten eleven");
    expect(matches("one two three four five six seven eight nine ten twelve", index)).toBe(true); // 8 of 9
    expect(matches("one two three four five six", ship("one two three four five seven"))).toBe(false); // 3 of 4
  });

  it("counts a string inside a closed details as shipped", () => {
    const page = segments(
      "<main><details><summary>Can I stop a page?</summary><p>Yes. Every page waits 24 hours before it goes live, and one click stops it.</p></details></main>",
    );
    const board = "<main><p>Yes. Every page waits 24 hours before it goes live, and one click stops it.</p></main>";
    expect(compare(board, page).matched).toHaveLength(1);
  });

  it("excuses an allowed string only when the page lacks it", () => {
    const board = "<main><p>Harbor Plumbing</p><p>Pricing</p></main>";
    const result = compare(board, ["Pricing"], [{ string: "Harbor Plumbing" }, { string: "Pricing" }]);
    expect(result).toEqual({
      matched: ["Pricing"],
      allowed: ["Harbor Plumbing"],
      missing: [],
      unused: [{ string: "Pricing", n: undefined, ships: true }],
    });
  });
});
