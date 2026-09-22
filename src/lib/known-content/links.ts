// SPEC §7 (2026-09-20, #928) — "New pages link to known content where it
// helps the reader", and "the existing page is linked from related pages".
//
// Which of the pages the site already has a new page may link to. Pure, and
// three conditions, each of which is a way a link can be wrong rather than a
// preference:
//
//   **Live.** A draft of ours in review and a WordPress post still unset are
//   topics the site holds and are not addresses: linking to one is a link to
//   nothing. `live` and an address, both.
//
//   **On this site.** Every candidate's host must be the customer's own
//   domain or a subdomain of it — the hosted destination serves from one.
//   This is what makes "never another site's pages" a property of the code:
//   a row of somebody else's could only get into the index through a source
//   that read it, and this refuses it again on the way out.
//
//   **Not itself.** A page does not link to itself, so an Improve target's
//   own address is dropped.
//
// Ranked by how much the candidate's words share with the page being
// written, then newest first — a link earns its place by being about
// something near, and between two equally near pages the newer one is the
// better read.
import { KNOWN_CONTENT } from "@/lib/config/constants";
import { onSite, urlKey } from "@/lib/generate/links/select";
import { topicSimilarity } from "./similarity";
import type { KnownPage } from "./types";

/** One link a page may carry: an address and the words to link with, which
 *  are the page's own title and never a sentence of ours. */
export interface KnownLink {
  url: string;
  label: string;
  source: KnownPage["source"];
}

export interface LinkQuery {
  /** The customer's own domain. Nothing outside it is a candidate. */
  domain: string;
  /** What the page being written is about — its target search, its title,
   *  or both. */
  about: string;
  /** The address of the page being written, where it has one. */
  selfUrl?: string | null;
  /** How many links to offer. Bounded by `KNOWN_CONTENT.LINKS_MAX`. */
  max?: number;
}

function vetted(page: KnownPage, q: LinkQuery, self: string | null): page is KnownPage & { url: string } {
  if (!page.live || page.url === null || page.title.trim() === "") return false;
  if (!onSite(page.url, q.domain)) return false;
  const key = urlKey(page.url);
  return key !== null && key !== self;
}

/**
 * The known pages a page about `about` may link to, best first.
 *
 * This is the function #973's `guidesBlock()` mint is given "which pages"
 * from: every entry is vetted, published and on the customer's own site.
 */
export function knownLinkTargets(pages: readonly KnownPage[], q: LinkQuery): KnownLink[] {
  const self = q.selfUrl == null ? null : urlKey(q.selfUrl);
  const seen = new Set<string>();
  return pages
    .filter((page) => vetted(page, q, self))
    .map((page) => ({
      page,
      score: Math.max(
        topicSimilarity(q.about, page.title),
        ...page.headings.slice(0, KNOWN_CONTENT.HEADINGS_COMPARED).map((h) => topicSimilarity(q.about, h))
      ),
    }))
    .sort(
      (x, y) =>
        y.score - x.score ||
        (y.page.publishedAt?.getTime() ?? 0) - (x.page.publishedAt?.getTime() ?? 0)
    )
    .filter(({ page }) => {
      const key = urlKey(page.url ?? "");
      if (key === null || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, Math.min(q.max ?? KNOWN_CONTENT.LINKS_MAX, KNOWN_CONTENT.LINKS_MAX))
    .map(({ page }) => ({ url: page.url as string, label: page.title.trim(), source: page.source }));
}

/**
 * The same list, for the caller that asks the index rather than holding it
 * (#973's related-guides block). Reads the site's index and vets it here, so
 * no caller assembles link candidates of its own.
 */
export async function publishedGuideLinks(a: {
  siteId: string;
  domain: string;
  about: string;
  selfUrl?: string | null;
  max?: number;
}): Promise<KnownLink[]> {
  const { readKnownContent } = await import("./store");
  const pages = await readKnownContent(a.siteId);
  return knownLinkTargets(pages, {
    domain: a.domain,
    about: a.about,
    ...(a.selfUrl === undefined ? {} : { selfUrl: a.selfUrl }),
    ...(a.max === undefined ? {} : { max: a.max }),
  });
}
