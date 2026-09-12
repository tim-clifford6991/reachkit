// tests/site-profile/site-name.test.ts — issue #577, SPEC.md §2 Rules
// ("the site name") and §12 ruling 8 (2026-09-12).
//
// The name a free scan can show the customer on their own setup screen,
// read off the document they already publish. What is proved here is the
// difference between a name a site states and a name nobody stated: the
// second answers null, because a profile that guessed a name would put a
// word in the customer's mouth on the first screen they ever see.
import { describe, expect, it } from "vitest";
import { siteNameFromTitle, siteNameOf } from "../../src/lib/site-profile/site-name";

describe("the site's own name, as the site publishes it", () => {
  it("takes og:site_name whole where the site declares one", () => {
    const html =
      '<html><head><meta property="og:site_name" content="Example Payments">' +
      "<title>Pricing — Something Else</title></head></html>";
    expect(siteNameOf(html)).toBe("Example Payments");
  });

  it("reads og:site_name whichever way round the attributes are written", () => {
    const html = '<meta content="Example Payments" name="og:site_name">';
    expect(siteNameOf(html)).toBe("Example Payments");
  });

  it("drops the page's half of a suffixed title and keeps the site's", () => {
    expect(siteNameOf("<title>Pricing — Example Payments</title>")).toBe("Example Payments");
    expect(siteNameOf("<title>Pricing | Example Payments</title>")).toBe("Example Payments");
    expect(siteNameOf("<title>Pricing · Example Payments</title>")).toBe("Example Payments");
  });

  it("takes a title with no separator whole — a home page titled with its own name", () => {
    expect(siteNameOf("<title>Example Payments</title>")).toBe("Example Payments");
  });

  it("keeps a hyphenated phrase together — a hyphen is not a title separator", () => {
    expect(siteNameFromTitle("Pay-as-you-go invoicing")).toBe("Pay-as-you-go invoicing");
  });

  it("answers null where the document names the site nowhere", () => {
    expect(siteNameOf("<html><head></head><body><h1>Welcome</h1></body></html>")).toBeNull();
    expect(siteNameOf("")).toBeNull();
    expect(siteNameOf("<title>   </title>")).toBeNull();
  });

  it("decodes the entities a title actually carries, and folds its whitespace", () => {
    expect(siteNameOf("<title>Tom &amp;  Jerry\n  Payments</title>")).toBe("Tom & Jerry Payments");
  });
});
