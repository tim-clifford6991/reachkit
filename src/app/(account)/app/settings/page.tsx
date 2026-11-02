// SPEC §4 (2026-09-20, #908) — Settings › **Your business**, at
// `/app/settings`.
//
// The first of the seven tabs, and the address the menu's *Settings* has
// always pointed at — so nothing in the product has to learn a new link for
// the screen to become seven (`./tabs.ts`).
//
// **What stands here**, in board SettingsIndex's order (canvas v36): what we read of the business, then
// three folds (what buyers ask, the facts we may quote, what the writer already knows about).
//
// This file is the composition and nothing else. It makes the tab's reads,
// each settling on its own, and hands each card the slice it states —
// ARCHITECTURE rule 1: "Route handlers and server components are thin
// adapters over a module's exported interface."
//
// **It ships no stylesheet and declares no `Surface`.** The heading and the
// tab bar are `./layout.tsx`'s, drawn once for all
// seven; every rule this tab needs is a stock daisyUI class or one of the
// type roles `src/ui/type.css` registers.
import type React from "react";
import { Suspense } from "react";
import type { Metadata } from "next";
import { copy } from "@/lib/presentation/copy";
import { profileIsEmpty } from "@/lib/site-profile/business/confirm";
import { requireSetUpAccount } from "../_session/account";
import { readUnderstanding } from "../_overview/understanding-provider";
import { CardSkeleton } from "../_shell/skeletons";
import { readBusiness, readBusinessQuotable } from "./business-provider";
import { landed, Unread } from "./Unread";
import { BusinessPanel } from "./panels/BusinessPanel";
import { FactsPanel } from "./panels/FactsPanel";
import { KnowledgePanel } from "./panels/KnowledgePanel";
import { KnownContentPanel } from "./panels/KnownContentPanel";

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
  // `readBusiness` is this tab's alone (`./business-provider.ts`); the passages are `Facts`'s own read.
  // The kind is the market conclusion's closed word, as the free report says it (REVIEW4 §2).
  const [account, business, understanding] = await Promise.all([
    requireSetUpAccount(),
    landed(readBusiness(), "business"),
    landed(readUnderstanding(), "understanding"),
  ]);
  const kind = understanding?.kind == null ? null : copy(`report.read.as.kind.${understanding.kind}`);
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
      <BusinessPanel
        profile={business.profile}
        kind={kind}
        empty={profileIsEmpty(business.profile)}
        timeZone={timeZone}
      />
      <section className="flex min-w-0 flex-col gap-3" aria-label={copy("settings.business.more")}>
        <KnowledgePanel knowledge={business.knowledge} answers={business.answers} />
        <Suspense fallback={<CardSkeleton testId="settings-business-facts-skeleton" rows={0} />}>
          <Facts />
        </Suspense>
        <KnownContentPanel known={business.known} />
      </section>
    </div>
  );
}

/** The facts card, which parses every measured page: when it fails or stalls, only this card says so. */
async function Facts(): Promise<React.JSX.Element> {
  const facts = await landed(readBusinessQuotable(), "businessFacts");
  return facts === null ? <Unread testId="settings-unread-facts" /> : <FactsPanel facts={facts} />;
}
