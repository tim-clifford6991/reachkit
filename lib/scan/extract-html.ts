/**
 * Wave A signal extraction — a deterministic parser over the subject page HTML
 * that is ALREADY stored in `raw_documents` (source_type "site_fetch"). The
 * preliminary scan only reads title/description/h1; this surfaces the on-page
 * SEO/content hygiene signals (JSON-LD, OG/Twitter, canonical, heading
 * structure, word count, image alt coverage) with ZERO new API cost.
 *
 * Pure + dependency-light (node-html-parser, already a dep) so it unit-tests in
 * node and feeds the 18-signal registry.
 */

import { parse } from "node-html-parser";

export interface HtmlSignals {
  title: { present: boolean; length: number };
  metaDescription: { present: boolean; length: number };
  jsonLd: { present: boolean; types: string[] };
  openGraph: { present: boolean; count: number; hasImage: boolean };
  twitterCard: { present: boolean };
  canonical: { present: boolean };
  headings: { h1Count: number; h2Count: number; h3Count: number; wellStructured: boolean };
  wordCount: number;
  images: { count: number; withAlt: number; altCoverage: number };
}

export function extractHtmlSignals(html: string): HtmlSignals {
  const root = parse(html);

  const titleText = root.querySelector("title")?.text?.trim() ?? "";
  const metaDesc =
    root.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() ?? "";

  // JSON-LD / schema.org — collect @type values (handle arrays/graphs).
  const ldScripts = root.querySelectorAll('script[type="application/ld+json"]');
  const types: string[] = [];
  const collect = (o: unknown): void => {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) {
      o.forEach(collect);
      return;
    }
    const t = (o as Record<string, unknown>)["@type"];
    if (typeof t === "string") types.push(t);
    else if (Array.isArray(t)) types.push(...t.filter((x): x is string => typeof x === "string"));
    const graph = (o as Record<string, unknown>)["@graph"];
    if (Array.isArray(graph)) graph.forEach(collect);
  };
  for (const sc of ldScripts) {
    try {
      collect(JSON.parse(sc.text));
    } catch {
      /* ignore malformed JSON-LD */
    }
  }

  const ogTags = root.querySelectorAll('meta[property^="og:"]');
  const hasOgImage = ogTags.some(
    (m) => m.getAttribute("property") === "og:image" && (m.getAttribute("content")?.length ?? 0) > 0,
  );
  const twitter = root.querySelector('meta[name^="twitter:"]');
  const canonical = root.querySelector('link[rel="canonical"]');

  const h1Count = root.querySelectorAll("h1").length;
  const h2Count = root.querySelectorAll("h2").length;
  const h3Count = root.querySelectorAll("h3").length;
  const wellStructured = h1Count === 1 && h2Count >= 1;

  // Images (before stripping scripts — imgs never live inside <script>).
  const imgs = root.querySelectorAll("img");
  const withAlt = imgs.filter((i) => (i.getAttribute("alt")?.trim().length ?? 0) > 0).length;
  const imgCount = imgs.length;

  // Word count — strip non-content nodes, then count visible body tokens.
  for (const el of root.querySelectorAll("script, style, noscript")) el.remove();
  const text = (root.querySelector("body") ?? root).text.replace(/\s+/g, " ").trim();
  const wordCount = text.length === 0 ? 0 : text.split(" ").filter(Boolean).length;

  return {
    title: { present: titleText.length > 0, length: titleText.length },
    metaDescription: { present: metaDesc.length > 0, length: metaDesc.length },
    jsonLd: { present: ldScripts.length > 0, types: Array.from(new Set(types)) },
    openGraph: { present: ogTags.length > 0, count: ogTags.length, hasImage: hasOgImage },
    twitterCard: { present: twitter != null },
    canonical: { present: canonical != null },
    headings: { h1Count, h2Count, h3Count, wellStructured },
    wordCount,
    images: { count: imgCount, withAlt, altCoverage: imgCount === 0 ? 1 : withAlt / imgCount },
  };
}
