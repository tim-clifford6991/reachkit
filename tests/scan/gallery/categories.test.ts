// SPEC §2 2026-10-10 (issue 1377) — a stored placeholder is never a category,
// and a card names the site by its brand.
import "../../generate/env";
import { describe, expect, it } from "vitest";
import { listedCategory, shownCompany } from "@/lib/scan/gallery";

describe("the gallery's company names (issue 1379)", () => {
  it("lists a site a challenge page named after its protection under its own brand", () => {
    expect(shownCompany({ company: "Cloudflare", domain: "sage.com" })).toBe("Sage");
    expect(shownCompany({ company: "Cloudflare", domain: "cloudflare.com" })).toBe("Cloudflare");
    expect(shownCompany({ company: "Sage", domain: "sage.com" })).toBe("Sage");
  });
});

describe("the gallery's categories", () => {
  it("never lists a stored placeholder as a category", () => {
    expect(["<UNKNOWN>", " n/a ", null, undefined, " Payroll software "].map(listedCategory)).toEqual([null, null, null, null, "Payroll software"]);
  });
});
