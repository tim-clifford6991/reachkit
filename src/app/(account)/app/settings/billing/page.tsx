// SPEC §4 (2026-09-20, #908) — Settings › **Billing**, at
// `/app/settings/billing`.
//
// One card, moved as it is. The tab takes the card's own word,
// `settings.billing.title` — "Billing", which §4.7 prints.
//
// The card's three controls onto Stripe's one surface are one control; the
// card itself says why (`../panels/BillingPanel.tsx`).
import type React from "react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { copy } from "@/lib/presentation/copy";
import { readBillingSummary, readMonthGot } from "../provider";
import { landed, Unread } from "../Unread";
import { readShell } from "../../_shell/provider";
import { CardSkeleton } from "../../_shell/skeletons";
import { planToday, readWeek } from "../../calendar/provider";
import { nextPageOf } from "../next-page";
import { BillingPanel } from "../panels/BillingPanel";
import { MonthPanel } from "../panels/MonthPanel";

/** This tab's own `<title>` (#945, #925). Each sibling names itself
 *  inside Settings — `account-title.test.ts` forbids two screens
 *  announcing the same thing, so a shared title is not available and
 *  would not serve a reader anyway. */
export const metadata: Metadata = { title: copy("meta.app.settings.billing.title") };

export default async function SettingsBillingTab(): Promise<React.JSX.Element> {
  const billing = await readBillingSummary();
  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="settings-tab-panel-billing">
      {/* Its own boundary, so cancelling never waits on the month's reads. */}
      <Suspense fallback={<CardSkeleton testId="billing-month-skeleton" rows={3} />}>
        <Month />
      </Suspense>
      <BillingPanel billing={billing} />
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
        today,
        price: copy("price.amount"),
        // The shell's blog is the hosted destination once it is live.
        host: shell.blog === null ? null : new URL(shell.blog).hostname,
        planned,
        // `live` does not depend on the stop window, so no settings read is needed.
        first: nextPageOf(shell, 0).live,
      }}
    />
  );
}
