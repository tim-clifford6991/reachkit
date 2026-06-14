import type { Creator } from "@/lib/scan/types";
import { env } from "@/lib/config/env";
import { fetchWithTimeout } from "@/lib/scan/adapters/fetch-timeout";

type YtItem = {
  id?: { videoId?: string };
  snippet?: { channelTitle?: string; title?: string };
};

type YtBody = { items?: YtItem[] };

/**
 * Parse a YouTube search.list response body into Creator records.
 * audienceProxy is left at 0 — a real viewCount needs a second videos.list call.
 */
export function parseYouTube(body: unknown, coveredCompetitor: string): Creator[] {
  const items = ((body as YtBody).items ?? []);
  const creators: Creator[] = [];
  for (const item of items) {
    const videoId = item.id?.videoId;
    const channelTitle = item.snippet?.channelTitle;
    if (!videoId || !channelTitle) continue;
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
