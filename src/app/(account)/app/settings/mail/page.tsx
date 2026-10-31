// SPEC §4 (2026-09-20, #908) — Settings › **Mail**, at
// `/app/settings/mail`.
//
// One card, moved as it is: which of §12's recurring mails the customer
// gets. The tab and the card both say "Mail", the word the mail footers point to.
import type React from "react";
import type { Metadata } from "next";
import { copy } from "@/lib/presentation/copy";
import { readSettings } from "../provider";
import { readsLanded } from "../model";
import { landed, Unread } from "../Unread";
import { readShell } from "../../_shell/provider";
import { readPublished } from "../../_overview/content-provider";
import { contentOf } from "@/lib/measure/published";
import { pageLadderOf } from "@/lib/measure/page-ladder";
import { nextPageOf } from "../next-page";
import { NotificationsPanel } from "../panels/NotificationsPanel";

/** This tab's own `<title>` (#945, #925). Each sibling names itself
 *  inside Settings — `account-title.test.ts` forbids two screens
 *  announcing the same thing, so a shared title is not available and
 *  would not serve a reader anyway. */
export const metadata: Metadata = { title: copy("meta.app.settings.mail.title") };

export default async function SettingsMailTab(): Promise<React.JSX.Element> {
  const [all, shell, published] = await Promise.all([landed(readSettings(), "settings"), landed(readShell(), "shell"), landed(readPublished(), "published")]);
  const settings = readsLanded(all, "notify", "card", "publishing");
  // Overview's own ladder over Overview's own read, so the two never count apart.
  const content = published === null ? null : contentOf(published);
  const climbing = content === null || published === null ? 0 : (pageLadderOf(content.pages, published.now)?.climbing ?? 0);

  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="settings-tab-panel-mail">
      {settings === null || shell === null ? (
        <Unread testId="settings-unread-mail" />
      ) : (
        <NotificationsPanel settings={settings} next={nextPageOf(shell, settings.publishing.vetoHours)} climbing={climbing} />
      )}
    </div>
  );
}
