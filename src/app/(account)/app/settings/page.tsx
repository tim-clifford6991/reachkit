// SPEC §4 (2026-09-20, #908) — Settings › **Your business**, at
// `/app/settings`.
//
// The first of the seven tabs, and the address the menu's *Settings* has
// always pointed at — so nothing in the product has to learn a new link for
// the screen to become seven (`./tabs.ts`).
//
// **What stands here is "Your content", moved as it is.** #925's Build:
// "The existing panels move as they are." The redesign's Business tab ends
// with what ReachKit already knows about the site — the pages it wrote, the
// posts on the customer's WordPress, the pages on their main site — which
// is exactly what `ContentPanel` states, so that card is this tab's. The
// rest of that tab in the canvas is the business profile the site read
// writes, and that is §7's own work and not this issue's: nothing is
// invented here to fill the space.
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
import { readSettings } from "./provider";
import { ContentPanel } from "./panels/ContentPanel";

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
  const settings = await readSettings();

  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="settings-tab-panel-business">
      <ContentPanel settings={settings} />
    </div>
  );
}
