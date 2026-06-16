/**
 * Deep domain profiling (M2) — RSS/Atom feed discovery + date parsing (PURE).
 *
 * Feeds are the most accurate cadence source (per-item pubDate). We auto-discover
 * the feed from the page's <link rel="alternate"> and parse item dates.
 */

/** Feed URLs declared in a page's <head> (rel=alternate rss/atom). Resolved
 *  against `baseUrl`. PURE. */
export function feedUrlsFromHtml(html: string, baseUrl: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/rel=["']?alternate/i.test(tag)) continue;
    if (!/type=["']?application\/(rss|atom)\+xml/i.test(tag)) continue;
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    try {
      out.push(new URL(href, baseUrl).toString());
    } catch {
      /* skip unresolvable href */
    }
  }
  return [...new Set(out)];
}

/** Conventional feed locations to try when none is declared. */
export function defaultFeedCandidates(domain: string): string[] {
  return ["feed", "rss", "index.xml", "atom.xml", "feed.xml", "blog/rss.xml"].map(
    (p) => `https://${domain}/${p}`,
  );
}

/** Item publish dates from RSS (<pubDate>) or Atom (<published>/<updated>). PURE. */
export function parseFeedDates(xml: string): string[] {
  const out: string[] = [];
  for (const re of [
    /<pubDate>([\s\S]*?)<\/pubDate>/gi,
    /<published>([\s\S]*?)<\/published>/gi,
    /<updated>([\s\S]*?)<\/updated>/gi,
  ]) {
    for (const m of xml.matchAll(re)) {
      const d = m[1]?.trim();
      if (d) out.push(d);
    }
  }
  return out;
}
