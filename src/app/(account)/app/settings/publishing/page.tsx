// SPEC §4 (2026-09-20, #908) — Settings › **Publishing**, at
// `/app/settings/publishing`.
//
// One card, moved as it is: where pages go, when they go, how long the
// customer has to stop one, and whether publishing is on at all. The tab
// takes the card's own word — `settings.publishing.title` is "Publishing",
// which §4.7 prints and the product already speaks, so no second spelling
// is minted for the bar (`./tabs.ts`).
import type React from "react";
import { readSettings } from "../provider";
import { PublishingPanel } from "../panels/PublishingPanel";

export default async function SettingsPublishingTab(): Promise<React.JSX.Element> {
  const settings = await readSettings();

  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="settings-tab-panel-publishing">
      <PublishingPanel settings={settings} />
    </div>
  );
}
