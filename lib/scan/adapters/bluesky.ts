import type { Community } from "@/lib/scan/types";

type BskyPost = {
  uri?: string;
  author?: { did?: string; handle?: string };
  record?: { text?: string };
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
  const res = await fetch(
    `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${enc}&limit=10`,
  );
  if (!res.ok) throw new Error(`bluesky "${query}" failed: ${res.status}`);
  const body = await res.json() as unknown;
  return parseBluesky(body);
}
