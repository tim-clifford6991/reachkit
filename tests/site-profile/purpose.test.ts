// tests/site-profile/purpose.test.ts — issue #577
//
// What a customer sees of this module: every page in their inventory
// carries one of SPEC.md §2's eight purposes, the one their own address
// says, and the chips on the setup card count pages that really are what
// the chip claims.
import { describe, expect, it } from "vitest";
import { derivePurpose } from "@/lib/site-profile/purpose";
import { PAGE_PURPOSES, type PagePurpose } from "@/lib/site-profile/types";

const purposeOf = (url: string, title = "", h1 = ""): PagePurpose =>
  derivePurpose({ url, title, h1 });

describe("derivePurpose", () => {
  it("reads the purpose off the page's own address", () => {
    expect(purposeOf("https://example.com/pricing")).toBe("pricing");
    expect(purposeOf("https://example.com/plans/")).toBe("pricing");
    expect(purposeOf("https://example.com/about-us")).toBe("about");
    expect(purposeOf("https://example.com/features/reporting")).toBe("features");
    expect(purposeOf("https://example.com/products/terminal")).toBe("product");
    expect(purposeOf("https://example.com/blog/how-we-price")).toBe("blog");
    expect(purposeOf("https://example.com/contact")).toBe("contact");
    expect(purposeOf("https://example.com/legal/privacy.html")).toBe("legal");
  });

  it("lets the address outrank a marketing heading", () => {
    // A features page whose h1 opens "Pricing that scales" is a features
    // page: cross-linking that filed it as `pricing` would link a draft's
    // "see our pricing" at the wrong page.
    expect(purposeOf("https://example.com/features", "Pricing that scales", "Pricing that scales")).toBe(
      "features"
    );
    // A post about pricing is a post.
    expect(purposeOf("https://example.com/blog/pricing-explained")).toBe("blog");
  });

  it("falls back to the headings only where the address says nothing", () => {
    expect(purposeOf("https://example.com/p/9f2a", "Contact us", "")).toBe("contact");
    expect(purposeOf("https://example.com/x1", "", "Privacy Policy")).toBe("legal");
    expect(purposeOf("https://example.com/node/12", "About us — Example", "")).toBe("about");
  });

  it("matches a heading on word boundaries, never inside a longer word", () => {
    expect(purposeOf("https://example.com/n/1", "The roundabout way", "")).toBe("other");
    expect(purposeOf("https://example.com/n/2", "Planet mapping", "")).toBe("other");
  });

  it("calls the home page `other` rather than inventing a purpose for it", () => {
    expect(purposeOf("https://example.com/")).toBe("other");
    expect(purposeOf("https://example.com")).toBe("other");
  });

  it("is total: any input returns one of the eight purposes and never throws", () => {
    const inputs = ["", "not a url", "ftp://example.com/x", "https://example.com/%%%", "/relative"];
    for (const url of inputs) {
      const purpose = derivePurpose({ url, title: "", h1: "" });
      expect(PAGE_PURPOSES).toContain(purpose);
    }
  });
});
