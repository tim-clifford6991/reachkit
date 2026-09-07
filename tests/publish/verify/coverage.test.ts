// tests/publish/verify/coverage.test.ts — the one operational definition of
// REQ-062 criterion 1's "returns its whole page content to a crawler that
// runs no scripts".
//
// The pair that makes the fourth check falsifiable is the correctly
// rendered page against the JavaScript-gated one: a vague definition here
// would make `verifyLive`'s `aiReadable` vacuous. The third fixture — a
// parked page — is the evidence for the identity/readability split: it is
// **indistinguishable** from the JavaScript-gated one here, which is why a
// second, lower floor on this number cannot decide whether the document is
// ours.
//
// The archived plan is WO-233.
import { describe, expect, it } from "vitest";
import { VERIFY } from "@/lib/config/constants";
import { bodyCoverage } from "@/lib/publish/verify/coverage";

const BODY_MD = `# How long does a roof last?

A slate roof lasts **80 to 150 years**; a concrete tile roof lasts 40 to 60.
Asphalt shingles, the cheapest of the three, last 15 to 30 years and are the
usual reason a Victorian terrace needs a second roof inside one lifetime.

- Slate: 80–150 years
- Concrete tile: 40–60 years
- Asphalt shingle: 15–30 years

See the [survey we ran](https://example.com/survey) for the sample.`;

/** A correctly published page: the same words inside a real template, with
 *  typographic substitution (curly apostrophes, an em dash), markdown
 *  turned into HTML, and a navigation bar and footer around it. */
const RENDERED = `<!doctype html>
<html><head><title>How long does a roof last? — Example Roofing</title>
<meta name="description" content="Roof lifespans by material.">
<style>.nav{color:#333}</style>
</head>
<body>
<nav><a href="/">Home</a> <a href="/blog">Journal</a> <a href="/contact">Contact</a></nav>
<article>
<h1>How long does a roof last?</h1>
<p>A slate roof lasts <strong>80 to 150 years</strong>; a concrete tile roof lasts 40 to 60.
Asphalt shingles, the cheapest of the three, last 15 to 30 years and are the
usual reason a Victorian terrace needs a second roof inside one lifetime.</p>
<ul><li>Slate: 80&ndash;150 years</li><li>Concrete tile: 40&ndash;60 years</li>
<li>Asphalt shingle: 15&ndash;30 years</li></ul>
<p>See the <a href="https://example.com/survey">survey we ran</a> for the sample.</p>
</article>
<footer>&copy; 2026 Example Roofing Ltd &mdash; all rights reserved.</footer>
</body></html>`;

/** The failure the fourth check exists to find: the body reaches a browser,
 *  and only a browser. The words are all present in the document — inside a
 *  `<script>` — which is precisely why `visibleText` strips script nodes
 *  before this function counts anything. */
const JAVASCRIPT_GATED = `<!doctype html>
<html><head><title>How long does a roof last? — Example Roofing</title>
<link rel="canonical" href="https://example.com/how-long-does-a-roof-last">
</head>
<body>
<div id="root"></div>
<script id="__NEXT_DATA__" type="application/json">
{"page":"A slate roof lasts 80 to 150 years; a concrete tile roof lasts 40 to 60.
Asphalt shingles, the cheapest of the three, last 15 to 30 years and are the
usual reason a Victorian terrace needs a second roof inside one lifetime."}
</script>
<script src="/bundle.js"></script>
</body></html>`;

/** A parked domain. Nothing of the draft is here at all. */
const PARKED = `<!doctype html>
<html><head><title>example.com is for sale</title></head>
<body><h1>This domain may be for sale</h1>
<p>Enquire with our brokerage team about acquiring this premium domain name.</p>
</body></html>`;

