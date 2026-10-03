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

/** The address in the bar: the host the page answers at, taken off the
 *  canonical rather than composed a second time, so the two cannot
 *  disagree. A canonical that will not parse yields the whole string,
 *  which is still the customer's own address and never ours. */
export function hostOf(canonical: string): string {
  try {
    return new URL(canonical).host;
  } catch {
    return canonical;
  }
}

/** The byline, the source and the canonical note, and the address in the
 *  bar: mono because each is a date, an address or a domain, quiet because
 *  none of them is the page, and free to fold anywhere because a canonical
 *  URL is one long token at 320. */
export const QUIET_LINE = "num num-phrase text-base-content/70 m-0 text-sm wrap-anywhere";
