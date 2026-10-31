// SPEC §4 (2026-09-20, #908) — Settings › **Your business**, at
// `/app/settings`.
//
// The first of the seven tabs, and the address the menu's *Settings* has
// always pointed at — so nothing in the product has to learn a new link for
// the screen to become seven (`./tabs.ts`).
//
// **What stands here**, in board SettingsIndex's order: how the tab shapes a
// page, the business profile with a sentence it shaped on a live page, then
// three folds (what buyers ask, the facts we may quote, what the writer
// already knows about). The closed list of what a page is written from
// (SPEC §7, 2026-10-10, #1393) is the last card: no Settings card sits beside
// another (E38).
//
// This file is the composition and nothing else. It makes the tab's reads,
// each settling on its own, and hands each card the slice it states —
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
import { readShell } from "../_shell/provider";
import { requireSetUpAccount } from "../_session/account";
import { readBusiness } from "./business-provider";
import { landed, Unread } from "./Unread";
import { BusinessPanel } from "./panels/BusinessPanel";
import { FactsPanel } from "./panels/FactsPanel";
import { FlowPanel } from "./panels/FlowPanel";
import { KnowledgePanel } from "./panels/KnowledgePanel";
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
  // `readBusiness` is this tab's alone — the site profile, the market
  // reading, the customer's corrections and the grounding passages, which no
  // other tab draws and none should pay for (`./business-provider.ts`). The
  // zone is the session's own, so this tab needs no settings read.
  const [account, business, shell] = await Promise.all([requireSetUpAccount(), landed(readBusiness(), "business"), landed(readShell(), "shell")]);
  const timeZone = account.timeZone;
  if (business === null) {
    return (
      <div className="flex min-w-0 flex-col gap-6" data-testid="settings-tab-panel-business">
        <Unread testId="settings-unread-business" />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="settings-tab-panel-business">
      {shell === null ? (
        <Unread testId="settings-unread-flow" />
      ) : (
        <FlowPanel
          pagesRead={business.profile.pagesRead}
          readAt={business.profile.readAt}
          next={shell.publishing.next}
          timeZone={timeZone}
        />
      )}
      <BusinessPanel
        profile={business.profile}
        siteName={business.siteName}
        empty={profileIsEmpty(business.profile)}
        example={business.onAPage}
        timeZone={timeZone}
      />
      <section className="flex min-w-0 flex-col gap-3" aria-label={copy("settings.business.more")}>
        <KnowledgePanel knowledge={business.knowledge} answers={business.answers} />
        <FactsPanel facts={business.facts} />
        <KnownContentPanel known={business.known} />
      </section>
      <WrittenFromPanel profile={business.profile} />
    </div>
  );
}
