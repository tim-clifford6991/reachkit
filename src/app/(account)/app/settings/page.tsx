// SPEC §4 (2026-09-20, #908) — Settings › **Your business**, at
// `/app/settings`.
//
// The first of the seven tabs, and the address the menu's *Settings* has
// always pointed at — so nothing in the product has to learn a new link for
// the screen to become seven (`./tabs.ts`).
//
// **What stands here.** #925 put "Your content" on this tab — the pages
// ReachKit wrote, the posts on the WordPress, the pages on the main site,
// which is what the redesign's Business artboard ends with. #926 adds what
// it *begins* with: the business profile the site read writes, every item
// correctable, the facts we may quote, and the closed list of what a page is
// written from. The profile stands above Your content, because it is what
// the tab is named for.
//
// Two columns above the large breakpoint and one below it: the profile and
// its facts are the reading, and *What every page is written from* is the
// note beside them. One column on a phone, in that order, so the reading
// comes first (`docs/DESIGN.md`'s no-overflow rule decides the switch, and
// `xl:` is where the sidebar has already taken its width).
//
// This file is the composition and nothing else. It makes one read
// (`readSettings`, request-cached) and hands the card the slice it states —
// ARCHITECTURE rule 1: "Route handlers and server components are thin
// adapters over a module's exported interface."
//
// **It ships no stylesheet and declares no `Surface`.** The heading, the
// written line and the tab bar are `./layout.tsx`'s, drawn once for all
// seven; every rule this tab needs is a stock daisyUI class or one of the
// type roles `src/ui/type.css` registers.
import type React from "react";
import type { Metadata } from "next";
import { copy } from "@/lib/presentation/copy";
import { profileIsEmpty } from "@/lib/site-profile/business/confirm";
import { readSettings } from "./provider";
import { readBusiness } from "./business-provider";
import { ContentPanel } from "./panels/ContentPanel";
import { BusinessPanel } from "./panels/BusinessPanel";
import { FactsPanel } from "./panels/FactsPanel";
import { KnownContentPanel } from "./panels/KnownContentPanel";
import { WrittenFromPanel } from "./panels/WrittenFromPanel";

/** /app/settings's own `<title>` (#945). Without it this screen announced
 *  nothing at all — the `(account)` layout's fallback is the floor, not
 *  the name of this screen.
 *
 *  **This address keeps "Settings — ReachKit"** though it is now the first
 *  of seven tabs: it *is* the address Settings, the one the menu points at,
 *  so that is the screen a reader holding twenty tabs is on. The six
 *  siblings name themselves inside it — "Billing — Settings — ReachKit" —
 *  which is what `tests/app/seo/account-title.test.ts` asks of every named
 *  screen and what its "no two screens announce the same thing" forbids
 *  solving by sharing one title. */
export const metadata: Metadata = { title: copy("meta.app.settings.title") };

export default async function SettingsBusinessTab(): Promise<React.JSX.Element> {
  // Two reads, and they are two on purpose: `readSettings` is the model all
  // seven tabs share, and `readBusiness` is this tab's alone — the site
  // profile, the market reading, the customer's corrections and the
  // grounding passages, which no other tab draws and none should pay for
  // (`./business-provider.ts`). Both are request-cached.
  const [settings, business] = await Promise.all([readSettings(), readBusiness()]);

  return (
    <div
      className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
      data-testid="settings-tab-panel-business"
    >
      <div className="flex min-w-0 flex-col gap-4">
        <BusinessPanel
          profile={business.profile}
          siteName={business.siteName}
          empty={profileIsEmpty(business.profile)}
        />
        <FactsPanel facts={business.facts} />
        {/* #928: what the writer already knows about — theirs as well as
            ours. It sits under the facts because both answer the same
            question a customer has about a page: where did this come from,
            and what was it checked against. */}
        <KnownContentPanel known={business.known} />
        <ContentPanel settings={settings} />
      </div>

      <WrittenFromPanel
        profile={business.profile}
        timeZone={settings.publishing.timeZone}
      />
    </div>
  );
}
