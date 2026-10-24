// SPEC §4 (2026-09-20, #908) — Settings › **Market and competitors**, at
// `/app/settings/market`, in board SettingsMarket's order: what is measured,
// then who it is measured against.
//
// Every figure is stored: the competitor and "You" figures come from the
// Competitors tab's own readers (`readRivals`, the month's reputation through
// `namedOf`, the gap module's leaders), so the two screens cannot disagree.
import type React from "react";
import type { Metadata } from "next";
import { copy } from "@/lib/presentation/copy";
import { readSettings } from "../provider";
import { MarketPanel } from "../panels/MarketPanel";
import { CompetitorsPanel } from "../panels/CompetitorsPanel";
import { marketFigures } from "../market-figures";
import { readUnderstanding } from "../../_overview/understanding-provider";
import { readOverview } from "../../_overview/provider";
import { readPromptsAt } from "../../_overview/prompts-provider";
import { readRivals } from "../../_overview/rivals-provider";
import { namedOf } from "../../_overview/rivals-model";
import { aiSearchesOf } from "../../_overview/prompts-model";
import { formatDay } from "../../_shell/format";
import { AlsoServesNote } from "@/app/_business/WhatWeRead";

/** This tab's own `<title>` (#945, #925). */
export const metadata: Metadata = { title: copy("meta.app.settings.market.title") };

export default async function SettingsMarketTab(): Promise<React.JSX.Element> {
  const [settings, understanding, rivals, overview] = await Promise.all([
    readSettings(),
    readUnderstanding(),
    readRivals(),
    readOverview(),
  ]);
  const reputation = await readPromptsAt(overview.months?.reading?.week ?? null);
  const timeZone = settings.publishing.timeZone;
  const searches = rivals.firstPage.of === 0 ? null : rivals.firstPage.of;
  const questions = reputation.kind === "measured" ? aiSearchesOf(reputation.prompts).asked.length : null;

  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="settings-tab-panel-market">
      <MarketPanel
        market={settings.market}
        concluded={settings.concluded}
        domain={settings.domain}
        locale={settings.locale}
        timeZone={timeZone}
        sets={{ searches, questions, competitors: settings.competitors.length }}
      />
      <AlsoServesNote n={understanding.where.alsoServes} />
      <CompetitorsPanel
        competitors={settings.competitors}
        concluded={settings.concluded}
        figures={marketFigures({
          competitors: settings.competitors,
          measured: settings.measuredRivals,
          firstPage: rivals.firstPage,
          named: namedOf(reputation),
        })}
        measuredFrom={settings.market.wouldTakeEffectOn}
        ownDomain={settings.domain}
        leaders={overview.rivals.leaders.domains}
        detail={{
          googleOn: rivals.measuredAt === null ? null : formatDay(rivals.measuredAt, timeZone),
          searches,
          questions,
        }}
      />
    </div>
  );
}
