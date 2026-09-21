// SPEC §4 (2026-09-20, #908) — Settings › **Mail**, at
// `/app/settings/mail`.
//
// One card, moved as it is: which of §12's recurring mails the customer
// gets. The tab's word is the redesign's — "Mail" — and the card keeps
// §4.7's own title, "Notifications". Same reason as the voice tab: the bar
// names the subject, the card states what it holds.
import type React from "react";
import type { Metadata } from "next";
import { copy } from "@/lib/presentation/copy";
import { readSettings } from "../provider";
import { NotificationsPanel } from "../panels/NotificationsPanel";

/** This tab's own `<title>` (#945, #925). Each sibling names itself
 *  inside Settings — `account-title.test.ts` forbids two screens
 *  announcing the same thing, so a shared title is not available and
 *  would not serve a reader anyway. */
export const metadata: Metadata = { title: copy("meta.app.settings.mail.title") };

export default async function SettingsMailTab(): Promise<React.JSX.Element> {
  const settings = await readSettings();

  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="settings-tab-panel-mail">
      <NotificationsPanel settings={settings} />
    </div>
  );
}
