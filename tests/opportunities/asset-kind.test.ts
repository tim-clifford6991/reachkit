// tests/opportunities/asset-kind.test.ts — §7's three asset kinds, and which
// of them a day publishes for the opportunity it was picked for.
//
// Read off `FAMILY_OF` rather than against a list typed out here: a second
// list would pass while disagreeing with the surface it describes.
import { describe, expect, it } from "vitest";
import { ASSET_KIND_OF, FAMILY_OF, OPPORTUNITY_TYPES, assetKindOf } from "@/lib/opportunities/types";

describe("the day's asset kind", () => {
  it("answers for every type the opportunity surface has", () => {
    expect(Object.keys(ASSET_KIND_OF).sort()).toEqual([...OPPORTUNITY_TYPES].sort());
  });

  it("is an update for every Improve target — the page it already names", () => {
    const improve = OPPORTUNITY_TYPES.filter((type) => FAMILY_OF[type] === "improve");
    expect(improve.length).toBeGreaterThan(0);
    improve.forEach((type) => expect(assetKindOf(type)).toBe("update"));
  });

  it("is a new page for every Write target", () => {
    const write = OPPORTUNITY_TYPES.filter((type) => FAMILY_OF[type] === "write");
    expect(write.length).toBeGreaterThan(0);
    write.forEach((type) => expect(assetKindOf(type)).toBe("page"));
  });

  it("is no asset at all for an unblock, which changes a page's headers", () => {
    expect(assetKindOf("unblock")).toBeNull();
  });

  it("is an update for a page fix — that page's own metadata (SPEC §9, #690)", () => {
    expect(assetKindOf("fix_page")).toBe("update");
  });

  it("is a new page for Earn — a citable asset on the customer's domain", () => {
    const earn = OPPORTUNITY_TYPES.filter((type) => FAMILY_OF[type] === "earn");
    expect(earn).toEqual(["listed_page"]);
    earn.forEach((type) => expect(assetKindOf(type)).toBe("page"));
  });
});
