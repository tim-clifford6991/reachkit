// Canvas: Settings — `/app/settings`, the artboard's sections down one
// column: the account, where pages go, how they sound, what is mailed, then
// the cards the artboard does not draw, and the danger zone last.
//
// One read (`readSettings`, request-cached), each card handed the slice it
// states. This file holds no engine logic and declares no `Surface`: the
// shell's layout owns this route's screen root.
//
// It offers exactly the fourteen settings and the seven actions. Every
// control carries `data-testid="setting-<key>"` and every action
// `action-<key>`, and `tests/app/settings/screen.test.tsx` reads both sets
// off the document and asserts them against `SETTABLE` and `ACTIONS`.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { writtenLine } from "../_shell/written";
import { readSettings } from "./provider";
import { AccountPanel } from "./panels/AccountPanel";
import { DestinationsPanel } from "./panels/DestinationsPanel";
import { PublishingPanel } from "./panels/PublishingPanel";
import { VoicePanel } from "./panels/VoicePanel";
import { NotificationsPanel } from "./panels/NotificationsPanel";
import { MarketPanel } from "./panels/MarketPanel";
import { CompetitorsPanel } from "./panels/CompetitorsPanel";
import { ContentPanel } from "./panels/ContentPanel";
import { DangerZone } from "./panels/DangerZone";
import { HEAD, QUIET, SCREEN } from "./style";

export default async function SettingsPage(): Promise<React.JSX.Element> {
  const settings = await readSettings();
  const head = writtenLine("settings.head");

  return (
    <div className={SCREEN} data-testid="settings">
      <div className={HEAD}>
        <h1>{copy("shell.nav.settings")}</h1>
        {head === null ? null : <p className={QUIET}>{head}</p>}
      </div>

      <AccountPanel account={settings.account} billing={settings.billing} />
      <DestinationsPanel settings={settings} />
      <PublishingPanel settings={settings} />
      <VoicePanel settings={settings} />
      <NotificationsPanel settings={settings} />
      <MarketPanel
        market={settings.market}
        domain={settings.domain}
        timeZone={settings.publishing.timeZone}
      />
      <CompetitorsPanel competitors={settings.competitors} />
      <ContentPanel settings={settings} />
      <DangerZone />
    </div>
  );
}
