// SPEC §4 (2026-09-20, #908) — Overview's four tabs, as one tuple.
//
// "Overview has four tabs, each its own address: **Overview, Search, AI
// answers, Rivals**." The same shape `_shell/destinations.ts` gives the
// three menu items, and for the same reason: the tuple is the set, the three
// maps below are keyed by it, so a fifth tab is a compile error in three
// places at once rather than a link with no address and no name.
//
// **Overview is `/app` itself**, not a fourth address `/app` redirects to —
// the tab the customer lands on after sign-in, which is what SPEC's "the
// Overview tab stays the landing screen" means.
//
// **No word is minted here.** Three of the four are already in the registry
// under the name the product speaks them by: the menu item's "Overview"
// (`shell.nav.overview`) and the AI-answers reading's own label
// (`overview.tile.ai-answers.label`). A second spelling of a word the
// product already says is a second place to change it.
import type { CopyKey } from "@/lib/presentation/copy";

export const OVERVIEW_TABS = ["overview", "search", "ai_answers", "rivals"] as const;
export type OverviewTab = (typeof OVERVIEW_TABS)[number];

export const TAB_HREF: Readonly<Record<OverviewTab, string>> = Object.freeze({
  overview: "/app",
  search: "/app/search",
  ai_answers: "/app/ai-answers",
  rivals: "/app/rivals",
});

export const TAB_COPY_KEY: Readonly<Record<OverviewTab, CopyKey>> = Object.freeze({
  overview: "shell.nav.overview",
  search: "overview.tab.search",
  ai_answers: "overview.tile.ai-answers.label",
  rivals: "overview.tab.rivals",
});

/** There is no `TAB_SOON_KEY` any more, and no `UnbuiltTab`. Every one of
 *  the four has its screen — #916 built Search, #918 AI answers and #917
 *  Rivals — so the line a tab carried while it had only an address, and the
 *  placeholder that carried it, went with the last of them. */

/** Which tab a pathname is on, or `undefined` for a path under `/app` that
 *  is none of the four. Overview is matched **exactly** and never by prefix,
 *  because its address `/app` is the prefix of all three others — the same
 *  rule, and the same reason, as `destinationOf`'s. */
export function tabOf(pathname: string): OverviewTab | undefined {
  return OVERVIEW_TABS.find((tab) => pathname === TAB_HREF[tab]);
}
