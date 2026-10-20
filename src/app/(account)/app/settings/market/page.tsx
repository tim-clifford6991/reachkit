// SPEC §4 (2026-09-20, #908) — Settings › **Market and rivals**, at
// `/app/settings/market`.
//
// Two cards, and the tab's name is the pair: the market ReachKit measures
// and writes for, and the rivals it is compared against every Monday. That
// is the grouping the redesign draws — "Your market" beside "Your rivals"
// on one tab — and both panels move as they are (#925's Build).
//
// The order is the canvas's: what is measured, then who it is measured
// against. `MarketPanel` needs the zone as well as the market, because the
// line it states about a pending change names a day in the customer's own
// zone.
import type React from "react";
import type { Metadata } from "next";
import { copy } from "@/lib/presentation/copy";
import { readSettings } from "../provider";
import { MarketPanel } from "../panels/MarketPanel";
import { CompetitorsPanel } from "../panels/CompetitorsPanel";
import { readDone } from "../../_overview/done-provider";
import { readUnderstanding } from "../../_overview/understanding-provider";
import { AlsoServesNote } from "@/app/_business/WhatWeRead";
import { ProcessTimeline } from "../../_shell/ProcessTimeline";

/** This tab's own `<title>` (#945, #925). Each sibling names itself
 *  inside Settings — `account-title.test.ts` forbids two screens
 *  announcing the same thing, so a shared title is not available and
 *  would not serve a reader anyway. */
export const metadata: Metadata = { title: copy("meta.app.settings.market.title") };

export default async function SettingsMarketTab(): Promise<React.JSX.Element> {
  const [settings, done, understanding] = await Promise.all([readSettings(), readDone(), readUnderstanding()]);

  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="settings-tab-panel-market">
      <MarketPanel
        market={settings.market}
        concluded={settings.concluded}
        domain={settings.domain}
        timeZone={settings.publishing.timeZone}
      />
      <AlsoServesNote n={understanding.where.alsoServes} />
      <CompetitorsPanel competitors={settings.competitors} concluded={settings.concluded} />
      {/* SPEC §4 (2026-10-10, issue 1395): the process, kept here after
          setup — each step with this site's own figure. */}
      <ProcessTimeline facts={done} timeZone={settings.publishing.timeZone} />
    </div>
  );
}
