// SPEC §4 (2026-09-20, #908) — Settings › **Billing**, at
// `/app/settings/billing`.
//
// One card, moved as it is. The tab takes the card's own word,
// `settings.billing.title` — "Billing", which §4.7 prints.
//
// The card's three controls onto Stripe's one surface are one control; the
// card itself says why (`../panels/BillingPanel.tsx`).
import type React from "react";
import { readSettings } from "../provider";
import { BillingPanel } from "../panels/BillingPanel";

export default async function SettingsBillingTab(): Promise<React.JSX.Element> {
  const settings = await readSettings();

  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="settings-tab-panel-billing">
      <BillingPanel billing={settings.billing} />
    </div>
  );
}
