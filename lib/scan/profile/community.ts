/**
 * Deep domain profiling (M2 #2) — community presence.
 *
 * Where is the brand discussed, and how recently? Hacker News (Algolia, free) +
 * Reddit (via the demand engine's DataForSEO `site:reddit.com` search — no Reddit
 * API). Recency-first: a brand last mentioned 2 years ago has no live community
 * footprint. `summarizePresence` is pure; the gather is fixtures-aware.
 */

import { hnSearchTimed } from "@/lib/scan/adapters/hn-algolia";
import { searchDemand } from "@/lib/scan/demand/search";
import type { CommunityPresence } from "./types";

const DAY_MS = 86_400_000;

interface RawMention {
  title: string;
  url: string;
  at: string | null;
}

/** Pure: roll raw mentions into a recency-aware presence summary. */
export function summarizePresence(
  source: CommunityPresence["source"],
  mentions: RawMention[],
  nowMs: number,
): CommunityPresence {
  let lastMs = -Infinity;
  for (const m of mentions) {
    if (!m.at) continue;
    const t = Date.parse(m.at);
    if (!Number.isNaN(t) && t > lastMs) lastMs = t;
  }
  const lastSeen = lastMs === -Infinity ? null : new Date(lastMs).toISOString();

  const topThreads = [...mentions]
    .sort((a, b) => (Date.parse(b.at ?? "") || 0) - (Date.parse(a.at ?? "") || 0))
    .slice(0, 3)
    .map((m) => ({ title: m.title, url: m.url, at: m.at }));

  return {
    source,
    mentions: mentions.length,
    lastSeen,
    active: lastSeen != null && nowMs - lastMs <= 90 * DAY_MS,
    topThreads,
  };
}

/**
 * Gather community presence for a brand across HN + Reddit. Each source degrades
 * to empty independently; sources with no mentions are omitted. `searchDemand`
 * (Reddit) and a failing HN call both degrade to [] — fixtures-safe.
 */
export async function gatherCommunityPresence(
  brand: string,
  nowMs: number = Date.now(),
): Promise<CommunityPresence[]> {
  const [hn, reddit] = await Promise.all([
    hnSearchTimed(brand).catch(() => []),
    searchDemand(brand, { recency: "year" }).catch(() => []),
  ]);

  const out: CommunityPresence[] = [];

  const hnPresence = summarizePresence(
    "hacker_news",
    hn.map((h) => ({ title: h.title, url: h.url, at: h.at })),
    nowMs,
  );
  if (hnPresence.mentions > 0) out.push(hnPresence);

  const redditPresence = summarizePresence(
    "reddit",
    reddit.map((r) => ({ title: r.title, url: r.url, at: r.publishedAt })),
    nowMs,
  );
  if (redditPresence.mentions > 0) out.push(redditPresence);

  return out;
}
