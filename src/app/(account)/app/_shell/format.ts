// BUILD §4.4 — every time the shell states, in the customer's own zone.
//
// REQ-040 criterion 3: "the current publishing mode is shown together with
// the date and time of the next scheduled publish, **in the customer's
// timezone**." WO-155 step 4: "Render every date and time in
// `sites.time_zone`; the domain block renders the measurement **date**, not
// BUILD.md §4.4's specimen weekday word." §4.4's "`re-measured Mon`" is a
// specimen of the line's shape, not an instruction to print a weekday: a
// weekday alone cannot say *which* Monday, and REQ-040 c7's sibling line
// names a date.
//
// **Locale, chosen here (a parameter, not a promise).** DECISIONS
// 2026-08-28: "MVP is US-English only: one `SERP_LOCATION` constant."
// `SERP_LOCATION` is `{ location: 'United States', language: 'en' }` — the
// vendor's own vocabulary, not a BCP-47 tag, and `Intl` needs a tag. `en-US`
// is that pair written the way `Intl` spells it, and it appears once, here.
// Reversal cost: one line; nothing else in the shell names a locale.
// Exported (issue #16): the calendar states dates in the same one zone
// and the same one locale this file already chose, and reading it from
// here is what keeps that a single declaration rather than a second.
export const SHELL_LOCALE = "en-US";

/** The date a measurement was taken, in the site's zone. Numeric, so it is
 *  a value the mono rule (§2.3) covers and never a weekday word. */
export function formatDate(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(SHELL_LOCALE, {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(at);
}

/** REQ-040 c3's "date and time of the next scheduled publish", in the
 *  site's zone, with the zone itself named — a time with no zone beside it
 *  is a time the customer has to guess about. */
export function formatDateTime(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(SHELL_LOCALE, {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(at);
}
