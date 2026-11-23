// `docs/SPEC.md §4 Settings has three tabs`: Settings › Pages, at `/app/settings/pages`, plate F2: Publishing on the
// left from `lg`, and on the right what the writer already knows, the mail, and the links. Each card is its own
// boundary over its own reads, so one slow read leaves only its card on the plain line.
import type React from "react";
import { Suspense } from "react";
import type { Metadata } from "next";
import { copy } from "@/lib/presentation/copy";
import { readShell } from "../../_shell/provider";
import { CardSkeleton } from "../../_shell/skeletons";
import { readBusiness } from "../business-provider";
import { readLinkMap, readSettings } from "../provider";
import { readsLanded } from "../model";
import { nextPageOf } from "../next-page";
import { CARD_COLUMN, CARD_GRID } from "../frame";
import { ANCHORED, SETTINGS_ANCHOR } from "../tabs";
import { landed, Unread } from "../Unread";
import { KnownContentPanel } from "../panels/KnownContentPanel";
import { LinkMapPanel } from "../panels/LinkMapPanel";
import { NotificationsPanel } from "../panels/NotificationsPanel";
import { PublishingPanel } from "../panels/PublishingPanel";

export const metadata: Metadata = { title: copy("meta.app.settings.pages.title") };

export default function SettingsPagesTab(): React.JSX.Element {
  return (
    <div className={CARD_GRID} data-testid="settings-tab-panel-pages">
      <div id={SETTINGS_ANCHOR.publishing} className={ANCHORED}>
        <Suspense fallback={<CardSkeleton testId="settings-publishing-skeleton" />}>
          <Publishing />
        </Suspense>
      </div>
      <div className={CARD_COLUMN}>
        <Suspense fallback={<CardSkeleton testId="settings-known-content-skeleton" rows={1} />}>
          <Known />
        </Suspense>
        <div id={SETTINGS_ANCHOR.mail} className={ANCHORED}>
          <Suspense fallback={<CardSkeleton testId="settings-mail-skeleton" />}>
            <Mail />
          </Suspense>
        </div>
        <Suspense fallback={<CardSkeleton testId="settings-link-map-skeleton" />}>
          <LinkMap />
        </Suspense>
      </div>
    </div>
  );
}

async function Publishing(): Promise<React.JSX.Element> {
  const [all, shell] = await Promise.all([landed(readSettings(), "settings"), landed(readShell(), "shell")]);
  const settings = readsLanded(all, "publishing", "publishingOn", "destinations");
  if (settings === null || shell === null) return <Unread testId="settings-unread-publishing" />;
  return <PublishingPanel settings={settings} next={nextPageOf(shell, settings.publishing.vetoHours)} />;
}

/** Which pages the articles link, and which stand alone (SPEC §7, 2026-10-10, issue 1391). */
async function LinkMap(): Promise<React.JSX.Element> {
  const map = await landed(readLinkMap(), "linkMap");
  return map === null ? <Unread testId="settings-unread-link-map" /> : <LinkMapPanel map={map} />;
}

async function Mail(): Promise<React.JSX.Element> {
  const settings = readsLanded(await landed(readSettings(), "settings"), "notify", "card", "publishing");
  return settings === null ? <Unread testId="settings-unread-mail" /> : <NotificationsPanel settings={settings} />;
}

async function Known(): Promise<React.JSX.Element> {
  const business = await landed(readBusiness(), "business");
  return business === null ? <Unread testId="settings-unread-known-content" /> : <KnownContentPanel known={business.known} />;
}
