/**
 * Deep domain profiling (M2) — sitemap discovery + parsing (PURE).
 *
 * robots.txt → Sitemap: directives, and sitemap XML → entry URLs with <lastmod>
 * (the cadence signal) or child sitemaps (sitemapindex). Regex-based so a slightly
 * malformed feed still yields what it can.
 */

export interface SitemapEntry {
  loc: string;
  lastmod: string | null;
}

export interface ParsedSitemap {
  entries: SitemapEntry[];
  childSitemaps: string[];
}

/** Sitemap URLs declared in robots.txt (`Sitemap: <url>` lines). */
export function sitemapsFromRobots(robotsTxt: string): string[] {
  const out: string[] = [];
  for (const m of robotsTxt.matchAll(/^\s*sitemap:\s*(\S+)\s*$/gim)) {
    const url = m[1]?.trim();
    if (url) out.push(url);
  }
  return out;
}

/** Conventional sitemap locations to try when robots.txt declares none. */
export function defaultSitemapCandidates(domain: string): string[] {
  return [`https://${domain}/sitemap.xml`, `https://${domain}/sitemap_index.xml`];
}

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1]!.trim() : null;
}

/** Parse sitemap XML into entries (urlset) or child sitemaps (sitemapindex). */
export function parseSitemap(xml: string): ParsedSitemap {
  const childSitemaps: string[] = [];
  for (const m of xml.matchAll(/<sitemap\b[\s\S]*?<\/sitemap>/gi)) {
    const loc = tag(m[0], "loc");
    if (loc) childSitemaps.push(loc);
  }

  const entries: SitemapEntry[] = [];
  for (const m of xml.matchAll(/<url\b[\s\S]*?<\/url>/gi)) {
    const loc = tag(m[0], "loc");
    if (!loc) continue;
    entries.push({ loc, lastmod: tag(m[0], "lastmod") });
  }

  return { entries, childSitemaps };
}
