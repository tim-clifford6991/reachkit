// SPEC §4, owner R7 (docs/spec/decisions/2026-11-03-2127.md): Settings › Your business, at `/app/settings`, in
// board SettingsIndex's order: what we read of the business and what buyers ask, then the market and its competitors,
// then how the pages sound. Each section is its own boundary over its own reads, so one slow or failed read
// leaves only its section on the plain line. No stylesheet and no `Surface`: the layout draws the heading and bar.
import type React from "react";
import { Suspense } from "react";
import type { Metadata } from "next";
import { copy } from "@/lib/presentation/copy";
import { profileIsEmpty } from "@/lib/site-profile/business/confirm";
import type { BusinessList } from "@/lib/site-profile/business/types";
import { AlsoServesNote } from "@/app/_business/WhatWeRead";
import { requireSetUpAccount } from "../_session/account";
import { readUnderstanding } from "../_overview/understanding-provider";
import { readOverview } from "../_overview/provider";
import { readPromptsAt } from "../_overview/prompts-provider";
import { readRivals } from "../_overview/rivals-provider";
import { namedOf } from "../_overview/rivals-model";
import { aiSearchesOf } from "../_overview/prompts-model";
import { Box, CardSkeleton, Waiting } from "../_shell/skeletons";
import { readBusiness, type BusinessModel } from "./business-provider";
import { readSettings } from "./provider";
import { readsLanded } from "./model";
import { marketFigures } from "./market-figures";
import { ANCHORED, SETTINGS_ANCHOR } from "./tabs";
import { landed, Unread } from "./Unread";
import { readBusinessName } from "./voice/name";
import { BusinessPanel, ListEditor } from "./panels/BusinessPanel";
import { CompetitorsPanel } from "./panels/CompetitorsPanel";
import { KnowledgePanel } from "./panels/KnowledgePanel";
import { MarketPanel } from "./panels/MarketPanel";
import { VoicePanel } from "./panels/VoicePanel";

type BusinessRead = Promise<BusinessModel | null>;

/** `/app/settings` keeps "Settings · ReachKit": it is the address the menu points at (#945). */
export const metadata: Metadata = { title: copy("meta.app.settings.title") };

export default async function SettingsBusinessTab(): Promise<React.JSX.Element> {
  const account = await requireSetUpAccount();
  // One business read for the two places that draw it, so a failure is logged and counted once.
  const business = landed(readBusiness(), "business");
  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="settings-tab-panel-business">
      <Suspense fallback={<CardSkeleton testId="settings-business-skeleton" />}>
        <Business read={business} timeZone={account.timeZone} />
      </Suspense>
      <div id={SETTINGS_ANCHOR.market} className={ANCHORED}>
        <Suspense fallback={<CardSkeleton testId="settings-market-skeleton" />}>
          <Market />
        </Suspense>
      </div>
      <div id={SETTINGS_ANCHOR.voice} className={ANCHORED}>
        <Suspense fallback={<CardSkeleton testId="settings-voice-skeleton" />}>
          <Voice business={business} />
        </Suspense>
      </div>
    </div>
  );
}

/** What we read of the business, and what buyers ask. The kind is the market conclusion's closed word (REVIEW4 §2). */
async function Business({ read, timeZone }: { read: BusinessRead; timeZone: string }): Promise<React.JSX.Element> {
  const [business, understanding] = await Promise.all([read, landed(readUnderstanding(), "understanding")]);
  if (business === null) return <Unread testId="settings-unread-business" />;
  const kind = understanding?.kind == null ? null : copy(`report.read.as.kind.${understanding.kind}`);
  return (
    <>
      <BusinessPanel profile={business.profile} kind={kind} empty={profileIsEmpty(business.profile)} timeZone={timeZone} />
      <section className="flex min-w-0 flex-col gap-3" aria-label={copy("settings.business.more")}>
        <KnowledgePanel knowledge={business.knowledge} answers={business.answers} />
      </section>
    </>
  );
}

/** What is measured, then who it is measured against; every figure is the Competitors tab's own stored reading. */
async function Market(): Promise<React.JSX.Element> {
  const [all, understanding, rivals, overview] = await Promise.all([
    landed(readSettings(), "settings"),
    landed(readUnderstanding(), "understanding"),
    landed(readRivals(), "rivals"),
    landed(readOverview(), "overview"),
  ]);
  const settings = readsLanded(all, "answers", "measured");
  // The month's questions are read at the overview's week, so they wait on it.
  const reputation = overview === null ? null : await landed(readPromptsAt(overview.months?.reading?.week ?? null), "reputation");
  const alsoServes = understanding === null ? null : <AlsoServesNote n={understanding.where.alsoServes} />;
  // Both cards state the measured sets, so a set that did not load leaves both on their error line.
  if (settings === null || rivals === null || overview === null || reputation === null) {
    return (
      <>
        <Unread testId="settings-unread-market" />
        {alsoServes}
        <Unread testId="settings-unread-competitors" />
      </>
    );
  }
  const searches = rivals.firstPage.of === 0 ? null : rivals.firstPage.of;
  const questions = reputation.kind === "measured" ? aiSearchesOf(reputation.prompts).asked.length : null;
  return (
    <>
      <MarketPanel
        market={settings.market}
        concluded={settings.concluded}
        domain={settings.domain}
        locale={settings.locale}
        timeZone={settings.publishing.timeZone}
        sets={{ searches, questions, competitors: settings.competitors.length }}
      />
      {alsoServes}
      <CompetitorsPanel
        competitors={settings.competitors}
        concluded={settings.concluded}
        figures={marketFigures({
          competitors: settings.competitors,
          measured: settings.measuredRivals,
          firstPage: rivals.firstPage,
          named: namedOf(reputation),
        })}
        measuredFrom={settings.market.wouldTakeEffectOn}
        leaders={overview.rivals.leaders.domains}
      />
    </>
  );
}

/** How the pages sound. The examples read as unnamed where the name did not load, as where none is stored. */
async function Voice(p: { business: BusinessRead }): Promise<React.JSX.Element> {
  const [all, business] = await Promise.all([landed(readSettings(), "settings"), landed(readBusinessName(), "businessName")]);
  const settings = readsLanded(all, "site", "pages");
  if (settings === null) return <Unread testId="settings-unread-voice" />;
  const words = (
    <Suspense fallback={<Waiting testId="settings-words-skeleton"><Box className="h-11 w-full" /></Waiting>}>
      <Words read={p.business} />
    </Suspense>
  );
  return <VoicePanel settings={settings} business={business} words={words} />;
}

/** The business list the voice card edits. */
const WORDS: BusinessList = "vocabulary";

/** Words you use, off the business read Your business already makes; where it fails, only this row says so. */
async function Words({ read }: { read: BusinessRead }): Promise<React.JSX.Element> {
  const business = await read;
  if (business === null) return <p data-testid="settings-unread-words">{copy("settings.panel.unread")}</p>;
  return <ListEditor list={WORDS} items={business.profile.lists[WORDS]} />;
}
