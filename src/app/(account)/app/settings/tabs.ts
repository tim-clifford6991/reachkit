// SPEC §4, owner R7 (2026-10-31, docs/spec/decisions/2026-11-03-2127.md): Settings' three tabs, as one tuple.
//
// The tuple is the set and both maps are keyed by it, so a fourth tab is a compile error here rather than a link
// with no address or an address with no name. Your business is `/app/settings` itself, the menu's own link.
import type { CopyKey } from "@/lib/presentation/copy";

export const SETTINGS_TABS = ["business", "pages", "account"] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

export const SETTINGS_TAB_HREF: Readonly<Record<SettingsTab, string>> = Object.freeze({
  business: "/app/settings",
  pages: "/app/settings/pages",
  account: "/app/settings/account",
});

export const SETTINGS_TAB_COPY_KEY: Readonly<Record<SettingsTab, CopyKey>> = Object.freeze({
  business: "settings.tab.business",
  pages: "settings.tab.pages",
  account: "settings.account.title",
});

/** The anchor each moved card stands under, so a link or a redirect lands on the card, not the tab's top. */
export const SETTINGS_ANCHOR = Object.freeze({
  market: "market",
  voice: "voice",
  publishing: "publishing",
  mail: "mail",
  billing: "billing",
} as const);

/** An anchored card's box; its scroll margin clears the sticky top bar and tab bar a landing scrolls under. */
export const ANCHORED = "flex min-w-0 scroll-mt-48 flex-col gap-6 lg:scroll-mt-16";

/** Which tab a pathname is on. Business is matched exactly, never by prefix: its address prefixes the others. */
export function settingsTabOf(pathname: string): SettingsTab | undefined {
  return SETTINGS_TABS.find((tab) => pathname === SETTINGS_TAB_HREF[tab]);
}
