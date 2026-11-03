// SPEC §4, owner R7 (docs/spec/decisions/2026-11-03-2127.md): Settings › Account, at `/app/settings/account`, in
// board SettingsAccount's order: billing, the month it paid for, the account card, the shortcuts, then the danger
// zone at the foot. Billing is the one read awaited before the first flush, so cancelling never waits on another;
// every other card is its own boundary, so one slow read leaves only that card on the plain line.
import type React from "react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { copy } from "@/lib/presentation/copy";
import { readBillingSummary, readMonthGot, readSettings } from "../provider";
import { readsLanded } from "../model";
import { ANCHORED, SETTINGS_ANCHOR } from "../tabs";
import { landed, Unread } from "../Unread";
import { readShell } from "../../_shell/provider";
import { CardSkeleton } from "../../_shell/skeletons";
import { Shortcuts } from "../../_shell/Shortcuts";
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
    <div className="flex min-w-0 flex-col gap-6" data-testid="settings-tab-panel-account">
      <div id={SETTINGS_ANCHOR.billing} className={ANCHORED}>
        <BillingPanel billing={billing} />
        <Suspense fallback={<CardSkeleton testId="billing-month-skeleton" rows={3} />}>
          <Month />
        </Suspense>
      </div>
      <Suspense fallback={<CardSkeleton testId="settings-account-skeleton" />}>
        <Account />
      </Suspense>
      <Suspense fallback={<CardSkeleton testId="settings-shortcuts-skeleton" rows={2} head={false} />}>
        <ShortcutsCard />
      </Suspense>
      <DangerZone />
    </div>
  );
}

async function Month(): Promise<React.JSX.Element> {
  const [month, shell, today] = await Promise.all([landed(readMonthGot(), "month"), landed(readShell(), "shell"), landed(planToday(), "today")]);
  if (month === null || shell === null || today === null) return <Unread testId="settings-unread-month" />;
  // This week's pages still to go live, as Plan shows them; unread is never zero.
  const week = await landed(readWeek(today), "week");
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
  const settings = readsLanded(await landed(readSettings(), "settings"), "card", "pages");
  return settings === null ? <Unread testId="settings-unread-account" /> : <AccountPanel account={settings.account} pages={settings.content.pages} />;
}

/** *Visit your blog* and *Help* are reached here; the side panel draws only what board Main draws (issue 1339). */
async function ShortcutsCard(): Promise<React.JSX.Element> {
  const shell = await landed(readShell(), "shell");
  if (shell === null) return <Unread testId="settings-unread-shortcuts" />;
  return (
    <section className="card card-border bg-base-100 min-w-0" data-testid="settings-shortcuts">
      <div className="card-body min-w-0 p-2">
        <Shortcuts blog={shell.blog} />
      </div>
    </section>
  );
}
