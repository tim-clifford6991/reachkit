/**
 * Deep domain profiling (M2 #2) — YouTube upload cadence.
 *
 * The crawl fingerprints a company's YouTube channel URL; this fills in how
 * often (and how recently) they actually publish. Uses the cheap path —
 * channels.list (resolve the uploads playlist) → playlistItems.list (recent
 * upload dates) — NOT the 100-unit search.list. Parsers are pure; the fetch is
 * fixtures/key aware and never throws.
 */

import { env } from "@/lib/config/env";
import { fixturesEnabled } from "@/lib/dev/fixtures";
import { fetchWithTimeout } from "@/lib/scan/adapters/fetch-timeout";

export type ChannelRef =
  | { kind: "id"; value: string }
  | { kind: "handle"; value: string }
  | { kind: "user"; value: string };

/** Pure: extract a channel reference from a YouTube channel URL. */
export function parseChannelRef(url: string): ChannelRef | null {
  const id = url.match(/youtube\.com\/channel\/([\w-]+)/i);
  if (id) return { kind: "id", value: id[1]! };
  const handle = url.match(/youtube\.com\/@([\w.-]+)/i);
  if (handle) return { kind: "handle", value: `@${handle[1]}` };
  const user = url.match(/youtube\.com\/(?:c|user)\/([\w-]+)/i);
  if (user) return { kind: "user", value: user[1]! };
  return null;
}

/** channels.list query param for a ref. */
export function channelListParam(ref: ChannelRef): string {
  if (ref.kind === "id") return `id=${encodeURIComponent(ref.value)}`;
  if (ref.kind === "handle") return `forHandle=${encodeURIComponent(ref.value)}`;
  return `forUsername=${encodeURIComponent(ref.value)}`;
}

/** Pure: uploads playlist id from a channels.list response. */
export function parseUploadsPlaylist(body: unknown): string | null {
  const uploads = ((body ?? {}) as {
    items?: Array<{ contentDetails?: { relatedPlaylists?: { uploads?: string } } }>;
  }).items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  return uploads ?? null;
}

/** Pure: upload publish dates from a playlistItems.list response. */
export function parsePlaylistDates(body: unknown): string[] {
  const items = ((body ?? {}) as {
    items?: Array<{ snippet?: { publishedAt?: string } }>;
  }).items;
  const out: string[] = [];
  for (const i of items ?? []) {
    const d = i.snippet?.publishedAt;
    if (d) out.push(d);
  }
  return out;
}

async function ytGet(path: string): Promise<unknown | null> {
  try {
    const res = await fetchWithTimeout(
      `https://www.googleapis.com/youtube/v3/${path}&key=${env.youtubeApiKey}`,
      {},
      10_000,
    );
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

/**
 * Recent upload dates for a channel URL (up to 25). Fixtures-mode / no key /
 * unresolvable channel → []. Never throws.
 */
export async function youtubeChannelDates(channelUrl: string): Promise<string[]> {
  if (fixturesEnabled() || !env.youtubeApiKey) return [];
  const ref = parseChannelRef(channelUrl);
  if (!ref) return [];

  const channels = await ytGet(`channels?part=contentDetails&${channelListParam(ref)}`);
  const uploads = parseUploadsPlaylist(channels);
  if (!uploads) return [];

  const items = await ytGet(
    `playlistItems?part=snippet&maxResults=25&playlistId=${encodeURIComponent(uploads)}`,
  );
  return parsePlaylistDates(items);
}
