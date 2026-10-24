// Issue 1538 — whether a published page has ever been seen in search.
//
// A page whose address is in any SERP or ranked row the site's scans
// stored, for any search and in any week — the Google results bought for
// the page questions included (issue 1548) — is `seen`. Otherwise it is
// `not_verified`: none of the results ReachKit read held it. That is never
// "not indexed". A page Search Console's URL Inspection calls indexed is
// seen too (issue 1553): the store adds its address to the rows read
// here. Google says a `site:` search does not list every page it
// has indexed, and the rows read here are fewer than that, so not seeing a
// page proves nothing about the index. There is no third state.
//
// Pure, and nothing is bought: the rows are the ones the weekly passes
// already stored.
import { addressOf } from "@/lib/measure/page-reading";

export type IndexState = "seen" | "not_verified";

/** Every address in one stored report's SERPs and ranked rows, read off the
 *  stored JSON as it is (`report->serps`, `report->ownRankedRows`), and the
 *  Google results bought for the page questions (`report->pageQuestions->rows`,
 *  issue 1548). A shape this cannot read adds nothing. */
export function urlsIn(stored: { serps: unknown; ranked: unknown; pages?: unknown }): string[] {
  const urls: string[] = [];
  const add = (row: unknown) => {
    const url = (row as { url?: unknown } | null)?.url;
    if (typeof url === "string" && url !== "") urls.push(url);
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

/** One page's index state, from every address it has answered at and every
 *  address a stored row held. */
export function indexStateOf(addresses: readonly string[], seenUrls: readonly string[]): IndexState {
  const seen = new Set(seenUrls.map(addressOf));
  return addresses.some((url) => seen.has(addressOf(url))) ? "seen" : "not_verified";
}
