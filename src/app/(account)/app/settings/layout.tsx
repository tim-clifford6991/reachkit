// SPEC §4 (2026-09-20, #908) — Settings' own sub-layout: the seven tabs.
//
// "Settings is tabs: Your business, Market and rivals, Publishing, Your
// voice, Mail, Billing, Account." The heading, the screen's one written line
// and the bar are drawn once, here, so the seven routes cannot disagree
// about which tabs exist, what they are called or which one is current —
// the same argument `(tabs)/layout.tsx` makes for the Overview's four and
// `_shell/destinations.ts` for the three menu items one level up.
//
// **Not a route group, because Settings is a place.** The Overview's tabs
// sit in `(tabs)` so that Overview keeps the bare `/app` address; here the
// tabs *are* the sub-paths of `/app/settings`, so the ordinary directory
// nesting is what the addresses want and `destinationOf`'s prefix match
// keeps *Settings* marked in the side panel on all seven.
//
// **It declares no `Surface`.** The shell's own layout (`../layout.tsx`)
// owns this route's screen root — exactly one `[data-surface]` per document.
//
// **It makes no read.** Each tab reads what it draws; this frame draws the
// heading and the bar, which need nothing of the account. `readSettings` is
// request-cached, so the tab below doing its own read costs one read per
// request whichever tab it is.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { writtenLine } from "../_shell/written";
import { SettingsTabs } from "./SettingsTabs";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const head = writtenLine("settings.head");

  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="settings">
      <h1>{copy("shell.nav.settings")}</h1>
      {head === null ? null : <p>{head}</p>}
      <SettingsTabs />
      {children}
    </div>
  );
}
