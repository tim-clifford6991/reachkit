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
import { readSettings } from "../provider";
import { MarketPanel } from "../panels/MarketPanel";
import { CompetitorsPanel } from "../panels/CompetitorsPanel";

export default async function SettingsMarketTab(): Promise<React.JSX.Element> {
  const settings = await readSettings();

  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="settings-tab-panel-market">
      <MarketPanel
        market={settings.market}
        domain={settings.domain}
        timeZone={settings.publishing.timeZone}
      />
      <CompetitorsPanel competitors={settings.competitors} />
    </div>
  );
}
