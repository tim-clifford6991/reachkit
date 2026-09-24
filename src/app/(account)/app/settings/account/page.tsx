// SPEC §4 (2026-09-20, #908) — Settings › **Account**, at
// `/app/settings/account`.
//
// "The danger zone lives in Account." So this tab is the account card and
// then the zone, in that order: the two ordinary things a customer comes
// here for — their name and their address, and the way out — above the two
// irreversible ones, which is what "out of the way" means in #925's own
// first sentence. It is the foot of the tab and not a disclosure: REQ-079
// c1 has each of those two actions state its consequence before it runs,
// and `DangerZone` is what does that.
//
// Both panels move as they are (#925's Build). `DangerZone` reads nothing
// from the model — it holds its own hand-over state — so only the account
// card takes a slice.
import type React from "react";
import type { Metadata } from "next";
import { copy } from "@/lib/presentation/copy";
import { readSettings } from "../provider";
import { AccountPanel } from "../panels/AccountPanel";
import { DangerZone } from "../panels/DangerZone";

/** This tab's own `<title>` (#945, #925). Each sibling names itself
 *  inside Settings — `account-title.test.ts` forbids two screens
 *  announcing the same thing, so a shared title is not available and
 *  would not serve a reader anyway. */
export const metadata: Metadata = { title: copy("meta.app.settings.account.title") };

export default async function SettingsAccountTab(): Promise<React.JSX.Element> {
  const settings = await readSettings();

  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="settings-tab-panel-account">
      <AccountPanel account={settings.account} />
      <DangerZone />
    </div>
  );
}
