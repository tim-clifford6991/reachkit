// BUILD §9 — what the hosted page and the hosted index both draw with: the
// one date format, the index's own addresses and the quiet line.
// Named once here so the index and a page cannot write a date two ways.

/**
 * The one date format, which is the published page's own
 * and are shared with the line a WordPress post carries (SPEC §7,
 * 2026-09-29, issue 1137): `src/lib/publish/render/byline.ts`. Named here so
 * the index and a page cannot write a date two ways.
 */
export { writePageDate as writeDate } from "@/lib/publish/render/byline";

/** The index's own address for one page of one search. The first page of
 *  no search is the bare root. */
export function indexHref(query: string, page: number): string {
  const params = new URLSearchParams();
  if (query !== "") params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search === "" ? "/" : `/?${search}`;
}

/** A footer line or a date that stands alone: mono because it is a date
 *  or a domain, quiet because it is not the page, and free to fold anywhere
 *  because a domain is one long token at 320. */
export const QUIET_LINE = "num num-phrase text-base-content/70 m-0 text-sm wrap-anywhere";
