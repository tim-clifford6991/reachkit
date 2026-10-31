// SPEC §4 (2026-09-20, #908) — Settings › **Publishing**, at
// `/app/settings/publishing`.
//
// One card, moved as it is: where pages go, when they go, how long the
// customer has to stop one, and whether publishing is on at all. The tab
// takes the card's own word — `settings.publishing.title` is "Publishing",
// which §4.7 prints and the product already speaks, so no second spelling
// is minted for the bar (`./tabs.ts`).
import type React from "react";
import type { Metadata } from "next";
import { copy } from "@/lib/presentation/copy";
import { readLinkMap, readSettings } from "../provider";
import { readsLanded } from "../model";
import { landed, Unread } from "../Unread";
import { readShell } from "../../_shell/provider";
import { nextPageOf } from "../next-page";
import { LinkMapPanel } from "../panels/LinkMapPanel";
import { PublishingPanel } from "../panels/PublishingPanel";

/** This tab's own `<title>` (#945, #925). Each sibling names itself
 *  inside Settings — `account-title.test.ts` forbids two screens
 *  announcing the same thing, so a shared title is not available and
 *  would not serve a reader anyway. */
export const metadata: Metadata = { title: copy("meta.app.settings.publishing.title") };

export default async function SettingsPublishingTab(): Promise<React.JSX.Element> {
  const [all, linkMap, shell] = await Promise.all([landed(readSettings(), "settings"), landed(readLinkMap(), "linkMap"), landed(readShell(), "shell")]);
  const settings = readsLanded(all, "publishing", "publishingOn");

  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="settings-tab-panel-publishing">
      {settings === null || shell === null ? (
        <Unread testId="settings-unread-publishing" />
      ) : (
        <PublishingPanel settings={settings} next={nextPageOf(shell, settings.publishing.vetoHours)} />
      )}
      {/* Which pages the articles link, and which articles stand alone
          (SPEC §7, 2026-10-10, issue 1391). */}
      {linkMap === null ? <Unread testId="settings-unread-link-map" /> : <LinkMapPanel map={linkMap} />}
    </div>
  );
}
