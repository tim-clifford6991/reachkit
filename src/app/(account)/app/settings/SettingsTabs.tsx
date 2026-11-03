// SPEC §4, owner R7: the three tabs, drawn once for all three routes.
// Links, not a widget, so the browser's back button moves between them; `aria-current` marks the one open.
// The bar sticks directly under the top bar (SPEC §4, 2026-10-08, #1339). Below `sm` the three are 44px boxes in one row,
// so all are on screen; from `sm` up they are one row that scrolls sideways rather than widen the screen (#1101).
// Where the row scrolls, the current tab is brought into view on mount, and again once the web font is in,
// because the faces load with `display: swap` and the row is measured in the fallback face first (#976).
"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { copy } from "@/lib/presentation/copy";
import { UNDER_TOP_BAR } from "../_shell/bar";
import {
  SETTINGS_TABS,
  SETTINGS_TAB_COPY_KEY,
  SETTINGS_TAB_HREF,
  settingsTabOf,
} from "./tabs";

export function SettingsTabs(): React.JSX.Element {
  const current = settingsTabOf(usePathname());
  const here = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    const tab = here.current;
    if (tab === null) return;
    const bring = (): void =>
      tab.scrollIntoView({ inline: "center", block: "nearest", behavior: "instant" });
    bring();
    // `in`: jsdom has no `document.fonts`.
    if ("fonts" in document) void document.fonts.ready.then(bring);
  }, [current]);

  return (
    <nav
      className={`min-w-0 sm:overflow-x-auto ${UNDER_TOP_BAR}`}
      aria-label={copy("settings.tabs.label")}
      data-testid="settings-tabs"
    >
      <div className="tabs tabs-border flex-nowrap max-sm:gap-2 sm:w-max">
        {SETTINGS_TABS.map((tab) => {
          const onThisTab = tab === current;
          return (
            <Link
              key={tab}
              ref={onThisTab ? here : undefined}
              href={SETTINGS_TAB_HREF[tab]}
              // Prefetched tab renders at once starve the database; a tab renders when it is opened.
              prefetch={false}
              className={`tab sm:whitespace-nowrap max-sm:h-11 max-sm:min-w-0 max-sm:flex-1 max-sm:leading-tight max-sm:justify-start max-sm:rounded-field max-sm:border max-sm:border-base-300 max-sm:bg-base-100 max-sm:px-3 max-sm:py-1 max-sm:text-left max-sm:before:hidden ${
                onThisTab ? "tab-active text-primary max-sm:border-primary/30 max-sm:bg-primary/10" : ""
              }`}
              data-testid={`settings-tab-${tab}`}
              aria-current={onThisTab ? "page" : undefined}
            >
              {copy(SETTINGS_TAB_COPY_KEY[tab])}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
