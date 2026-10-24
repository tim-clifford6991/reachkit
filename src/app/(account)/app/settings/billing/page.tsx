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
import { copy } from "@/lib/presentation/copy";
import { readMonthGot, readSettings } from "../provider";
import { readShell } from "../../_shell/provider";
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
  const [settings, month, shell, today] = await Promise.all([readSettings(), readMonthGot(), readShell(), planToday()]);
  // This week's pages still to go live, as Plan shows them; unread is never zero.
  const planned = await readWeek(today)
    .then((week) => week.cells.flatMap((cell) => (cell.page !== null && cell.page.stage !== "live" ? [cell.day] : [])))
    .catch(() => null);
  const host = settings.destinations.find((d) => d.kind === "hosted" && d.hostnameState === "live")?.hostname ?? null;

  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="settings-tab-panel-billing">
      <MonthPanel
        got={month.got}
        context={{
          timeZone: month.timeZone,
          today,
          price: copy("price.amount"),
          host,
          planned,
          first: nextPageOf(shell, settings.publishing.vetoHours).live,
        }}
      />
      <BillingPanel billing={settings.billing} />
    </div>
  );
}
