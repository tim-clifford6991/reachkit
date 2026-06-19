import { describe, it, expect } from "vitest";
import { bucketMarketplace } from "./marketplace";

describe("bucketMarketplace", () => {
  it("flags the marketplaces whose domains appear in the result URLs", () => {
    const rows = bucketMarketplace([
      "https://www.producthunt.com/products/nudgi",
      "https://www.g2.com/products/nudgi/reviews",
      "https://example.com/blog",
    ]);
    const present = rows.filter((r) => r.present);
    expect(present.map((r) => r.source).sort()).toEqual(["g2", "product_hunt"]);
    expect(rows.find((r) => r.source === "product_hunt")!.url).toContain("producthunt.com");
    // Marketplaces with no hit are present:false.
    expect(rows.find((r) => r.source === "appsumo")!.present).toBe(false);
  });

  it("returns all-absent for no URLs", () => {
    expect(bucketMarketplace([]).every((r) => !r.present)).toBe(true);
  });
});
