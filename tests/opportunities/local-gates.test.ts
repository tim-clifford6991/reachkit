// SPEC §6 (issue 1561) — a local business's service asked for in its place
// is commercial, and the article rule a local service's top ten is read by
// spares the pages that answer. Pure; 0¢.
import { describe, expect, it } from "vitest";
import { classifyIntent, type PlacedBusiness } from "../../src/lib/market/questions/select";
import type { Profile } from "../../src/lib/market/questions/profile";
import { otherKindTopTen, type TopTenRow } from "../../src/lib/opportunities/derive/top-ten-kind";

const PLUMBER: Profile = {
  category: "plumbing services",
  job: "fix a leak, a blocked drain or a water heater",
  offeringType: "plumbing repair",
  audienceTerms: [],
  namedRivals: [],
  vocabulary: ["plumber", "drain", "water heater"],
  brandTokens: ["austin plumbery"],
  kind: "local-service",
};
const AUSTIN: PlacedBusiness = { kind: "local-service", serves: { name: "Austin", region: "Texas" }, marketWords: "residential plumbing plumber" };

const HANDWERKER: Profile = {
  category: "Sanitär und Heizung",
  job: "Bad, Heizung und Rohre reparieren",
  offeringType: "Sanitärinstallation",
  audienceTerms: [],
  namedRivals: [],
  vocabulary: ["klempner", "rohrreinigung"],
  brandTokens: ["rheinwerk"],
  language: "de",
};
const KOELN: PlacedBusiness = { kind: "local-service", serves: { name: "Köln" }, marketWords: "Sanitär Heizung Klempner Rohrreinigung" };

describe("a search naming the site's service and a place it serves is commercial", () => {
  it.each([
    ["emergency plumber austin", PLUMBER, AUSTIN, "solution"],
    ["plumber near me", PLUMBER, AUSTIN, "solution"],
    ["24 hour plumber", PLUMBER, AUSTIN, "solution"],
    ["rohrreinigung notdienst köln", HANDWERKER, KOELN, "solution"],
    ["klempner in der nähe", HANDWERKER, KOELN, "solution"],
  ] as const)("%s", (search, profile, where, intent) => {
    expect(classifyIntent(search, profile, where)).toBe(intent);
  });

  it("only that: a how-to stays a problem, and a search for something else or of a business that serves no place stays as it was", () => {
    expect([
      classifyIntent("emergency plumber austin", PLUMBER, AUSTIN),
      classifyIntent("how to unclog a drain austin", PLUMBER, AUSTIN),
      classifyIntent("best plumber austin", PLUMBER, AUSTIN),
      classifyIntent("austin weather today", PLUMBER, AUSTIN),
      classifyIntent("emergency plumber austin", PLUMBER, { ...AUSTIN, kind: "software" }),
    ]).toEqual(["solution", "problem", "decision", "informational", "informational"]);
  });
});

describe("a local service's article rule does not apply to a Q&A or how-to page", () => {
  const article = (n: number): TopTenRow => ({
    domain: `homeblog${n}.example`,
    url: `https://homeblog${n}.example/blog/drains-${n}`,
    title: `Drain advice ${n}`,
  });
  const ARTICLES = Array.from({ length: 10 }, (_, n) => article(n));
  const business = { kind: "local-service" as const, serves: { name: "Austin", region: "Texas" } };
  const read = (type: "keyword_page" | "answer_page", targetQuery: string) => otherKindTopTen(ARTICLES, business, { type, targetQuery });

  it.each([
    ["how to unclog a drain", "keyword_page"],
    ["water heater repair cost", "keyword_page"],
    ["why is my water heater leaking", "answer_page"],
  ] as const)("%s", (targetQuery, type) => {
    expect(read(type, targetQuery)).toBeNull();
  });

  it("only those: a page that sells, or one asked for in the place, is still held", () => {
    expect([
      read("keyword_page", "how to unclog a drain"),
      read("keyword_page", "best plumbers austin"),
      read("keyword_page", "plumber austin"),
    ]).toEqual([null, "publisher", "publisher"]);
  });
});
