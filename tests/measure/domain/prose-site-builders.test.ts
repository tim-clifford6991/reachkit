// tests/measure/domain/prose-site-builders.test.ts — issue 1314.
//
// The customer panel read two real businesses' sites into an empty knowledge
// base. Each site's builder writes its theme's options into the classes of
// `body`, and one of those options held a word the facts reader takes for an
// example widget — so the whole page was dropped as an example. The class
// strings below are the two sites' own.
import { describe, expect, it } from "vitest";
import { prose } from "@/lib/measure/prose";

const SQUARESPACE = "tweak-site-width-option-full-width tweak-header-search-placeholder-show tweak-header-cart-style-text";
const JIMDO = "body cc-page cc-page-index j-has-shop j-m-gallery-styles j-m-dummy-styles j-m-search-styles";

const page = (bodyClass: string, inner: string): string =>
  `<!doctype html><html><head><title>Austin Plumbery</title></head><body class="${bodyClass}">${inner}</body></html>`;

describe("a site builder's theme class on the page is not an example", () => {
  it.each([
    ["Squarespace", SQUARESPACE],
    ["Jimdo", JIMDO],
  ])("%s: the page's own words are read", (_builder, bodyClass) => {
    const read = prose(page(bodyClass, "<main><h1>Plumbing repair in Austin</h1><p>We repair water heaters, drains and leaking pipes for homes and businesses.</p></main>"));
    expect(read.text).toContain("We repair water heaters, drains and leaking pipes");
    expect(read.examples).toEqual([]);
  });

  it("the one wrapper that holds the whole page is the page too", () => {
    const read = prose(page("", `<div id="siteWrapper" class="theme-placeholder-on"><p>Fresh bread baked every morning in our own bakehouse.</p><p>Open from six.</p></div>`));
    expect(read.text).toContain("Fresh bread baked every morning");
  });

  it("an example widget on such a page is still dropped, and still named as one", () => {
    const read = prose(
      page(SQUARESPACE, `<p>We repair water heaters, drains and leaking pipes for homes and businesses across the city.</p><div class="demo-card"><p>Harbour Bikes ranks third.</p></div>`)
    );
    expect(read.text).not.toContain("Harbour Bikes");
    expect(read.examples).toContain("Harbour Bikes ranks third.");
  });
});

describe("the questions a page itself asks are read from its markup", () => {
  it("reads an FAQ schema, a numbered FAQ, an accordion's button and a heading phrased as a question", () => {
    const read = prose(
      page(
        SQUARESPACE,
        `<script type="application/ld+json">${JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [{ "@type": "Question", name: "Is your team licensed and insured?", acceptedAnswer: { "@type": "Answer", text: "Yes." } }],
        })}</script>
        <h2>When do I know I need a plumber?</h2><p>When water is where it should not be.</p>
        <div class="faq-list"><p>4. Does it cost to get a diagnosis?</p><p>No, a diagnosis is free.</p></div>
        <button aria-expanded="false">Do you work on weekends?</button>`
      )
    );
    expect(read.questions).toEqual([
      "Is your team licensed and insured?",
      "Do you work on weekends?",
      "When do I know I need a plumber?",
      "Does it cost to get a diagnosis?",
    ]);
  });

  it("takes no heading without a question mark, no label, no call to action, and nothing from the menu", () => {
    const read = prose(
      page(
        "",
        `<nav><h3>What do we repair today?</h3></nav><h2>Why you should care</h2><h2>Why us?</h2>
         <h2>Ready to get started today?</h2><h2>Need a plumber right now?</h2><h3>Buyouts explained: is one right for you?</h3>
         <p>Is this a question in running prose?</p>`
      )
    );
    expect(read.questions).toEqual([]);
  });

  it("reads a question in the site's own language", () => {
    const read = prose(page(JIMDO, `<h2>Kann ich Brot für morgen vorbestellen?</h2><h2>Lust auf frisches Brot heute?</h2>`));
    expect(read.questions).toEqual(["Kann ich Brot für morgen vorbestellen?"]);
  });
});
