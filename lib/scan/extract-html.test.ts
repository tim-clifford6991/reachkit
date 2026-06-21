import { describe, it, expect } from "vitest";
import { extractHtmlSignals } from "./extract-html";

const RICH = `<!doctype html><html lang="en"><head>
  <title>Acme — the fastest habit tracker for iOS</title>
  <meta name="description" content="Build lasting habits with the simplest streak-based tracker. Trusted by 500,000 users worldwide today." />
  <link rel="canonical" href="https://acme.com/" />
  <meta property="og:title" content="Acme" />
  <meta property="og:image" content="https://acme.com/og.png" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <script type="application/ld+json">{"@type":"SoftwareApplication","name":"Acme"}</script>
</head><body>
  <h1>Build habits that stick</h1>
  <h2>Streaks</h2><h2>Reminders</h2><h3>Widgets</h3>
  <p>Acme helps you build durable daily habits with gentle reminders and a satisfying streak system that keeps you motivated.</p>
  <img src="a.png" alt="screenshot" /><img src="b.png" alt="chart" /><img src="c.png" />
  <script>console.log('ignore me not counted as words at all here')</script>
</body></html>`;

const BARE = `<html><head><title>x</title></head><body><h1>A</h1><h1>B</h1></body></html>`;

describe("extractHtmlSignals — rich page", () => {
  const s = extractHtmlSignals(RICH);

  it("captures title presence + length", () => {
    expect(s.title.present).toBe(true);
    expect(s.title.length).toBe("Acme — the fastest habit tracker for iOS".length);
  });

  it("captures meta description presence + length", () => {
    expect(s.metaDescription.present).toBe(true);
    expect(s.metaDescription.length).toBeGreaterThan(80);
  });

  it("detects JSON-LD with its @type", () => {
    expect(s.jsonLd.present).toBe(true);
    expect(s.jsonLd.types).toContain("SoftwareApplication");
  });

  it("detects Open Graph tags incl. image, and the Twitter card", () => {
    expect(s.openGraph.present).toBe(true);
    expect(s.openGraph.hasImage).toBe(true);
    expect(s.twitterCard.present).toBe(true);
  });

  it("detects the canonical link", () => {
    expect(s.canonical.present).toBe(true);
  });

  it("reads heading structure (single H1 + subheads = well structured)", () => {
    expect(s.headings.h1Count).toBe(1);
    expect(s.headings.h2Count).toBe(2);
    expect(s.headings.wellStructured).toBe(true);
  });

  it("counts visible words and excludes <script> contents", () => {
    // visible body text is ~26 words; the 10-word <script> must not leak in
    expect(s.wordCount).toBeGreaterThan(20);
    expect(s.wordCount).toBeLessThan(34);
  });

  it("measures image alt coverage (2 of 3 have alt)", () => {
    expect(s.images.count).toBe(3);
    expect(s.images.withAlt).toBe(2);
    expect(s.images.altCoverage).toBeCloseTo(2 / 3, 2);
  });
});

describe("extractHtmlSignals — bare page", () => {
  const s = extractHtmlSignals(BARE);

  it("flags missing meta/og/canonical/json-ld", () => {
    expect(s.metaDescription.present).toBe(false);
    expect(s.openGraph.present).toBe(false);
    expect(s.canonical.present).toBe(false);
    expect(s.jsonLd.present).toBe(false);
  });

  it("flags poor heading structure (multiple H1, no H2)", () => {
    expect(s.headings.h1Count).toBe(2);
    expect(s.headings.wellStructured).toBe(false);
  });

  it("handles empty image set as full coverage (vacuously)", () => {
    expect(s.images.count).toBe(0);
    expect(s.images.altCoverage).toBe(1);
  });
});