describe("bodyCoverage — REQ-062 c1's whole page content", () => {
  it("a page that returns its whole content to a crawler that runs no scripts scores at or above the floor", () => {
    // Template chrome, curly/HTML entities and markdown-to-HTML differences
    // must not fail a page whose content is wholly present.
    expect(bodyCoverage(RENDERED, BODY_MD)).toBeGreaterThanOrEqual(VERIFY.coverageFloor);
  });

  it("a JavaScript-gated page scores decisively below it", () => {
    expect(bodyCoverage(JAVASCRIPT_GATED, BODY_MD)).toBeLessThan(VERIFY.coverageFloor);
    expect(bodyCoverage(JAVASCRIPT_GATED, BODY_MD)).toBeLessThan(0.3);
  });

  it("a byte-length ratio does not discriminate the pair, and multiset containment does", () => {
    // The evidence that the chosen definition is the one that separates
    // them: the two documents are within a factor of the same size, so a
    // length ratio puts them on the same side of any floor.
    const lengthRatio = (html: string): number =>
      Math.min(1, html.length / RENDERED.length);
    expect(Math.abs(lengthRatio(JAVASCRIPT_GATED) - lengthRatio(RENDERED))).toBeLessThan(0.75);
    expect(
      bodyCoverage(RENDERED, BODY_MD) - bodyCoverage(JAVASCRIPT_GATED, BODY_MD)
    ).toBeGreaterThan(0.6);
  });

  it("an exact-substring definition fails the rendered page, which is why containment is over tokens", () => {
    expect(RENDERED.includes(BODY_MD)).toBe(false);
    expect(bodyCoverage(RENDERED, BODY_MD)).toBeGreaterThanOrEqual(VERIFY.coverageFloor);
  });

  it("coverage cannot tell a JavaScript-gated page from a parked one", () => {
    // BP-049 decision 4, stated positively: both score close to zero and
    // this function is the wrong instrument for telling them apart.
    // Whichever way a second, lower floor were set, either the
    // JavaScript-gated page (which IS ours, and must reach `found` so the
    // fourth check can record its failure) would read as not ours, or the
    // parked page would read as ours. Identity is `isOurPage`'s, decided
    // from a different part of the document.
    const gated = bodyCoverage(JAVASCRIPT_GATED, BODY_MD);
    const parked = bodyCoverage(PARKED, BODY_MD);
    expect(gated).toBeLessThan(0.3);
    expect(parked).toBeLessThan(0.3);
    expect(Math.abs(gated - parked)).toBeLessThan(0.2);
  });

  it("**a page is not charged for its own link addresses** — the words wanted are the reader's, not the Markdown's source (issue #158)", () => {
    // A body that is one sentence and one long address. Tokenising the
    // source would demand the page show `https example com very long …`,
    // which no rendering of that body has ever put in front of a reader.
    const linky = "See the [survey](https://example.com/a/very/long/report/path/2026) for the sample.";
    const rendered = '<p>See the <a href="https://example.com/a/very/long/report/path/2026">survey</a> for the sample.</p>';
    expect(bodyCoverage(rendered, linky)).toBe(1);
  });

  it("and a page that dropped the link's label is still short of its words", () => {
    const linky = "See the [survey](https://example.com/x) for the sample.";
    expect(bodyCoverage("<p>See the for the sample.</p>", linky)).toBeLessThan(1);
  });

  it("is pure: the same pair of documents scores the same twice", () => {
    expect(bodyCoverage(RENDERED, BODY_MD)).toBe(bodyCoverage(RENDERED, BODY_MD));
  });

  it("a draft with no words scores 0 rather than a vacuous 1", () => {
    expect(bodyCoverage(RENDERED, "")).toBe(0);
    expect(bodyCoverage("", "")).toBe(0);
  });

  it("returns nothing but a number in 0..1 — no boolean, and no second threshold of its own", () => {
    for (const html of [RENDERED, JAVASCRIPT_GATED, PARKED, ""]) {
      const score = bodyCoverage(html, BODY_MD);
      expect(typeof score).toBe("number");
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});
