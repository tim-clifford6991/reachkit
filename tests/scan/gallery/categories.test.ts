// SPEC §2 2026-10-10 (owner, issue 1377) — the gallery's toolbar holds a
// bounded set of category chips whatever the number of categories, every
// other category stays reachable, and a stored placeholder is never one.
import "../../generate/env";
import { describe, expect, it } from "vitest";
import { CHIPS_MAX, listedCategory, splitCategories } from "@/lib/scan/gallery";

/** Fifty categories as production had them on 2026-10-10: a few with
 *  several scans, most with one. Most first, as `readGallery` hands them. */
const MANY = [
  ...Array.from({ length: 12 }, (_, i) => ({ name: `Shared ${String(i).padStart(2, "0")}`, count: 14 - i })),
  ...Array.from({ length: 38 }, (_, i) => ({ name: `Single ${String(i).padStart(2, "0")}`, count: 1 })),
];

describe("the gallery's categories", () => {
  it("never lists a stored placeholder, as a card's category or as the category a link asks for", () => {
    expect(listedCategory("<UNKNOWN>")).toBeNull();
    expect(listedCategory(" n/a ")).toBeNull();
    expect(listedCategory(null)).toBeNull();
    expect(listedCategory(undefined)).toBeNull();
    expect(listedCategory(" Payroll software ")).toBe("Payroll software");
  });

  it("shows at most eight chips, the categories with the most scans, and keeps every other one under More", () => {
    const { chips, more } = splitCategories(MANY, null);
    expect(CHIPS_MAX).toBe(8);
    expect(chips).toEqual(MANY.slice(0, 8));
    expect([...chips, ...more].map((c) => c.name).sort()).toEqual(MANY.map((c) => c.name).sort());
  });

  it("makes no chip of a category with one scan", () => {
    const { chips, more } = splitCategories([{ name: "Software", count: 3 }, { name: "Retail", count: 1 }], null);
    expect(chips).toEqual([{ name: "Software", count: 3 }]);
    expect(more).toEqual([{ name: "Retail", count: 1 }]);
  });

  it("shows the category being filtered as the first chip, wherever it stood, and not under More as well", () => {
    const { chips, more } = splitCategories(MANY, "Single 20");
    expect(chips).toHaveLength(CHIPS_MAX + 1);
    expect(chips[0]).toEqual({ name: "Single 20", count: 1 });
    expect(more.some((c) => c.name === "Single 20")).toBe(false);
    // One that was a chip already moves to the front and is not drawn twice.
    expect(splitCategories(MANY, "Shared 05").chips.map((c) => c.name)).toEqual([
      "Shared 05",
      ...MANY.slice(0, 8).map((c) => c.name).filter((name) => name !== "Shared 05"),
    ]);
    // A search that leaves the filtered category no scan still shows it.
    expect(splitCategories([], "Payroll software").chips).toEqual([{ name: "Payroll software", count: 0 }]);
  });
});
