// SPEC §2 (issue 1387) — what a site's listing in search must hold before a
// market is read from it. The whole pass over real listings is
// `blocked-site-market.test.ts`; this is the floor alone.
import { describe, expect, it } from "vitest";
import { searchFootprintOf } from "@/lib/scan/search-footprint";
import type { RankedRow } from "@/lib/vendors/dataforseo/types";

const row = (keyword: string, url = "https://acme.com/", title?: string): RankedRow => ({
  keyword,
  position: 1,
  searchVolume: 100,
  url,
  ...(title === undefined ? {} : { title, description: `${title}, described.` }),
});

const BRAND_ONLY = ["acme", "acme.com", "acme com", "www acme", "acme 365", "acme 50", "acme uk", "acme co", "acme 2", "acme 24", "acme hq", "acme"];
const DESCRIPTIVE = ["acme payroll software", "payroll software", "payroll for small business", "online payslips", "acme hr software"];

describe("searchFootprintOf", () => {
  it("reads nothing from a handful of searches", () => {
    expect(searchFootprintOf({ domain: "acme.com", rows: DESCRIPTIVE.map((k) => row(k)) })).toMatchObject({ kind: "thin", because: "few_ranked_searches" });
  });

  it("reads nothing from searches that only name the brand, however many", () => {
    const rows = [...BRAND_ONLY, "acme payroll software", "acme login"].map((k) => row(k));
    expect(searchFootprintOf({ domain: "acme.com", rows })).toMatchObject({ kind: "thin", because: "brand_only", descriptive: 2 });
  });

  it("takes a brand written as two words for the brand", () => {
    const rows = ["home depot", "homedepot", "home depot 24", "home depot com", "home depot 2", "home depot ca", "home depot 365", "home depot uk", "home depot near me", "home depot hours"].map(
      (k) => row(k, "https://homedepot.com/")
    );
    expect(searchFootprintOf({ domain: "homedepot.com", rows })).toMatchObject({ kind: "thin", because: "brand_only", descriptive: 2 });
  });

  it("lists each page once, as Google shows it, and every search", () => {
    const rows = [
      ...BRAND_ONLY.slice(0, 6).map((k) => row(k, "https://acme.com/", "Acme: payroll software")),
      ...DESCRIPTIVE.map((k) => row(k, "https://acme.com/payroll", "Payroll software for small business")),
    ];
    const footprint = searchFootprintOf({ domain: "acme.com", rows });
    if (footprint.kind !== "read") throw new Error("the listing was not read");
    expect(footprint).toMatchObject({ searches: 11, descriptive: 5, pages: 2 });
    expect(footprint.text.match(/Acme: payroll software — /g)).toHaveLength(1);
    expect(footprint.text).toContain("(acme.com/payroll)");
    for (const keyword of DESCRIPTIVE) expect(footprint.text).toContain(`- ${keyword}`);
  });
});
