// SPEC §4 (2026-09-20, #908) — the seven tabs, drawn once for all seven
// routes.
//
// daisyUI `tabs tabs-border` with links rather than a widget: each tab is
// its own address, so navigation works with no client runtime and the
// browser's own back button moves between them. `aria-current="page"` marks
// the one the customer is on, which is what a screen reader reads and what
// `tab-active` paints.
//
// It is a client component for one reason only, the same one `OverviewTabs`
// and `SidebarNav` give: reading the pathname that marks the current tab.
// Nothing else here is interactive.
//
// **It cannot overflow.** Seven words is more than a 390px screen holds, so
// the row scrolls sideways (`overflow-x-auto` on a `min-w-0` parent, the bar
// itself `w-max flex-nowrap`) rather than pushing the screen wider —
// `docs/DESIGN.md`'s no-overflow rule, where a label that cannot be clamped
// is a nav word. That is the same construction `OverviewTabs` is proven at,
// and the reason this file repeats it rather than sharing it: one is four
// words about the Overview and one is seven about Settings, and a shared
// bar would need the tuple, the two maps and the current-tab rule passed
// into it — which is the whole of both files.
"use client";

import type React from "react";
import { usePathname } from "next/navigation";
import { copy } from "@/lib/presentation/copy";
import {
  SETTINGS_TABS,
  SETTINGS_TAB_COPY_KEY,
  SETTINGS_TAB_HREF,
  settingsTabOf,
} from "./tabs";

export function SettingsTabs(): React.JSX.Element {
  const current = settingsTabOf(usePathname());

  return (
    <nav
      className="min-w-0 overflow-x-auto"
      aria-label={copy("settings.tabs.label")}
      data-testid="settings-tabs"
    >
      <div className="tabs tabs-border w-max flex-nowrap">
        {SETTINGS_TABS.map((tab) => {
          const here = tab === current;
          return (
            <a
              key={tab}
              href={SETTINGS_TAB_HREF[tab]}
              className={`tab whitespace-nowrap ${here ? "tab-active" : ""}`}
              data-testid={`settings-tab-${tab}`}
              aria-current={here ? "page" : undefined}
            >
              {copy(SETTINGS_TAB_COPY_KEY[tab])}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
