// The check count a customer reads is a slot the rules registry fills
// (owner E10), so no copy value types the number itself.
//
// The rendered figures are held where they render: How it works
// (`tests/app/how/how-it-works.test.tsx`), the landing's day card
// (`tests/app/scan-address/landing-s1.test.tsx`) and Draft
// (`tests/app/draft/view.test.tsx`), each against `HARD_RULES.length`.
import { describe, expect, it } from "vitest";
import { COPY } from "@/lib/presentation/copy";
import { PAGE_COPY_DE } from "@/lib/presentation/copy/keys/de/page";

/** A number typed beside the thing it counts, in either language a page is written in. */
const TYPED_COUNT = /\b\d+\s+(?:checks?|rules?|Regeln|Prüfungen)\b/i;

function typedCounts(entries: Record<string, string>): string[] {
  return Object.entries(entries).flatMap(([key, value]) => (TYPED_COUNT.test(value) ? [`${key}: ${value}`] : []));
}

describe("one true check count, taken from code (owner E10)", () => {
  it("the pattern finds a typed count and passes a slot", () => {
    expect(typedCounts({ a: "Up to 22 checks before any page goes live", b: "anhand von 14 Regeln geprüft" })).toHaveLength(2);
    expect(typedCounts({ c: "Up to {checks} checks before any page goes live" })).toEqual([]);
  });

  it("no copy value types a count of checks or rules", () => {
    expect(typedCounts(COPY)).toEqual([]);
    expect(typedCounts(PAGE_COPY_DE)).toEqual([]);
  });
});
