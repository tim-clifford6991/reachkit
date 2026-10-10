// tests/site-profile/site-name.test.ts — issues #577 and #1380, SPEC.md §2
// ("the site name", and the line of 2026-10-10).
//
// The name a card, a report and the setup screen show for a company: its
// brand, read off what the site publishes and matched to its domain, never
// the tagline its page title carries. A site that names itself nowhere has
// no name, because a guessed one would put a word in the customer's mouth.
import { describe, expect, it } from "vitest";
import { brandName, publishedNames } from "../../src/lib/site-profile/site-name";

const nameOf = (html: string, domain: string) => brandName(publishedNames(html), domain);

describe("the company's name is its brand", () => {
  it("drops a tagline after the brand, whichever separator the title uses", () => {
    expect(brandName(["Paddle - Subscriptions, Payments & Tax Compliance for SaaS & Mobile Apps"], "paddle.com")).toBe("Paddle");
    expect(brandName(["Clearleft | Strategic design consultancy"], "clearleft.com")).toBe("Clearleft");
    expect(brandName(["SavvyCal: Scheduling software everyone will love"], "savvycal.com")).toBe("SavvyCal");
    expect(brandName(["Tattly — Temporary tattoos by real artists"], "tattly.com")).toBe("Tattly");
  });

  it("drops a tagline or a page's name before the brand", () => {
    expect(brandName(["Pricing – Example Payments"], "examplepayments.com")).toBe("Example Payments");
    expect(brandName(["Emergency plumber in Austin, open 24 hours | Austin Plumbery"], "austinplumbery.com")).toBe("Austin Plumbery");
    expect(brandName(["Home · Products · Fletcher Electric"], "fletcherelectric.co.uk")).toBe("Fletcher Electric");
  });

  it("takes a title with no separator whole where it is a name", () => {
    expect(brandName(["Example Payments"], "examplepayments.com")).toBe("Example Payments");
    expect(brandName(["Pay-as-you-go invoicing"], "payg.example")).toBe("Pay-as-you-go invoicing");
  });

  it("reads the brand out of a title that is one sentence, and falls back to the domain's", () => {
    expect(brandName(["Paddle is the merchant of record for software companies"], "paddle.com")).toBe("Paddle");
    expect(brandName(["The complete payments infrastructure for software companies worldwide"], "paddle.com")).toBe("Paddle");
    expect(brandName(["Welcome | Home"], "fletcher-electric.co.uk")).toBe("Fletcher Electric");
  });

  it("keeps a brand that differs from its domain", () => {
    expect(brandName(["Harbour Bike Repair"], "hbr-leeds.co.uk")).toBe("Harbour Bike Repair");
    expect(brandName(["Careers | International Business Machines"], "ibm.com")).toBe("International Business Machines");
    expect(brandName(["Alexander & Co | Chartered Accountants Manchester"], "alexander.co.uk")).toBe("Alexander & Co");
    expect(brandName(["Zuni | Restaurant in San Francisco"], "zunicafe.com")).toBe("Zuni");
  });

  it("reads titles that are not English", () => {
    expect(brandName(["Bäckerei Hinkel – Brot und Brötchen aus Düsseldorf"], "baeckerei-hinkel.de")).toBe("Bäckerei Hinkel");
    expect(brandName(["Réservez votre table | Café Lumière"], "cafelumiere.fr")).toBe("Café Lumière");
    expect(brandName(["フリマアプリ｜メルカリ"], "mercari.com")).toBe("Mercari");
    expect(brandName(["Bäckerei Müller - Seit 1920"], "xn--bckerei-mller-bfb28a.de")).toBe("Bäckerei Müller");
  });
});

describe("the names a home document publishes", () => {
  it("prefers og:site_name, then application-name, then the organisation's schema name, then the title", () => {
    const title = "<title>Billing for software companies | Paddle</title>";
    const schema = '<script type="application/ld+json">{"@graph":[{"@type":"Organization","name":"Paddle.com Market Ltd"}]}</script>';
    const app = '<meta name="application-name" content="Paddle App">';
    const og = '<meta content="Paddle &amp; Co" property="og:site_name">';
    expect(nameOf(title, "paddle.com")).toBe("Paddle");
    expect(nameOf(schema + title, "paddle.com")).toBe("Paddle.com Market Ltd");
    expect(nameOf(app + schema + title, "paddle.com")).toBe("Paddle App");
    expect(nameOf(og + app + schema + title, "paddle.com")).toBe("Paddle & Co");
  });

  it("passes over a declared name that is a tagline", () => {
    const html =
      '<meta property="og:site_name" content="The best way to sell software, anywhere in the world">' +
      "<title>Tom &amp;  Jerry\n  Payments</title>";
    expect(nameOf(html, "tjpay.com")).toBe("Tom & Jerry Payments");
  });

  it("answers null where the document names the site nowhere", () => {
    expect(nameOf("<html><head></head><body><h1>Welcome</h1></body></html>", "example.com")).toBeNull();
    expect(nameOf("", "example.com")).toBeNull();
    expect(nameOf("<title>   </title>", "example.com")).toBeNull();
  });
});
