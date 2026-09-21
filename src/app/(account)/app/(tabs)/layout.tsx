// SPEC §4 (2026-09-20, #908) — Overview's own sub-layout: the four tabs.
//
// "Overview has four tabs, each its own address: **Overview, Search, AI
// answers, Rivals**." The bar is drawn once, here, so the four routes cannot
// disagree about which tabs exist, what they are called or which one is
// current — the same argument `_shell/destinations.ts` makes for the three
// menu items one level up.
//
// **It is a route group, so no address changes.** `(tabs)` contributes
// nothing to a URL: Overview is still `/app`, which is what "the Overview
// tab stays the landing screen after sign-in" requires, and the three tabs
// are its siblings. Calendar, Settings and the draft view sit outside this
// group and are untouched by it.
//
// **It declares no `Surface`.** The shell's own layout (`../layout.tsx`)
// owns this route's screen root — exactly one `[data-surface]` per document.
import type React from "react";
import { OverviewTabs } from "../_overview/OverviewTabs";

export default function OverviewTabsLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="overview-tab-frame">
      <OverviewTabs />
      {children}
    </div>
  );
}
