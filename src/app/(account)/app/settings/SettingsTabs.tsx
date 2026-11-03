// SPEC §4 (2026-09-20, #908): the seven tabs, drawn once for all seven routes.
// Links, not a widget, so the browser's back button moves between them; `aria-current` marks the one open.
// The bar sticks directly under the top bar (SPEC §4, 2026-10-08, #1339). Below `sm` it wraps into two 44px
// boxes a row (canvas v36), so all seven are on screen; from `sm` up they are one row that scrolls sideways rather than widen the screen (#1101).
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
      <div className="tabs tabs-border max-sm:flex-wrap max-sm:gap-2 sm:w-max sm:flex-nowrap">
        {SETTINGS_TABS.map((tab) => {
          const onThisTab = tab === current;
          return (
            <Link
              key={tab}
              ref={onThisTab ? here : undefined}
              href={SETTINGS_TAB_HREF[tab]}
              prefetch={true}
              className={`tab sm:whitespace-nowrap max-sm:h-11 max-sm:basis-[calc(50%-0.25rem)] max-sm:leading-tight max-sm:justify-start max-sm:rounded-field max-sm:border max-sm:border-base-300 max-sm:bg-base-100 max-sm:px-3 max-sm:py-1 max-sm:text-left max-sm:before:hidden ${
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
