// tests/market/rivals/reach.test.ts — issue 1468
//
// A market is local by what the site says of itself; the map on its
// searches only bears that out. pilot.com and jotform.com were read as
// local by #1465's map rule and lost their national rivals: their stored
// searches showed a map on 4 of 11 and 1 of 12, and their home pages state
// an organisation's structured data, jotform's with its office address.
import { describe, expect, it } from "vitest";
import { readsLocal, type ReachProfile } from "../../../src/lib/market/rivals/reach.ts";
import type { MarketSerp } from "../../../src/lib/market/views.ts";

const search = (map: boolean): MarketSerp => ({
  organic: [{ position: 1, domain: "rival.com" }],
  ...(map ? { localPack: [{ domain: "corner-bookkeeper.com" }] } : {}),
  aiOverview: { present: false, referenceDomains: [] },
});
const searches = (mapped: number, of: number): MarketSerp[] => Array.from({ length: of }, (_, i) => search(i < mapped));
const reads = (profile: ReachProfile | null, schemaTypes: string[], serps: MarketSerp[], measuredInTown = false): boolean =>
  readsLocal({ measuredInTown, profile, schemaTypes, serps });

describe("issue 1468 — a map on some searches does not make a national business local", () => {
  const pilot = ["imageobject", "offer", "offercatalog", "organization", "service"];
  const jotform = ["contactpoint", "corporation", "person", "postaladdress", "webpage"];

  it("a bookkeeping service and a forms builder read before the town was asked are national", () => {
    expect(reads({ offeringType: "outsourced bookkeeping and tax service", category: "bookkeeping services" }, pilot, searches(4, 11))).toBe(false);
    expect(reads({ offeringType: "online form builder", category: "form builder software" }, jotform, searches(1, 12))).toBe(false);
  });

  it("with no profile at all, national", () => {
    expect(reads(null, pilot, searches(4, 11))).toBe(false);
    expect(reads(null, jotform, searches(1, 12))).toBe(false);
  });

  it("a profile that read no town is national, whatever it sells", () => {
    expect(reads({ town: "", offeringType: "independent café" }, [], searches(5, 5))).toBe(false);
  });
});

describe("issue 1468 — a business carried out where it is stays local", () => {
  it("a town measured or read, or structured data of an in-person trade, is local", () => {
    expect(reads(null, [], searches(0, 4), true)).toBe(true);
    expect(reads({ town: "San Francisco, California" }, [], searches(0, 4))).toBe(true);
    expect(reads(null, ["plumber", "faqpage"], searches(0, 4))).toBe(true);
  });

  it("a profile read before the town was asked reads it, and the map bears it out", () => {
    expect(reads({ offeringType: "full-service restaurant", category: "fine dining restaurant San Francisco" }, [], searches(2, 5))).toBe(true);
    expect(reads({ offeringType: "direct-to-consumer coffee subscription and retail", category: "specialty coffee beans" }, ["organization"], searches(2, 6))).toBe(true);
    expect(reads({ offeringType: "Handwerksbäckerei mit Einzelhandel", category: "Bäckerei, Brot, Backwaren" }, [], searches(3, 5))).toBe(true);
  });

  it("the map is corroboration, never the reason: no map, or software, is national", () => {
    expect(reads({ offeringType: "full-service restaurant", category: "restaurant" }, [], searches(0, 5))).toBe(false);
    expect(reads({ offeringType: "restaurant booking software", category: "restaurant software" }, [], searches(3, 5))).toBe(false);
  });
});
