// SPEC §4 (2026-09-20, #908) — the seven tabs, drawn once for all seven
// routes.
//
// daisyUI `tabs tabs-border` with links rather than a widget: each tab is
// its own address, so the browser's own back button moves between them.
// Each is a `next/link` with `prefetch` (SPEC §4, 2026-10-08, issue 1341):
// the tab is loaded before the tap, and `settings/layout.tsx` — this bar
// included — stays mounted across the change. `aria-current="page"` marks
// the one the customer is on, which is what a screen reader reads and what
// `tab-active` paints.
//
// It is a client component for two reasons, and no more than two: reading
// the pathname that marks the current tab — the one `OverviewTabs` and
// `SidebarNav` give — and bringing that tab into view, below.
//
// **It cannot overflow, and below `sm` it does not scroll either** (#1101).
// Seven words is 626px of tabs; a 390px screen's row is 358px. A sideways
// scroll kept the screen from widening, but on a phone it hid four of the
// seven tabs with nothing to say they were there. So below `sm` the bar
// wraps (`flex-wrap`): every tab is on screen, the current one keeps
// daisyUI's `tab-active` underline, and each link is `h-11` — the 44px
// target a thumb needs, above daisyUI's 40px tab. The links stay links, so
// no string and no widget is added for the phone.
//
// From `sm` up the strip is what it was: one row that scrolls sideways
// (`overflow-x-auto` on a `min-w-0` parent, the bar itself `w-max
// flex-nowrap`) rather than pushing the screen wider — `docs/DESIGN.md`'s
// no-overflow rule, where a label that cannot be clamped is a nav word. That
// is the same construction `OverviewTabs` is proven at.
//
// **Where the row does scroll, it opens at its start** (owner, 2026-09-21,
// on #925), which can leave the marked tab past the edge. So the current
// link is scrolled into view once, on mount. `inline: "center"` puts it in
// the middle of the row rather than flush against an edge; `block:
// "nearest"` is what keeps this a *horizontal* move — without it the
// browser is entitled to scroll the document vertically to reach the bar.
// Below `sm` there is no scroll container and every tab is already in
// view, so the same call moves nothing.
//
// It runs once per address: the effect's one dependency is the current tab,
// and a tab press is a navigation, so nothing here fights a customer who
// has scrolled the row themselves.
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
      className={`min-w-0 sm:overflow-x-auto ${UNDER_TOP_BAR}`}
      aria-label={copy("settings.tabs.label")}
      data-testid="settings-tabs"
    >
      <div className="tabs tabs-border max-sm:flex-wrap sm:w-max sm:flex-nowrap">
        {SETTINGS_TABS.map((tab) => {
          const onThisTab = tab === current;
          return (
            <Link
              key={tab}
              ref={onThisTab ? here : undefined}
              href={SETTINGS_TAB_HREF[tab]}
              prefetch={true}
              className={`tab whitespace-nowrap max-sm:h-11 ${onThisTab ? "tab-active" : ""}`}
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
