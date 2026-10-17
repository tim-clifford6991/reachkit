// tests/market/rivals/town.test.ts — issue 1480
//
// One reading of where a business sells, for the free scan and the paid
// pass: a town is its market only where the site says it serves it
// (`servingEvidence`, the paid path's rule since issue 1370). close.com, a
// CRM, read "Austin, Texas" off its footer and was measured there. The
// panel: a local service, a shop, a restaurant, a firm, software and a
// creator, in English and German.
import { describe, expect, it } from "vitest";
import { placeOf, readPlaceSignals } from "../../../src/lib/locale/place.ts";
import { profileTown, readsLocal, townHolds, type ReachProfile } from "../../../src/lib/market/rivals/reach.ts";

const home = (domain: string, text: string) => ({ url: `https://${domain}/`, title: "", text });
const holds = (a: { town: string; profile: ReachProfile; domain: string; text: string; html?: string }): boolean =>
  townHolds({
    place: placeOf(a.town)!,
    profile: a.profile,
    ...(a.html === undefined ? {} : { stated: readPlaceSignals(a.html) }),
    home: home(a.domain, a.text),
  });

describe("issue 1480 — a footer address does not make software or a firm with clients anywhere local", () => {
  it("close.com: a CRM whose footer gives an Austin address is measured across its country", () => {
    const text = "Close is the CRM built for small sales teams. Call, email and text from one place.\n1023 Springdale Rd, Austin, TX 78721";
    expect(holds({ town: "Austin, Texas", profile: { kind: "software", category: "sales CRM software" }, domain: "close.com", text })).toBe(false);
    expect(holds({ town: "Austin, Texas", profile: { kind: "software", reach: "local", category: "sales CRM software" }, domain: "close.com", text })).toBe(false);
  });

  it("a design consultancy with one Brighton office and clients across the country has no town", () => {
    const text = "We are a design consultancy based in Brighton. We work with clients across the UK and Europe.\n68 Quebec Street, Brighton BN2 3UX";
    expect(holds({ town: "Brighton", profile: { kind: "professional-services", reach: "local", category: "UX design agency" }, domain: "clearleft.com", text })).toBe(false);
  });

  it("a course creator who names their city has none", () => {
    expect(holds({ town: "Toronto", profile: { kind: "creator", category: "JavaScript courses" }, domain: "wesbos.com", text: "Courses by Wes Bos, a developer in Toronto." })).toBe(false);
  });
});

describe("issue 1480 — a business that serves its town keeps it", () => {
  it("a plumber, a restaurant and an accountancy in English", () => {
    expect(
      holds({ town: "Austin", profile: { kind: "local-service", reach: "local", category: "plumber" }, domain: "austinplumbery.com", text: "Your trusted plumber in Austin for repairs, drains and water heaters." })
    ).toBe(true);
    expect(
      holds({ town: "San Francisco, California", profile: { kind: "hospitality", reach: "local", category: "restaurant" }, domain: "zunicafe.com", text: "Zuni Café. 1658 Market Street, San Francisco. Open Tuesday to Sunday." })
    ).toBe(true);
    expect(
      holds({ town: "Manchester", profile: { kind: "professional-services", reach: "local", category: "accountants" }, domain: "alexander.co.uk", text: "Chartered accountants in Manchester for owner-managed businesses." })
    ).toBe(true);
  });

  it("a German bakery that states itself a Bakery, and a German electrician that names its town", () => {
    const html = '<script type="application/ld+json">{"@type":"Bakery","address":{"addressLocality":"Düsseldorf","addressCountry":"DE"}}</script>';
    expect(
      holds({ town: "Düsseldorf", profile: { kind: "shop", reach: "local", category: "Bäckerei" }, domain: "baeckerei-hinkel.de", text: "Bäckerei Hinkel, Mittelstraße 25, Düsseldorf. Brot und Brötchen seit 1891.", html })
    ).toBe(true);
    expect(
      holds({ town: "Köln", profile: { kind: "local-service", reach: "local", category: "Elektriker" }, domain: "elektro-beispiel.de", text: "Ihr Elektriker in Köln für Neubau, Altbau und Reparatur." })
    ).toBe(true);
  });

  it("a shop with premises in its town, and one that only ships from there", () => {
    expect(
      holds({ town: "Leeds", profile: { kind: "shop", reach: "local", category: "bike shop" }, domain: "leedsbikes.co.uk", text: "The friendliest bike shop in Leeds: servicing, repairs and new bikes." })
    ).toBe(true);
    expect(
      holds({ town: "Brooklyn", profile: { kind: "shop", reach: "international", category: "temporary tattoos" }, domain: "tattly.com", text: "Designy temporary tattoos, shipped worldwide from Brooklyn." })
    ).toBe(false);
  });
});

describe("issue 1480 — the town a stored profile read is read the same way", () => {
  it("a town beside a reach beyond it, or software, is none", () => {
    expect(profileTown({ town: "Austin, Texas", reach: "international", kind: "software" })).toBe("");
    expect(profileTown({ town: "Austin, Texas", kind: "software" })).toBe("");
    expect(profileTown({ town: "Austin, Texas", reach: "local", kind: "local-service" })).toBe("Austin, Texas");
    expect(profileTown({ reach: "local" })).toBeUndefined();
  });

  it("so a stored CRM with a footer town is a national market for its rivals", () => {
    const serps = [{ organic: [{ position: 1, domain: "rival.com" }], localPack: [{ domain: "austin-agency.com" }], aiOverview: { present: false, referenceDomains: [] } }];
    expect(readsLocal({ measuredInTown: false, profile: { town: "Austin, Texas", reach: "international", kind: "software" }, schemaTypes: [], serps })).toBe(false);
    expect(readsLocal({ measuredInTown: false, profile: { town: "Austin, Texas", reach: "local", kind: "local-service" }, schemaTypes: [], serps })).toBe(true);
  });
});
