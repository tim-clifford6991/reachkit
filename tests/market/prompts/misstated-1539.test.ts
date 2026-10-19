// Issue 1539, condition 1: a stored AI answer that names the business and
// states a price, place or count contradicting a site fact yields one
// finding naming both; a matching figure yields none.
import { describe, expect, it } from "vitest";
import { readPromptAnswer } from "@/lib/market/prompts/answer";
import { misstatedFacts, statementsOf, type SiteFacts } from "@/lib/market/prompts/misstated";

const SITE = { siteName: "Acme", ownDomain: "acme.example", rivals: [{ name: "Rivalo", domain: "rivalo.example" }] };
const PRICING = "https://acme.example/pricing";

const facts = (over: Partial<SiteFacts> = {}): SiteFacts => ({
  prices: [{ text: "€49 per month", url: PRICING }],
  statements: [{ text: "Trusted by 1,200 customers", url: "https://acme.example/" }],
  places: [{ text: "Based in Berlin, Germany", url: "https://acme.example/about" }],
  ...over,
});

const findings = (text: string, language: "en" | "de" = "en", site: SiteFacts = facts()) =>
  misstatedFacts({ answers: [{ states: statementsOf({ text, ...SITE, language }) }], facts: site, language });

describe("an AI answer that misstates the business (issue 1539)", () => {
  it("a price the site does not state is one finding naming both", () => {
    expect(findings("Acme is a tool for small shops. Acme plans from €29 a month.")).toEqual([
      { kind: "price", aiSays: "€29", answer: "Acme plans from €29 a month.", siteSays: "€49 per month", url: PRICING },
    ]);
  });

  it("a matching price, written another way, is none", () => {
    expect(findings("Acme costs 49 EUR a month.")).toEqual([]);
    expect(findings("Acme kostet 49,00 € im Monat.", "de")).toEqual([]);
  });

  it("a price in a line about a rival, or in a currency the site never prices in, is none", () => {
    expect(findings("| **Rivalo** | $29/mo |\n| **Acme** | €49/mo |")).toEqual([]);
    expect(findings("Acme costs $29 a month.")).toEqual([]);
    expect(findings("Acme is cheaper than Rivalo, which starts at €29.")).toEqual([]);
  });

  it("a table row of the business is read as its own line", () => {
    expect(findings("| Tool | Entry price |\n|---|---|\n| **Acme** | €19/mo |\n| **Rivalo** | €49/mo |")[0]).toMatchObject({
      aiSays: "€19",
      siteSays: "€49 per month",
    });
  });

  it("a range, a bound and a share are not a figure the answer asserts", () => {
    expect(findings("Acme costs between €19 – €99 a month.")).toEqual([]);
    expect(findings("Acme costs <€100 a month.")).toEqual([]);
  });

  it("a higher count of what the site counts once is a finding; a lower one or the same is none", () => {
    expect(findings("Acme has over 5,000 customers.")).toEqual([
      { kind: "count", aiSays: "5,000 customers", answer: "Acme has over 5,000 customers.", siteSays: "Trusted by 1,200 customers", url: "https://acme.example/" },
    ]);
    expect(findings("Acme has over 500 customers.")).toEqual([]);
    expect(findings("Acme has 1,200 customers.")).toEqual([]);
  });

  it("a country the site's places never name is a finding; the site's own is none", () => {
    expect(findings("Acme is a company based in Canada.")).toMatchObject([{ kind: "place", aiSays: "Canada", siteSays: "Based in Berlin, Germany" }]);
    expect(findings("Acme is based in Germany.")).toEqual([]);
    expect(findings("Acme ist ein Unternehmen aus Österreich.", "de")).toMatchObject([{ kind: "place", aiSays: "Österreich" }]);
  });

  it("a site that states no price, count or country has nothing to contradict", () => {
    expect(findings("Acme plans from €29. Acme has 5,000 customers in Canada.", "en", { prices: [], statements: [], places: [] })).toEqual([]);
  });

  it("the reading keeps what the answer states, so a stored row is compared later", () => {
    const reading = readPromptAnswer({
      text: "Acme plans from €29 a month.",
      citedDomains: [],
      citedUrls: [],
      ownDomain: SITE.ownDomain,
      siteName: SITE.siteName,
      rivals: SITE.rivals,
    });
    expect(reading.states).toEqual([{ kind: "price", raw: "€29", says: "Acme plans from €29 a month.", key: "€", values: ["29"] }]);
  });
});
