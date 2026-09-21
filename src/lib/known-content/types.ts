// SPEC §7 (2026-09-20, #928) — "Known content": what the site already has.
//
// "Before a page is planned or written ReachKit knows every page it wrote
// for the site, every post on a connected WordPress (read through the
// connection when it is made and every Monday — all posts, not only ours),
// and the main site's crawled pages."
//
// Three sources, one shape, one table (`known_content`). The shape is what
// every reader of the index needs and nothing more: what the page is about
// (its title and its headings), where a reader finds it, and whether it is
// live — which is what makes it a link target as well as a topic already
// covered.
//
// **No body text.** A WordPress post's content is not read: the index
// exists to answer "is this topic already covered" and "what may this page
// link to", and both are answered by a title, its headings and an address.
// Reading and storing every post's body would be a copy of the customer's
// site in our database for no question we ask of it.

/** Where a known page came from. Three, and the tuple is the set: the
 *  database mirrors it in a check constraint. */
export const KNOWN_SOURCES = ["reachkit", "wordpress", "site"] as const;

export type KnownSource = (typeof KNOWN_SOURCES)[number];

/** One page the site already has. */
export interface KnownPage {
  source: KnownSource;
  /** The page's identity **within its source**, stable across refreshes: a
   *  publication or draft id for ours, the post id for WordPress, the URL
   *  for a crawled page. Never an identity of our own invention. */
  ref: string;
  /** Where a reader finds it, or `null` for a page of ours that is not
   *  live yet. A page with no address is a topic, never a link target. */
  url: string | null;
  title: string;
  /** The page's own headings, as its source states them. Empty where the
   *  source does not give any — a crawled inventory row has its `h1` and
   *  nothing more. */
  headings: readonly string[];
  /** Whether a reader can open it now. A queued draft of ours and a
   *  WordPress post in `draft` status are both known content — they are
   *  topics the site is about to cover — and neither is a link target. */
  live: boolean;
  publishedAt: Date | null;
}

/** A page the index offered, with how close it is to the topic asked
 *  about. `score` is `topicSimilarity`'s, recorded so the row that acted on
 *  it carries the number it acted on. */
export interface KnownMatch {
  page: KnownPage;
  score: number;
}
