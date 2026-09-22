// SPEC §7 (2026-09-20, #928) — the posts on a connected WordPress, as the
// known-content index holds them.
//
// "every post on a connected WordPress (read through the connection when it
// is made and every Monday — **all posts, not only ours**)".
//
// **All of them, and bounded.** The REST list is paginated;
// `KNOWN_CONTENT.WORDPRESS_POSTS_MAX` is how many are taken in all. A blog
// larger than that is read newest-first, which is the half that matters: a
// planned page repeats a recent post far more often than a post from 2014,
// and an unbounded read of a site we do not own is a crawl, not a lookup.
//
// **Titles, headings, excerpts, addresses — never bodies.** The headings are
// lifted out of the rendered content and the content is then dropped: they
// are what says what a post is about, and storing the body would be a copy
// of the customer's blog kept for a question nobody asks of it.
//
// **A silence is not an empty blog.** Every arm that is not "the site
// answered with posts" returns `null`, and the caller leaves the index as it
// was — because "we could not reach them" must never be written down as
// "they have nothing", which would make every topic net new the week their
// host was down.
import { KNOWN_CONTENT } from "@/lib/config/constants";
import { listPosts, type WordPressConfig } from "@/lib/publish/destinations/wordpress/client";
import type { KnownPage } from "./types";

/** What one post of theirs says about itself. Every field is read
 *  defensively: this is another site's API, and a plugin may answer with
 *  anything. */
interface PostShape {
  id?: unknown;
  link?: unknown;
  slug?: unknown;
  status?: unknown;
  date_gmt?: unknown;
  title?: { rendered?: unknown } | unknown;
  excerpt?: { rendered?: unknown } | unknown;
  content?: { rendered?: unknown } | unknown;
}

function rendered(value: unknown): string {
  if (typeof value === "string") return value;
  if (value !== null && typeof value === "object") {
    const inner = (value as { rendered?: unknown }).rendered;
    if (typeof inner === "string") return inner;
  }
  return "";
}

/** HTML to the words a reader meets: tags dropped, entities for the five
 *  characters an escaper produces turned back, whitespace collapsed. */
export function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** The post's own headings, in the order a reader meets them. `h1` to `h3`:
 *  below that a heading is a label inside a section, not what the post is
 *  about. */
export function headingsOf(html: string): string[] {
  const out: string[] = [];
  for (const match of html.matchAll(/<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    const text = plainText(match[2] ?? "");
    if (text !== "") out.push(text);
    if (out.length >= KNOWN_CONTENT.HEADINGS_COMPARED) break;
  }
  return out;
}

/** One post, or `null` where it carries no id or no title — a row with
 *  neither is not a page we can name or match. */
export function postPage(post: PostShape): KnownPage | null {
  const id = post.id;
  const ref = typeof id === "number" ? String(id) : typeof id === "string" ? id : "";
  const title = plainText(rendered(post.title));
  if (ref === "" || title === "") return null;
  const link = typeof post.link === "string" ? post.link : "";
  // "publish" is the one status a reader can open. Everything else — draft,
  // pending, future, private — is a topic the site holds and is not a link
  // target, which is exactly what `live` means here.
  const live = post.status === "publish" && link !== "";
  const date = typeof post.date_gmt === "string" ? new Date(`${post.date_gmt}Z`) : null;
  return {
    source: "wordpress",
    ref,
    url: link === "" ? null : link,
    title,
    headings: headingsOf(rendered(post.content)),
    live,
    publishedAt: date !== null && !Number.isNaN(date.getTime()) ? date : null,
  };
}

/**
 * Every post on the connected site, newest first, bounded.
 *
 * `null` where nothing could be read: a transport failure, a status that is
 * not 200, or a body that is not a list. A page that comes back short ends
 * the read — that is the last page — and a page that answers with nothing
 * ends it too.
 */
export async function readWordPressPosts(cfg: WordPressConfig): Promise<KnownPage[] | null> {
  const pages: KnownPage[] = [];
  const perPage = KNOWN_CONTENT.WORDPRESS_PER_PAGE;
  for (let page = 1; pages.length < KNOWN_CONTENT.WORDPRESS_POSTS_MAX; page++) {
    const answer = await listPosts(cfg, { page, perPage });
    if (!answer.ok || answer.status !== 200 || !Array.isArray(answer.body)) {
      // The first page failing is "we could not read this site"; a later one
      // failing is a partial read, and what was read is still true.
      return page === 1 ? null : pages;
    }
    const batch = answer.body as PostShape[];
    for (const post of batch) {
      const known = postPage(post);
      if (known !== null) pages.push(known);
      if (pages.length >= KNOWN_CONTENT.WORDPRESS_POSTS_MAX) break;
    }
    if (batch.length < perPage) break;
  }
  return pages;
}
