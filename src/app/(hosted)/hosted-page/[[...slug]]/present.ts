// BUILD §9 — what the hosted page and the hosted index both draw with: the
// one locale, the one date format, the address in the bar and the quiet line.
// Named once here so the index and a page cannot write a date two ways.

/**
 * The locale and the one date format, which are the published page's own
 * and are shared with the line a WordPress post carries (SPEC §7,
 * 2026-09-29, issue 1137): `src/lib/publish/render/byline.ts`. Named here so
 * the index and a page cannot write a date two ways.
 */
export { PAGE_LOCALE, writePageDate as writeDate } from "@/lib/publish/render/byline";

/** A footer line or a date that stands alone: mono because it is a date
 *  or a domain, quiet because it is not the page, and free to fold anywhere
 *  because a domain is one long token at 320. */
export const QUIET_LINE = "num num-phrase text-base-content/70 m-0 text-sm wrap-anywhere";
