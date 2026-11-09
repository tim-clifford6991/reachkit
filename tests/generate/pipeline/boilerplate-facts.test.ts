// Agent files, consent pages and a page's chrome are never facts about the
// business. Tattly's stored facts were all of them, and the site still read
// as grounded.
import "../env";
import { describe, expect, it } from "vitest";
import TATTLY from "./fixtures/tattly-facts-2026-11-05.json";
import { sitePassages } from "../../../src/lib/generate/pipeline/grounding";
import { isNeverRead, isReadForFacts } from "../../../src/lib/site-profile/knowledge/priority";

const tattly = TATTLY.pages.map((page) => ({ ...page, measuredAt: new Date(page.measuredAt) }));
// Written for this suite, not read from tattly.com: what a shop's own product page says.
const PRODUCT = {
  url: "https://tattly.com/products/fox-in-the-woods",
  text: "Each temporary tattoo is drawn by a working artist and lasts two to five days on the skin.",
  measuredAt: new Date("2026-11-06T00:32:13.000Z"),
};

describe("a file for crawlers and agents, or a consent page, is never read for facts", () => {
  it.each([
    "https://tattly.com/agents.md",
    "https://shop.example.com/en/agents.md",
    "https://example.com/llms.txt",
    "https://example.com/de/llms-full.txt",
    "https://example.com/.well-known/ucp",
    "https://example.com/fr/.well-known/security.txt",
    "https://example.com/sitemap.xml",
    "https://example.com/sitemap_agentic_discovery.xml",
    "https://example.com/blog/feed.rss",
    "https://example.com/es/sitemap_products_1.xml",
    "https://tattly.com/pages/data-sharing-opt-out",
    "https://example.com/de/cookie-settings",
  ])("%s", (url) => {
    expect(isNeverRead(url)).toBe(true);
    expect(isReadForFacts(url)).toBe(false);
  });

  it.each(["https://tattly.com/", "https://tattly.com/collections/all", "https://example.com/de/about", "https://example.com/blog/agents-and-brokers"])(
    "still reads %s",
    (url) => expect(isReadForFacts(url)).toBe(true)
  );
});

describe("a passage that is a page's chrome is no business fact", () => {
  const facts = () => sitePassages([...tattly, PRODUCT]).flatMap((page) => page.passages);

  it("drops every one of tattly's stored passages and keeps the product's", () => {
    expect(TATTLY.pages.flatMap((page) => page.text.split("\n"))).toHaveLength(40);
    expect(facts()).toEqual([PRODUCT.text]);
  });

  const passagesOf = (text: string) => sitePassages([{ url: "https://example.com/", text }])[0]?.passages;

  it.each(["We use cookies to give you the best experience on our website.", "This site uses cookies and similar technologies for analytics."])(
    "drops the banner %s",
    (text) => expect(passagesOf(text)).toEqual([])
  );

  it.each([
    ["Skip to main content We bake every loaf by hand in our shop since 1987.", "We bake every loaf by hand in our shop since 1987."],
    ["Bakery Search Search Clear Our sourdough is proved for two days before it is baked.", "Our sourdough is proved for two days before it is baked."],
    ["We use cookies from our own oven in every gift box we sell.", "We use cookies from our own oven in every gift box we sell."],
  ])("keeps the business's words in %s", (text, kept) => expect(passagesOf(text)).toEqual([kept]));
});
