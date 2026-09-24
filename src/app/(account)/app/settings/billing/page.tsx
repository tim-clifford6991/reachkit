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
import { readSettings } from "../provider";
import { BillingPanel } from "../panels/BillingPanel";

/** This tab's own `<title>` (#945, #925). Each sibling names itself
 *  inside Settings — `account-title.test.ts` forbids two screens
 *  announcing the same thing, so a shared title is not available and
 *  would not serve a reader anyway. */
export const metadata: Metadata = { title: copy("meta.app.settings.billing.title") };

export default async function SettingsBillingTab(): Promise<React.JSX.Element> {
  const settings = await readSettings();

  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="settings-tab-panel-billing">
      <BillingPanel billing={settings.billing} />
    </div>
  );
}
