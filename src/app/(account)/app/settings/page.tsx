// BUILD §4.7 — Settings, at `/app/settings`.
//
// §4.7 in full: "Two-column cards. Left: **Your market** … **Competitors** …
// **Publishing** … **Notifications**. Right: **Billing** … **Account** …
// **Your content** … **Danger zone**."
//
// Since #374 the left column has a fifth card between Publishing and
// Notifications — "How your pages sound", the approved S18's own — and the
// two settings on it came off "Your content" on the right. §4.7 names eight
// cards and the approved set draws nine; UI-SPEC's own precedence applies
// ("where this document and BUILD.md §4 differ, this document wins until
// the §4 amendment lands"). No setting is added or dropped by the move:
// `SETTABLE` is unchanged, and `screen.test.tsx` reads every rendered
// `setting-<key>` off the document and asserts the set against it.
//
// This file is the composition and nothing else. It makes one read
// (`readSettings`, request-cached), hands each card the slice it states, and
// holds no engine logic — ARCHITECTURE rule 1: "Route handlers and server
// components are thin adapters over a module's exported interface."
//
// The order of the eight cards is §4.7's order, and the two columns are §4.7's
// two. **This screen ships no stylesheet.** `BUILD.md` §2.2 closes custom CSS
// at five surfaces — "the calendar grid, the day panel, the AI dot-matrix,
// chart SVGs, and the sidebar — nothing else" — and Settings is on none of
// them, so every rule this screen needs is a stock Tailwind utility or one of
// the two type roles `src/ui/type.css` already registers (`.eyebrow` for §2.3's
// uppercase 11px section labels, `.num` for its numerals). §2.1 is explicit
// that this is how it is meant to work: the tokens are mapped onto daisyUI's
// theme slots "so stock daisyUI classes just work", and the one theme block in
// `src/ui/tailwind.css` is where they are mapped and what makes them emit.
//
// The column switch is `xl:`, which Tailwind sets at 80rem = 1280px =
// `BAND_MIN.wide` = `--breakpoint-xl` (pinned by
// `tests/ui/settings-columns.test.ts`). Not `lg:`: at 1024 the sidebar has
// already taken 222px and its padding, so two card columns there would be
// narrower than the compact band this screen is proven at, and ADR-093's law is
// that content fits its box or the box changes.
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
import { VoicePanel } from "./panels/VoicePanel";
import { NotificationsPanel } from "./panels/NotificationsPanel";
import { BillingPanel } from "./panels/BillingPanel";
import { AccountPanel } from "./panels/AccountPanel";
import { ContentPanel } from "./panels/ContentPanel";
import { DangerZone } from "./panels/DangerZone";

export default async function SettingsPage(): Promise<React.JSX.Element> {
  const settings = await readSettings();
  const head = writtenLine("settings.head");

  return (
    <div className="flex flex-col gap-4" data-testid="settings">
      <h1>{copy("shell.nav.settings")}</h1>
      {head === null ? null : <p>{head}</p>}

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4" data-testid="settings-left">
          <MarketPanel
            market={settings.market}
            domain={settings.domain}
            timeZone={settings.publishing.timeZone}
          />
          <CompetitorsPanel competitors={settings.competitors} />
          <PublishingPanel settings={settings} />
          <VoicePanel settings={settings} />
          <NotificationsPanel settings={settings} />
        </div>

        <div className="flex min-w-0 flex-col gap-4" data-testid="settings-right">
          <BillingPanel billing={settings.billing} />
          <AccountPanel account={settings.account} />
          <ContentPanel settings={settings} />
          <DangerZone />
        </div>
      </div>
    </div>
  );
}
