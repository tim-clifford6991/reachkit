// SPEC §6, D66: where a site's home page could not be read, the country its
// own Google listing names is read from the rows the pass already bought.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { listingLocaleOf } from "@/lib/locale/listing";

type Row = { url: string; title?: string; description?: string };
const listing = (name: string): Row[] => JSON.parse(readFileSync(path.join(__dirname, "fixtures/listing", `${name}.json`), "utf8")) as Row[];

/** The rows DataForSEO returned for a protected site on 2026-10-10, as the
 *  pass reads them (`tests/scan/free/blocked/`). */
function recorded(domain: string): Row[] {
  const recording = JSON.parse(readFileSync(path.join(__dirname, "../scan/free/blocked", `${domain}.json`), "utf8")) as {
    vendor: { key: string; response: { tasks: { result: { items: { ranked_serp_element: { serp_item: Row } }[] }[] }[] } }[];
  };
  const ranked = recording.vendor.find((entry) => entry.key.includes("ranked_keywords"));
  return (ranked?.response.tasks[0]?.result[0]?.items ?? []).map((item) => item.ranked_serp_element.serp_item);
}

describe("the country a site's Google listing reads as", () => {
  it.each([
    ["local-service-trades-directory", { country: "GB", language: "en" }],
    ["local-service-us-plumber", { country: "US", language: "en" }],
    ["shop-uk", { country: "GB", language: "en" }],
    ["hospitality-de", { country: "DE", language: "de" }],
    ["professional-services-de", { country: "DE", language: "de" }],
  ])("%s reads as %o", (name, locale) => {
    expect(listingLocaleOf(listing(name))).toEqual(locale);
  });

  it("a software listing that names no country gives no reading", () => {
    expect(listingLocaleOf(listing("software-saas"))).toBeNull();
    expect(listingLocaleOf(recorded("sage.com"))).toBeNull();
  });

  it("a listing split two to one between countries gives no reading", () => {
    expect(listingLocaleOf(listing("creator-split"))).toBeNull();
  });

  it("too few rows that name a country give no reading", () => {
    expect(listingLocaleOf(listing("shop-uk").slice(0, 2))).toBeNull();
  });
});
