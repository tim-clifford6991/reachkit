// SPEC §2 2026-10-10 (issue 1377) — the gallery holds a bounded set of chips
// whatever the number of categories, every other category stays reachable,
// and a stored placeholder is never one.
import "../../generate/env";
import { describe, expect, it } from "vitest";
import { CHIPS_MAX, listedCategory, splitCategories } from "@/lib/scan/gallery";

/** Fifty categories, most first, as production had them: few shared, most single. */
const MANY = Array.from({ length: 50 }, (_, i) => ({ name: `Category ${String(i).padStart(2, "0")}`, count: i < 12 ? 14 - i : 1 }));
const names = (list: readonly { name: string }[]) => list.map((c) => c.name);

describe("the gallery's categories", () => {
  it("never lists a stored placeholder, on a card or as the category a link asks for", () => {
    expect(["<UNKNOWN>", " n/a ", null, undefined, " Payroll software "].map(listedCategory)).toEqual([null, null, null, null, "Payroll software"]);
  });

  it("shows the eight categories with the most scans, none with one scan, and keeps every other under More", () => {
    const { chips, more } = splitCategories(MANY, null);
    expect(chips).toEqual(MANY.slice(0, CHIPS_MAX));
    expect(names([...chips, ...more]).sort()).toEqual(names(MANY));
    expect(splitCategories(MANY.slice(10), null).chips).toEqual(MANY.slice(10, 12));
  });

  it("shows the category being filtered as the first chip, once, even where the search leaves it no scan", () => {
    const single = splitCategories(MANY, "Category 30");
    expect(names(single.chips)).toEqual(["Category 30", ...names(MANY.slice(0, CHIPS_MAX))]);
    expect(names(single.more)).not.toContain("Category 30");
    expect(names(splitCategories(MANY, "Category 05").chips)).toEqual(["Category 05", ...names(MANY.slice(0, CHIPS_MAX)).filter((n) => n !== "Category 05")]);
    expect(splitCategories([], "Payroll software").chips).toEqual([{ name: "Payroll software", count: 0 }]);
  });
});
