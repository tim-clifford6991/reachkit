import type { Creator } from "@/lib/scan/types";
import { env } from "@/lib/config/env";
import { fetchWithTimeout } from "@/lib/scan/adapters/fetch-timeout";

type YtItem = {
  id?: { videoId?: string };
  snippet?: { channelTitle?: string; title?: string };
};

type YtBody = { items?: YtItem[] };

/** Alphanumeric lowercase slug — "MRR DESIGN WHEELS CORP" → "mrrdesignwheelscorp". */
function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Parse a YouTube search.list response body into Creator records.
 *
 * RELEVANCE GATE (F1): YouTube fuzzy-matches on tokens, so `"ShowMRR review"`
 * returns unrelated channels like "MRR DESIGN WHEELS CORP" (matched on "MRR").
 * A creator is kept ONLY when the competitor's full name slug actually appears
 * in the video title or channel title — precision over recall, since a wheels
 * company in a "who to reach" list destroys report credibility. Also dedupes by
 * channel within a single search. audienceProxy is left at 0.
 */
export function parseYouTube(body: unknown, coveredCompetitor: string): Creator[] {
  const items = ((body as YtBody).items ?? []);
  const compSlug = slug(coveredCompetitor);
  const creators: Creator[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const videoId = item.id?.videoId;
    const channelTitle = item.snippet?.channelTitle;
    if (!videoId || !channelTitle) continue;
    // Require the competitor name in the video/channel title (skip the gate only
    // for implausibly short names, <4 chars, which would over-match).
    if (compSlug.length >= 4) {
      const hay = slug(`${item.snippet?.title ?? ""} ${channelTitle}`);
      if (!hay.includes(compSlug)) continue;
    }
    const key = slug(channelTitle);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    creators.push({
      name: channelTitle,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      audienceProxy: 0,
      coveredCompetitor,
    });
  }
  return creators;
}

/**
 * Search YouTube for videos related to `query`.
 * Returns up to 5 Creator records (audienceProxy=0 — viewCount needs a 2nd call).
 */
export async function youtubeSearch(query: string, coveredCompetitor: string): Promise<Creator[]> {
  const enc = encodeURIComponent(query);
  const res = await fetchWithTimeout(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=5&q=${enc}&key=${env.youtubeApiKey}`,
  );
  if (!res.ok) throw new Error(`youtube search "${query}" failed: ${res.status}`);
  const body = await res.json() as unknown;
  return parseYouTube(body, coveredCompetitor);
}
