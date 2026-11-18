// Whether a published page has ever been seen in search.
//
// A page whose address is in any SERP or ranked row the site's scans stored, for any search and in any week (the
// Google results bought for the page questions included), is `seen`; so is one Search Console's URL Inspection calls
// indexed, whose address the store adds to the rows read here. Otherwise it is `not_verified`: none of the results
// ReachKit read held it, which is never "not indexed". Where a stored row behind a Google redirect may be the page,
// nothing is said. Pure, and nothing is bought.
import { googleWrapper, hidesOwnPage } from "@/lib/market/rivals/domains";
import { addressOf } from "@/lib/measure/page-reading";

export type IndexState = "seen" | "not_verified";

/** Every address in one stored report's SERPs and ranked rows, read off the
 *  stored JSON as it is (`report->serps`, `report->ownRankedRows`), and the
 *  Google results bought for the page questions (`report->pageQuestions->rows`,
 *  issue 1548). A shape this cannot read adds nothing. */
export function urlsIn(stored: { serps: unknown; ranked: unknown; pages?: unknown; domain?: string }): string[] {
  const urls: string[] = [];
  const add = (row: unknown) => {
    const url = (row as { url?: unknown } | null)?.url;
    // A redirect row is kept only where it may be the site's own page, so its page is unknown rather than unseen.
    if (typeof url === "string" && url !== "" && (googleWrapper(url) === null || hidesOwnPage([row as object], stored.domain ?? ""))) urls.push(url);
  };
  if (Array.isArray(stored.serps)) {
    for (const serp of stored.serps) {
      const organic = (serp as { kind?: unknown; value?: { organic?: unknown } } | null)?.value?.organic;
      if (Array.isArray(organic)) organic.forEach(add);
    }
  }
  if (Array.isArray(stored.ranked)) stored.ranked.forEach(add);
  if (Array.isArray(stored.pages)) {
    for (const row of stored.pages) {
      const organic = (row as { organic?: unknown } | null)?.organic;
      if (Array.isArray(organic)) organic.forEach(add);
    }
  }
  return urls;
}

/** One page's index state, from every address it has answered at and every address a stored row held; `null` where
 *  a row whose address is hidden may be the page. */
export function indexStateOf(addresses: readonly string[], seenUrls: readonly string[]): IndexState | null {
  const seen = new Set(seenUrls.map(addressOf));
  if (addresses.some((url) => seen.has(addressOf(url)))) return "seen";
  return seenUrls.some((url) => googleWrapper(url) !== null) ? null : "not_verified";
}
