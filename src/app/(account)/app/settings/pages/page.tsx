// `docs/SPEC.md §4 Settings has three tabs`: Settings › Pages, at `/app/settings/pages`, plate F2: Publishing on the
// left from `lg`, and on the right what the writer already knows, the mail, and the links. Each card streams in on its
// own reads, and one that failed leaves only its card on the error line.
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
import { recorded } from "@/lib/ops/events";
import { Part } from "../../_shell/Part";
import { KnownContentPanel } from "../panels/KnownContentPanel";
import { LinkMapPanel } from "../panels/LinkMapPanel";
import { NotificationsPanel } from "../panels/NotificationsPanel";
import { PublishingPanel } from "../panels/PublishingPanel";

export const metadata: Metadata = { title: copy("meta.app.settings.pages.title") };

export default function SettingsPagesTab(): React.JSX.Element {
  return (
    <div className={CARD_GRID} data-testid="settings-tab-panel-pages">
      <div id={SETTINGS_ANCHOR.publishing} className={ANCHORED}>
        <Part testId="settings-publishing-failed">
          <Suspense fallback={<CardSkeleton testId="settings-publishing-skeleton" />}>
            <Publishing />
          </Suspense>
        </Part>
      </div>
      <div className={CARD_COLUMN}>
        <Part testId="settings-known-content-failed">
          <Suspense fallback={<CardSkeleton testId="settings-known-content-skeleton" rows={1} />}>
            <Known />
          </Suspense>
        </Part>
        <div id={SETTINGS_ANCHOR.mail} className={ANCHORED}>
          <Part testId="settings-mail-failed">
            <Suspense fallback={<CardSkeleton testId="settings-mail-skeleton" />}>
              <Mail />
            </Suspense>
          </Part>
        </div>
        <Part testId="settings-link-map-failed">
          <Suspense fallback={<CardSkeleton testId="settings-link-map-skeleton" />}>
            <LinkMap />
          </Suspense>
        </Part>
      </div>
    </div>
  );
}

async function Publishing(): Promise<React.JSX.Element> {
  const [all, shell] = await Promise.all([recorded(readSettings(), "settings"), recorded(readShell(), "shell")]);
  const settings = readsLanded(all, "publishing", "publishingOn", "destinations");
  return <PublishingPanel settings={settings} next={nextPageOf(shell, settings.publishing.vetoHours)} />;
}

/** Which pages the articles link, and which stand alone (SPEC §7, 2026-10-10, issue 1391). */
async function LinkMap(): Promise<React.JSX.Element> {
  return <LinkMapPanel map={await recorded(readLinkMap(), "linkMap")} />;
}

async function Mail(): Promise<React.JSX.Element> {
  return <NotificationsPanel settings={readsLanded(await recorded(readSettings(), "settings"), "notify", "card", "publishing")} />;
}

async function Known(): Promise<React.JSX.Element> {
  return <KnownContentPanel known={(await recorded(readBusiness(), "business")).known} />;
}
