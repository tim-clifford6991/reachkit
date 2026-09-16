// BUILD §9 — what the hosted page and the hosted index both draw with: the
// one locale, the one date format, the address in the bar and the quiet line.
// Named once here so the index and a page cannot write a date two ways.

/**
 * The locale this page's one date is written in.
 *
 * DECISIONS 2026-08-28 — "MVP is US-English only: one `SERP_LOCATION`
 * constant" — spelled the way `Intl` spells it, the same derivation
 * `src/lib/mail/blocks/format.ts` and `_shell/format.ts` each make at their
 * own boundary. `src/lib` never imports `src/app` and neither of those is
 * this surface's, so the pin is named once more here rather than reached
 * for across a seam it may not cross.
 */
export const PAGE_LOCALE = "en-US";

/**
 * A date this page states, in the zone the customer publishes in.
 *
 * `formatMailDate`'s own reasoning, on the surface rather than in the
 * mail: a site that has stated no zone (REQ-073 c1 forbids inventing one)
 * has its date written in UTC rather than in a zone this product picked
 * for it. A published page's date is a calendar day, so at worst it is the
 * day either side — and a page that withheld its own publication date
 * because a setting was blank would be worse.
 *
 * **One date format on the page**, for the byline and for the source line
 * alike. The set's specimen writes the source's date without a year
 * ("retrieved 14 Sep"); a hosted page stays live for years and a bare day
 * and month on it is ambiguous, so both dates are written the one way.
 */
export function writeDate(at: Date, timeZone: string | null): string {
  const parts = new Intl.DateTimeFormat(PAGE_LOCALE, {
    timeZone: timeZone ?? "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? "";
  // Composed from parts, not from the locale's own pattern: `en-US` orders
  // a short date month-first and punctuates it with a comma, and the set
  // draws "4 Sep 2026". The order the set draws is fixed, not the locale's
  // to choose; the month's own spelling still comes from `Intl`.
  return `${part("day")} ${part("month")} ${part("year")}`;
}

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
export const QUIET_LINE = "num num-phrase text-base-content/60 m-0 text-sm wrap-anywhere";
