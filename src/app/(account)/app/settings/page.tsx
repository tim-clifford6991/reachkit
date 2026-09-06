// BUILD §4.7 — Settings, at `/app/settings`.
//
// §4.7 in full: "Two-column cards. Left: **Your market** … **Competitors** …
// **Publishing** … **Notifications**. Right: **Billing** … **Account** …
// **Your content** … **Danger zone**."
//
// This file is the composition and nothing else. It makes one read
// (`readSettings`, request-cached), hands each card the slice it states, and
// holds no engine logic — ARCHITECTURE rule 1: "Route handlers and server
// components are thin adapters over a module's exported interface."
//
// The order of the eight cards is §4.7's order, and the two columns are §4.7's
// two. Which of the three bands actually draws two of them is
// `settings.css`'s: one column until `--breakpoint-xl`, two above it, because
// at the medium band the sidebar has already taken 222px and two card columns
// there would be narrower than the compact band this screen is proven at
// (ADR-093: content fits its box, or the box changes).
//
// **It declares no `Surface`**: the shell's layout owns this route's screen
// root (`../layout.tsx`), and a second one would be a second `[data-surface]`
// in the document.
//
// **It offers exactly the fourteen settings and the seven actions.** Every
// control carries the key it writes as `data-testid="setting-<key>"`, every
// action carries `data-testid="action-<key>"`, and
// `tests/app/settings/screen.test.tsx` reads both sets off the rendered
// document and asserts them against `SETTABLE` and `ACTIONS`. That is REQ-070
// criterion 3 made mechanical rather than reviewed: a control over a cost cap,
// a cadence, the question count, the locale, a row limit, a freshness window,
// a scoring weight or a model choice has no key it could carry, because
// `SETTABLE` is disjoint from the exported names of `constants.ts` — and a
// control hidden behind a flag or an "advanced" section fails the same
// assertion, since a hidden control is still an offered one.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { writtenLine } from "../_shell/written";
import { readSettings } from "./provider";
import { MarketPanel } from "./panels/MarketPanel";
import { CompetitorsPanel } from "./panels/CompetitorsPanel";
import { PublishingPanel } from "./panels/PublishingPanel";
import { NotificationsPanel } from "./panels/NotificationsPanel";
import { BillingPanel } from "./panels/BillingPanel";
import { AccountPanel } from "./panels/AccountPanel";
import { ContentPanel } from "./panels/ContentPanel";
import { DangerZone } from "./panels/DangerZone";
import "./settings.css";

export default async function SettingsPage(): Promise<React.JSX.Element> {
  const settings = await readSettings();
  const head = writtenLine("settings.head");

  return (
    <div className="rk-settings" data-testid="settings">
      <h1>{copy("shell.nav.settings")}</h1>
      {head === null ? null : <p>{head}</p>}

      <div className="rk-settings-cols">
        <div className="rk-settings-col" data-testid="settings-left">
          <MarketPanel settings={settings} />
          <CompetitorsPanel settings={settings} />
          <PublishingPanel settings={settings} />
          <NotificationsPanel settings={settings} />
        </div>

        <div className="rk-settings-col" data-testid="settings-right">
          <BillingPanel billing={settings.billing} />
          <AccountPanel account={settings.account} />
          <ContentPanel settings={settings} />
          <DangerZone />
        </div>
      </div>
    </div>
  );
}
