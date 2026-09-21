// SPEC §4 (2026-09-20, #908) — the seven tabs, drawn once for all seven
// routes.
//
// daisyUI `tabs tabs-border` with links rather than a widget: each tab is
// its own address, so navigation works with no client runtime and the
// browser's own back button moves between them. `aria-current="page"` marks
// the one the customer is on, which is what a screen reader reads and what
// `tab-active` paints.
//
// It is a client component for two reasons, and no more than two: reading
// the pathname that marks the current tab — the one `OverviewTabs` and
// `SidebarNav` give — and bringing that tab into view, below.
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
//
// **A scroll container opens at its start, which put the current tab off
// the edge** (owner, 2026-09-21, on #925). Four of the seven words fit a
// 390px screen; on Mail, Billing and Account the marked tab was past the
// right edge, so the one thing the bar exists to say — which tab you are on
// — was the one thing a phone could not see. `aria-current` was set and
// `tab-active` was painted; neither is visible if it is not on screen.
//
// So the current link is scrolled into view once, on mount. `inline:
// "center"` puts it in the middle of the row rather than flush against an
// edge, where the tabs either side of it are the affordance that says the
// row scrolls at all; `block: "nearest"` is what keeps this a *horizontal*
// move — without it the browser is entitled to scroll the document
// vertically to reach the bar, which on a short screen would open Settings
// with its own heading pushed off the top. No animation is asked for, so
// the browser's default (`auto`) applies and the row is simply already
// where it should be when the screen is first painted.
//
// It runs once per address: the effect's one dependency is the current tab,
// and a tab press is a navigation, so nothing here fights a customer who
// has scrolled the row themselves.
"use client";

import React, { useEffect, useRef } from "react";
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
  const here = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    const tab = here.current;
    if (tab === null) return;
    const bring = (): void =>
      tab.scrollIntoView({ inline: "center", block: "nearest", behavior: "instant" });
    bring();
    // And again once the web font is in. The faces load with
    // `display: swap` and no metric adjustment (`src/ui/fonts.ts`), so the
    // row is measured in the fallback face first and in the real one a
    // moment later — and seven words that fit a 390px screen in one do not
    // fit it in the other. Whichever way that race falls, the row is
    // scrollable by the time it is read and the current tab was brought
    // into view before it was: on the first run in a real browser Voice
    // stood 72px past the right edge at `scrollLeft: 0` (#976). The promise
    // is already resolved when the font was cached, so this costs a
    // microtask and no second scroll. (`in`, because a DOM with no font
    // loading — jsdom's — has no `fonts` at all and this file is a client
    // component any suite may render.)
    if ("fonts" in document) void document.fonts.ready.then(bring);
  }, [current]);

  return (
    <nav
      className="min-w-0 overflow-x-auto"
      aria-label={copy("settings.tabs.label")}
      data-testid="settings-tabs"
    >
      <div className="tabs tabs-border w-max flex-nowrap">
        {SETTINGS_TABS.map((tab) => {
          const onThisTab = tab === current;
          return (
            <a
              key={tab}
              ref={onThisTab ? here : undefined}
              href={SETTINGS_TAB_HREF[tab]}
              className={`tab whitespace-nowrap ${onThisTab ? "tab-active" : ""}`}
              data-testid={`settings-tab-${tab}`}
              aria-current={onThisTab ? "page" : undefined}
            >
              {copy(SETTINGS_TAB_COPY_KEY[tab])}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
