// BUILD §4.7 — the one value on this screen that needs a unit written beside
// it.
//
// §4.7 prints the veto window as "0–7d default 24h", and `sites.veto_hours`
// (§10) stores hours, so the window renders in hours and no conversion
// happens anywhere on the read path. That is deliberate: WO-178 step 4 puts
// the days-to-hours arithmetic in exactly one module (the publishing settings
// writer, issue #46) and forbids a second copy — "a second copy here is the
// copy that goes stale, and the pair already disagreed once". A renderer that
// divided by 24 to print days would be that second copy.
//
// `h` is a unit symbol, not a sentence: it names no product idea, states
// nothing about the customer and would read the same in any language this
// product ever spoke. It is written here, once, rather than in JSX — the
// registry holds the words the product speaks, and a unit attached to a
// numeral is part of the numeral (§2.3 puts both in JetBrains Mono for the
// same reason).
const HOURS_UNIT = "h";

/** The veto window as §4.7 prints it: the stored hours, with their unit. */
export function formatVetoWindow(hours: number): string {
  return `${hours}${HOURS_UNIT}`;
}
