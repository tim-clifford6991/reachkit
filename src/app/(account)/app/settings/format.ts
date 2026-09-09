// BUILD §4.7 — the one value on this screen that needs a unit written beside
// it.
//
// §4.7 prints the veto window as "0–7d default 24h" and `sites.veto_hours`
// (§10) stores hours; the **stepper offers whole days**, which is what the
// approved S18 draws ("1 day") and what the writer already enforces — a
// 36-hour window is refused there because the control has no way to ask for
// one (issue #374).
//
// **The conversion is still in exactly one module.** WO-178 step 4 puts the
// days-to-hours arithmetic in one place and forbids a second copy — "a
// second copy here is the copy that goes stale, and the pair already
// disagreed once" — so this function does no arithmetic of its own: it
// calls `vetoDaysFromHours`, and the writer that validates a stored window
// calls the same one. A renderer that divided by 24 would be that second
// copy; one that asks the owner is not.
//
// The owner is `@/lib/publish/settings/veto` and not `settings.ts`, which
// re-exports it: `settings.ts` imports `publishDb`, so evaluating it parses
// every deployment binding, and three of this screen's own tests import
// this formatter with no database anywhere (#374).
//
// The unit is a word and the word has a plural, so it is a **registry key**
// with a count slot rather than a symbol written here: "1 day" and "3 days"
// are the product speaking, unlike the bare `h` this used to append.
//
// **Unless the stored window is not whole days**, and then it is still
// hours. See `formatVetoWindow` at the bottom: the screen renders what is
// stored and never rounds it into the shape the control can produce.
// Imported **by file and not through the barrel**, the idiom `model.ts`
// beside this one already records: `@/lib/publish/settings`'s index
// re-exports the writer, which reaches `@/lib/db` and parses every
// deployment binding the moment it is evaluated. This module is a
// formatter — three of the screen's own tests import it transitively and
// none of them has a database — so the leaf stays a leaf (ADR-092).
import { isWholeDays, vetoDaysFromHours } from "@/lib/publish/settings/veto";

/** The veto window in whole days, as the stepper offers it. */
export function vetoWindowDays(hours: number): number {
  return vetoDaysFromHours(hours);
}

/** Whether the stored window is one the stepper could have asked for. The
 *  screen needs the question, not a second answer to it — see
 *  `formatVetoWindow` below for why it must ask. */
export { isWholeDays as vetoIsWholeDays };

/**
 * `h` is a unit symbol, not a sentence: it names no product idea, states
 * nothing about the customer and would read the same in any language this
 * product ever spoke. It is written here, once, rather than in JSX — the
 * registry holds the words the product speaks, and a unit attached to a
 * numeral is part of the numeral (§2.3 puts both in JetBrains Mono for the
 * same reason).
 */
const HOURS_UNIT = "h";

/**
 * The stored window in **hours**, for a value that is not a whole number of
 * days (issue #374).
 *
 * The stepper offers whole days and the writer refuses anything else, so
 * this renders only a window that was already stored — and it must render
 * it as stored. `model.ts` states the rule this keeps: "`vetoHours` is
 * read, never corrected … a read that 'corrects' a stored value would hide
 * the very state the validator exists to prevent from ever being stored."
 * A 36-hour window drawn as "1.5 days" reads as a setting somebody chose,
 * which is the one thing it is not.
 */
export function formatVetoWindow(hours: number): string {
  return `${hours}${HOURS_UNIT}`;
}
