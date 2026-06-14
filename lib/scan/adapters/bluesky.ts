import type { Community, TimedCommunity } from "@/lib/scan/types";
import { fetchWithTimeout } from "@/lib/scan/adapters/fetch-timeout";

type BskyPost = {
  uri?: string;
  author?: { did?: string; handle?: string };
  record?: { text?: string; createdAt?: string };
  indexedAt?: string;
  likeCount?: number;
  replyCount?: number;
};

type BskyBody = { posts?: BskyPost[] };

/**
 * Converts an AT Protocol URI + author handle into a bsky.app URL.
 * "at://did:plc:abc/app.bsky.feed.post/rkey" + "alice.bsky.social"
 * → "https://bsky.app/profile/alice.bsky.social/post/rkey"
 */
function bskyUrl(uri: string, handle: string): string {
  // The rkey is the last segment of the AT-URI path
  const rkey = uri.split("/").pop() ?? uri;
  return `https://bsky.app/profile/${handle}/post/${rkey}`;
}

export function parseBluesky(body: unknown): Community[] {
  const posts = ((body as BskyBody).posts ?? []);
  return posts.map((post) => {
    const text = post.record?.text ?? "";
    const title = text.length > 80 ? text.slice(0, 80) + "..." : text;
    const handle = post.author?.handle ?? "unknown";
    const uri = post.uri ?? "";
    const url = uri !== "" ? bskyUrl(uri, handle) : `https://bsky.app/profile/${handle}`;
    return {
      source: "bluesky",
      title,
      url,
      engagement: (post.likeCount ?? 0) + (post.replyCount ?? 0),
    };
  });
}

export async function blueskySearch(query: string): Promise<Community[]> {
  const enc = encodeURIComponent(query);
  const res = await fetchWithTimeout(
    `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${enc}&limit=10`,
  );
  if (!res.ok) throw new Error(`bluesky "${query}" failed: ${res.status}`);
  const body = await res.json() as unknown;
  return parseBluesky(body);
}

// Timestamp-carrying variant for the threads delta collector. Drops posts with no
// resolvable timestamp. Prefers record.createdAt, falls back to indexedAt.
export function parseBlueskyTimed(body: unknown): TimedCommunity[] {
  const posts = ((body as BskyBody).posts ?? []);
  return parseBluesky(body).flatMap((community, i) => {
    const post = posts[i];
    const iso = post?.record?.createdAt ?? post?.indexedAt;
    if (iso == null || iso === "") return [];
    return [{ ...community, at: iso }];
  });
}

export async function blueskySearchTimed(query: string): Promise<TimedCommunity[]> {
  const enc = encodeURIComponent(query);
  const res = await fetchWithTimeout(
    `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${enc}&limit=10`,
  );
  if (!res.ok) throw new Error(`bluesky "${query}" failed: ${res.status}`);
  const body = await res.json() as unknown;
  return parseBlueskyTimed(body);
}
