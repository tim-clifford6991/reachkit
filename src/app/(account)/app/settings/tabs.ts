// SPEC §4 (2026-09-20, #908) — Settings' seven tabs, as one tuple.
//
// "Settings is tabs: Your business, Market and rivals, Publishing, Your
// voice, Mail, Billing, Account. The danger zone lives in Account." The same
// shape `_overview/tabs.ts` gives the Overview's four and
// `_shell/destinations.ts` gives the three menu items, and for the same
// reason: the tuple is the set, the two maps below are keyed by it, so an
// eighth tab is a compile error in two places at once rather than a link
// with no address or an address with no name.
//
// **Your business is `/app/settings` itself**, not an eighth address it
// redirects to — the tab the customer lands on from the menu, so *Settings*
// in the side panel keeps the address it has always had and no link
// anywhere in the product moves.
//
// **Three of the seven words are already in the registry** and are reused —
// `settings.publishing.title`, `settings.billing.title` and
// `settings.account.title` are "Publishing", "Billing" and "Account", the
// words §4.7 prints and the product already speaks. A second spelling of a
// word the product already says is a second place to change it, which is
// the rule `_overview/tabs.ts` states for the same three of its four. The
// other four are drafted (#759): the two the canvas names that no card is
// titled with ("Your business", "Market and rivals"), and the two whose
// card title is not the tab's word — the voice card is "How your pages
// sound" and the mail card is "Notifications", and a tab bar has room for
// neither.
import type { CopyKey } from "@/lib/presentation/copy";

export const SETTINGS_TABS = [
  "business",
  "market",
  "publishing",
  "voice",
  "mail",
  "billing",
  "account",
] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

export const SETTINGS_TAB_HREF: Readonly<Record<SettingsTab, string>> = Object.freeze({
  business: "/app/settings",
  market: "/app/settings/market",
  publishing: "/app/settings/publishing",
  voice: "/app/settings/voice",
  mail: "/app/settings/mail",
  billing: "/app/settings/billing",
  account: "/app/settings/account",
});

export const SETTINGS_TAB_COPY_KEY: Readonly<Record<SettingsTab, CopyKey>> = Object.freeze({
  business: "settings.tab.business",
  market: "settings.tab.market",
  publishing: "settings.publishing.title",
  voice: "settings.tab.voice",
  mail: "settings.tab.mail",
  billing: "settings.billing.title",
  account: "settings.account.title",
});

/** Which tab a pathname is on, or `undefined` for a path under
 *  `/app/settings` that is none of the seven. Business is matched
 *  **exactly** and never by prefix, because its address `/app/settings` is
 *  the prefix of all six others — the same rule, and the same reason, as
 *  `tabOf`'s and `destinationOf`'s. */
export function settingsTabOf(pathname: string): SettingsTab | undefined {
  return SETTINGS_TABS.find((tab) => pathname === SETTINGS_TAB_HREF[tab]);
}
