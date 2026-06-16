/**
 * Deep domain profiling (M2) — owned-domain content crawl.
 *
 * Near-free, recency-rich: robots → sitemap (lastmod cadence) + homepage
 * (channel fingerprint + RSS discovery → feed cadence) → the domain's content
 * channels and how active each is. Bounded fetch budget; never throws — a
 * blocked or missing source degrades to "no signal" rather than failing.
 */

import { fetchWithTimeout } from "@/lib/scan/adapters/fetch-timeout";
import { fixturesEnabled } from "@/lib/dev/fixtures";
import { computeCadence } from "./cadence";
import { sitemapsFromRobots, parseSitemap, defaultSitemapCandidates } from "./sitemap";
import { feedUrlsFromHtml, parseFeedDates, defaultFeedCandidates } from "./feeds";
import { detectChannels } from "./fingerprint";
import type { ContentChannel } from "./types";

/** Normalize a domain or URL to a bare host. */
export function toHost(input: string): string {
  const s = input.trim();
  try {
    return new URL(s.includes("://") ? s : `https://${s}`).hostname.replace(/^www\./, "");
  } catch {
    return s.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? s;
  }
}

async function fetchText(url: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(
      url,
      { headers: { "user-agent": "ReachKitBot/1.0 (+https://reachkit.app)", "accept-language": "en-US,en;q=0.9" } },
      timeoutMs,
    );
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Collect post dates from sitemaps (following one level of sitemapindex). */
async function sitemapDates(host: string, robots: string | null): Promise<string[]> {
  const candidates = [
    ...(robots ? sitemapsFromRobots(robots) : []),
    ...defaultSitemapCandidates(host),
  ];
  for (const url of candidates.slice(0, 3)) {
    const xml = await fetchText(url);
    if (!xml) continue;
    const { entries, childSitemaps } = parseSitemap(xml);
    if (entries.length > 0) {
      return entries.map((e) => e.lastmod).filter((d): d is string => !!d);
    }
    // sitemapindex → fetch the first child (prefer one that looks post-ish)
    const child = childSitemaps.find((c) => /post|blog|article|news/i.test(c)) ?? childSitemaps[0];
    if (child) {
      const childXml = await fetchText(child);
      if (childXml) {
        return parseSitemap(childXml).entries.map((e) => e.lastmod).filter((d): d is string => !!d);
      }
    }
  }
  return [];
}

/** Collect post dates from the first discoverable RSS/Atom feed. */
async function feedDates(host: string, homepage: string | null): Promise<string[]> {
  const candidates = [
    ...(homepage ? feedUrlsFromHtml(homepage, `https://${host}`) : []),
    ...defaultFeedCandidates(host),
  ];
  for (const url of candidates.slice(0, 3)) {
    const xml = await fetchText(url);
    if (xml && /<(rss|feed)\b/i.test(xml)) {
      const dates = parseFeedDates(xml);
      if (dates.length > 0) return dates;
    }
  }
  return [];
}

/**
 * Crawl a domain's owned content channels with cadence. `nowMs` injectable for
 * deterministic tests. Fixtures-mode returns [] (the live run hits the network).
 */
export async function crawlContentChannels(
  domain: string,
  nowMs: number = Date.now(),
): Promise<ContentChannel[]> {
  if (fixturesEnabled()) return [];
  const host = toHost(domain);

  const [robots, homepage] = await Promise.all([
    fetchText(`https://${host}/robots.txt`),
    fetchText(`https://${host}/`),
  ]);

  const [smDates, fdDates] = await Promise.all([
    sitemapDates(host, robots),
    feedDates(host, homepage),
  ]);

  const channels: ContentChannel[] = [];

  // Blog cadence — prefer the richer of sitemap vs feed dates.
  const blogDates = smDates.length >= fdDates.length ? smDates : fdDates;
  if (blogDates.length > 0) {
    channels.push({
      kind: "blog",
      label: "Blog / site content",
      url: `https://${host}/`,
      cadence: computeCadence(blogDates, nowMs),
    });
  }

  // Fingerprinted channels (YouTube, newsletter, dev.to, GitHub, podcast) —
  // brand-token filtered so third-party links (a Bootstrap github, an embedded
  // YouTube widget) don't masquerade as the company's owned channels.
  if (homepage) {
    const brandToken = host.split(".")[0];
    for (const c of detectChannels(homepage, brandToken)) {
      if (!channels.some((x) => x.kind === c.kind)) channels.push(c);
    }
  }

  return channels;
}
