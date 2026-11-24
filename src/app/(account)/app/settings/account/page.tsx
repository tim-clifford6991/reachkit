// `docs/SPEC.md §4 Settings has three tabs`: Settings › Account, at `/app/settings/account`, plate F3: billing and
// the month it paid for on the left from `lg`, the account and the danger zone on the right. Billing is the one read
// awaited before the first flush, so cancelling never waits on another; every other card is its own boundary.
import type React from "react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { copy } from "@/lib/presentation/copy";
import { readBillingSummary, readMonthGot, readSettings } from "../provider";
import { readsLanded } from "../model";
import { ANCHORED, SETTINGS_ANCHOR } from "../tabs";
import { CARD_COLUMN, CARD_GRID } from "../frame";
import { recorded } from "@/lib/ops/events";
import { Part } from "../../_shell/Part";
import { readShell } from "../../_shell/provider";
import { CardSkeleton } from "../../_shell/skeletons";
import { planToday, readWeek } from "../../calendar/provider";
import { nextPageOf } from "../next-page";
import { AccountPanel } from "../panels/AccountPanel";
import { BillingPanel } from "../panels/BillingPanel";
import { DangerZone } from "../panels/DangerZone";
import { MonthPanel } from "../panels/MonthPanel";

export const metadata: Metadata = { title: copy("meta.app.settings.account.title") };

export default async function SettingsAccountTab(): Promise<React.JSX.Element> {
  const billing = await readBillingSummary();
  return (
    <div className={CARD_GRID} data-testid="settings-tab-panel-account">
      <div id={SETTINGS_ANCHOR.billing} className={ANCHORED}>
        <div className={CARD_COLUMN}>
          <BillingPanel billing={billing} />
          <Part testId="settings-month-failed">
            <Suspense fallback={<CardSkeleton testId="billing-month-skeleton" rows={3} />}>
              <Month />
            </Suspense>
          </Part>
        </div>
      </div>
      <div className={CARD_COLUMN}>
        <Part testId="settings-account-failed">
          <Suspense fallback={<CardSkeleton testId="settings-account-skeleton" />}>
            <Account />
          </Suspense>
        </Part>
        <DangerZone />
      </div>
    </div>
  );
}

async function Month(): Promise<React.JSX.Element> {
  const today = recorded(planToday(), "today");
  // This week's pages still to go live, as Plan shows them; unread is never zero.
  const weekRead = today.then((day) => recorded(readWeek(day), "week")).catch(() => null);
  const [month, shell, week] = await Promise.all([recorded(readMonthGot(), "month"), recorded(readShell(), "shell"), weekRead, today]);
  const planned = week?.cells.flatMap((cell) => (cell.page !== null && cell.page.stage !== "live" ? [cell.day] : [])) ?? null;
  return (
    <MonthPanel
      got={month.got}
      context={{
        timeZone: month.timeZone,
        price: copy("price.amount"),
        planned,
        // `live` does not depend on the stop window, so no settings read is needed.
        first: nextPageOf(shell, 0).live,
      }}
    />
  );
}

async function Account(): Promise<React.JSX.Element> {
  // The shortcuts need the shell's blog; without it the card still stands, with Help and no blog link.
  const [all, shell] = await Promise.all([recorded(readSettings(), "settings"), recorded(readShell(), "shell").catch(() => null)]);
  const settings = readsLanded(all, "card", "pages");
  return <AccountPanel account={settings.account} pages={settings.content.pages} blog={shell?.blog ?? null} />;
}
