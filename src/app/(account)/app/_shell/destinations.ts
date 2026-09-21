// BUILD §4.4 — "nav **Overview / Calendar / Settings**" · "No other navigation."
//
// WO-155 `## Interfaces`, verbatim: "REQ-040 criterion 1 made structural.
// Exactly three, one tuple, consumed by both the sidebar and the mobile tab
// bar — so a fourth cannot appear on one breakpoint only, and cannot appear
// at all without a type change."
//
// The three maps below are keyed by `Destination`, so each is total by
// construction: a fourth member is a compile error in three places at once,
// not a nav entry that silently renders with no address and no name.
import type { CopyKey } from "@/lib/presentation/copy";

export const DESTINATIONS = ["overview", "calendar", "settings"] as const;
export type Destination = (typeof DESTINATIONS)[number];

/** The address each destination is reached at. `ARCHITECTURE.md`'s module
 *  row names them: "`/app` (Overview · Calendar · Settings)" — Overview is
 *  `/app` itself, not a fourth address `/app` redirects to. */
export const DESTINATION_HREF: Record<Destination, string> = {
  overview: "/app",
  calendar: "/app/calendar",
  settings: "/app/settings",
};

/** The registry key each destination's name is spoken from. No renderer
 *  writes a destination's word (BP-018 decision 2: "no component has a
 *  default string").
 *
 *  **SPEC §4 (2026-09-20, #908): the menu is Overview · Plan · Settings.**
 *  *Plan* is the calendar's on-screen name and nothing more — the
 *  destination keeps its member name and its address, so every caller of
 *  `DESTINATION_HREF.calendar` outside this module is untouched, and the
 *  one thing that moved is the word the customer reads. */
export const DESTINATION_COPY_KEY: Record<Destination, CopyKey> = {
  overview: "shell.nav.overview",
  calendar: "shell.nav.plan",
  settings: "shell.nav.settings",
};

/** Which destination carries the waiting count. SPEC §4 (2026-09-20) moves
 *  it from Plan to Overview: Overview is where the page waiting for review
 *  is acted on. Stated once, here, so the panel, the rail and the dock
 *  cannot put it in three different places. */
export const WAITING_ON: Destination = "overview";

/** Addresses under `/app` that are on **no** destination: a screen the
 *  menu does not lead to and does not claim. The draft view is the one —
 *  it is reached from a card, a mail or the *Waiting for you* panel, and
 *  marking a menu item current there would point at a screen the customer
 *  is not on. Listed, because "not Overview" has to be a decision
 *  somewhere and one prefix is a smaller thing to keep true than a rule
 *  each new route has to remember. */
export const OFF_MENU_PREFIXES: readonly string[] = ["/app/draft"];

function under(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Which destination an app pathname is on, or `undefined`.
 *
 * **Overview is the whole of `/app` that nothing else claims** (SPEC §4,
 * 2026-09-20, #908 / #915): its four tabs — Overview, Search, AI answers,
 * Rivals — are four addresses, `/app`, `/app/search`, `/app/ai-answers`
 * and `/app/rivals`, and all four are the Overview destination. Matching
 * `/app` exactly left three of the four lighting no menu item at all.
 *
 * So the two specific destinations are matched first, by their own
 * prefixes; `OFF_MENU_PREFIXES` then takes the routes that are on no
 * destination by design; and what is left under `/app` is Overview. A tab
 * added beside Search needs no entry here, which is the point — the old
 * rule made a new sibling silently unreachable by navigation, and this one
 * makes it Overview until somebody says otherwise.
 */
export function destinationOf(pathname: string): Destination | undefined {
  for (const destination of DESTINATIONS) {
    if (destination === "overview") continue;
    if (under(pathname, DESTINATION_HREF[destination])) return destination;
  }
  if (OFF_MENU_PREFIXES.some((prefix) => under(pathname, prefix))) return undefined;
  return under(pathname, DESTINATION_HREF.overview) ? "overview" : undefined;
}
