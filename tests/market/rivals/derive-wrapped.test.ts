// A search whose top ten is mostly hidden behind Google's redirect still names
// the rivals its resolved rows, local pack and AI overview name: a hidden row
// can leave a business unnamed, never make a named one false.
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deriveRivals } from "../../../src/lib/market/rivals/derive.ts";
import type { MarketSerp } from "../../../src/lib/market/views.ts";

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});

const stored = JSON.parse(readFileSync(path.resolve(import.meta.dirname, "fixtures/au-baker-d149c119.json"), "utf8")) as { organic: MarketSerp["organic"] };
const bakeries = ["www.brumbys.com.au", "www.phillippas.com.au"];
const baker: MarketSerp = {
  organic: stored.organic,
  aiOverview: { present: true, referenceDomains: bakeries, referenceUrls: bakeries.map((host) => `https://${host}/`) },
};

describe("a search mostly behind Google's redirect still names the rivals it resolves", () => {
  it("the stored AU baker top ten (d149c119, 3 of 8 resolved) and its overview name the two cited bakeries, never google.com", () => {
    const { rivals, sources } = deriveRivals({ serps: [baker, baker], ownDomain: "bakersdelight.com.au", category: "bread and bakery" });
    expect(rivals.map((rival) => rival.domain)).toEqual(["brumbys.com.au", "phillippas.com.au"]);
    expect(sources).not.toContain("google.com");
  });

  it("in a local market the same search's pack names its bakeries too", () => {
    const packed: MarketSerp = { ...baker, localPack: [{ domain: "www.lunebakery.com" }, { domain: "www.brumbys.com.au" }] };
    const { rivals, sources } = deriveRivals({ serps: [packed, packed], ownDomain: "bakersdelight.com.au", local: true, category: "bread and bakery" });
    expect(rivals.map((rival) => rival.domain).sort()).toEqual(["brumbys.com.au", "lunebakery.com", "phillippas.com.au"]);
    expect(sources).not.toContain("google.com");
  });

  it("nationally, 3 resolved businesses beside 5 hidden rows on two searches are those 3 rivals", () => {
    const shops = ["www.pipedrive.com", "www.hubspot.com", "www.zoho.com"];
    const hidden = (position: number, i: number) =>
      i % 2 === 0 ? { position, domain: "", url: `https://google.com/goto?url=CAES${position}` } : { position, domain: "google.com", url: `https://google.com/goto?url=CAES${position}` };
    const search: MarketSerp = {
      organic: [...shops.map((domain, i) => ({ position: i + 1, domain, url: `https://${domain}/crm`, title: `CRM software | ${domain}` })), ...Array.from({ length: 5 }, (_, i) => hidden(i + 4, i))],
      aiOverview: { present: false, referenceDomains: [] },
    };
    const { rivals, sources } = deriveRivals({ serps: [search, search], ownDomain: "customer.com" });
    expect(rivals.map((rival) => rival.domain)).toEqual(["pipedrive.com", "hubspot.com", "zoho.com"]);
    expect(sources).toEqual([]);
  });
});
