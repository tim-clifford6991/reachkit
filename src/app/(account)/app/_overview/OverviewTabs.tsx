// SPEC §4 (2026-09-20, #908) — the four tabs, drawn once for all four routes.
//
// daisyUI `tabs tabs-border` with `role="tablist"` off it: these are links,
// not a widget — each tab is its own address, so navigation works with no
// client runtime and the browser's own back button moves between them.
// `aria-current="page"` marks the one the customer is on, which is what a
// screen reader reads and what `tab-active` paints.
//
// It is a client component for one reason only, the same one `SidebarNav`
// gives: reading the pathname that marks the current tab. Nothing else here
// is interactive.
//
// **It cannot overflow.** The row scrolls sideways below the width its four
// words need (`overflow-x-auto` on a `min-w-0` parent) rather than pushing
// the screen wider — docs/DESIGN.md's no-overflow rule, where a label that
// cannot be clamped is a nav word.
"use client";

import type React from "react";
import { usePathname } from "next/navigation";
import { copy } from "@/lib/presentation/copy";
import { UNDER_TOP_BAR } from "../_shell/bar";
import { OVERVIEW_TABS, TAB_COPY_KEY, TAB_HREF, tabOf } from "./tabs";

export function OverviewTabs(): React.JSX.Element {
  const current = tabOf(usePathname());

  return (
    <nav
      className={`min-w-0 overflow-x-auto ${UNDER_TOP_BAR}`}
      aria-label={copy("overview.tabs.label")}
      data-testid="overview-tabs"
    >
      <div className="tabs tabs-border w-max flex-nowrap">
        {OVERVIEW_TABS.map((tab) => {
          const here = tab === current;
          return (
            <a
              key={tab}
              href={TAB_HREF[tab]}
              className={`tab whitespace-nowrap ${here ? "tab-active" : ""}`}
              data-testid={`overview-tab-${tab}`}
              aria-current={here ? "page" : undefined}
            >
              {copy(TAB_COPY_KEY[tab])}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
