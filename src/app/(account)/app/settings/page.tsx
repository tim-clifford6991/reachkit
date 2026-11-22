// `docs/SPEC.md §4 Settings has three tabs`: Settings › Your business, at `/app/settings`, plates F1a and F9: four
// cards in two columns from `lg`, each answer one line whose *Change* opens a dialog. Every read lands on its own, so
// a failed one leaves only its card on the plain line; `businessScreen` decides everything the cards state.
import type React from "react";
import type { Metadata } from "next";
import { now } from "@/lib/config/now";
import { copy } from "@/lib/presentation/copy";
import { profileIsEmpty } from "@/lib/site-profile/business/confirm";
import { requireSetUpAccount } from "../_session/account";
import { readUnderstanding } from "../_overview/understanding-provider";
import { readOverview } from "../_overview/provider";
import { readPromptsAt } from "../_overview/prompts-provider";
import { readRivals } from "../_overview/rivals-provider";
import { namedOf } from "../_overview/rivals-model";
import { readTiles } from "../_overview/tiles-provider";
import { aiSearchesOf } from "../_overview/prompts-model";
import { readBusiness } from "./business-provider";
import { businessScreen } from "./business-screen";
import { readSettings } from "./provider";
import { readsLanded } from "./model";
import { marketFigures } from "./market-figures";
import { CARD_COLUMN, CARD_GRID } from "./frame";
import { ANCHORED, SETTINGS_ANCHOR } from "./tabs";
import { landed, Unread } from "./Unread";
import { readBusinessName } from "./voice/name";
import { BusinessPanel } from "./panels/BusinessPanel";
import { CompetitorsPanel } from "./panels/CompetitorsPanel";
import { MarketPanel } from "./panels/MarketPanel";
import { VoicePanel } from "./panels/VoicePanel";

/** `/app/settings` keeps "Settings · ReachKit": it is the address the menu points at (#945). */
export const metadata: Metadata = { title: copy("meta.app.settings.title") };

/** The month's AI questions are read at the overview's week, so they wait on it. */
async function readReputation(): Promise<Awaited<ReturnType<typeof readPromptsAt>> | null> {
  const overview = await landed(readOverview(), "overview");
  return overview === null ? null : landed(readPromptsAt(overview.months?.reading?.week ?? null), "reputation");
}

export default async function SettingsBusinessTab(): Promise<React.JSX.Element> {
  const account = await requireSetUpAccount();
  const [business, understanding, all, rivals, overview, reputation, tiles, name] = await Promise.all([
    landed(readBusiness(), "business"),
    landed(readUnderstanding(), "understanding"),
    landed(readSettings(), "settings"),
    landed(readRivals(), "rivals"),
    landed(readOverview(), "overview"),
    readReputation(),
    landed(readTiles(0, false), "tiles"),
    landed(readBusinessName(), "businessName"),
  ]);
  const measured = readsLanded(all, "answers", "measured");
  const voice = readsLanded(all, "site", "pages");
  // Both market cards state the measured sets, so a set that did not load leaves both on their plain line.
  const market =
    measured === null || rivals === null || overview === null || reputation === null
      ? null
      : {
          settings: measured,
          searches: rivals.firstPage.of === 0 ? null : rivals.firstPage.of,
          questions: reputation.kind === "measured" ? aiSearchesOf(reputation.prompts).asked.length : null,
          figures: marketFigures({
            competitors: measured.competitors,
            measured: measured.measuredRivals,
            firstPage: rivals.firstPage,
            named: namedOf(tiles?.answers ?? null, rivals.rivals),
          }),
          leaders: overview.rivals.leaders.domains,
        };
  const screen = businessScreen({
    now: now(),
    timeZone: account.timeZone,
    business: business === null ? null : { profile: business.profile, knowledge: business.knowledge, empty: profileIsEmpty(business.profile) },
    kind: understanding?.kind == null ? null : copy(`report.read.as.kind.${understanding.kind}`),
    market,
    voice,
  });

  return (
    <div className={CARD_GRID} data-testid="settings-tab-panel-business">
      <div className={CARD_COLUMN}>
        {business === null || screen.read === null ? (
          <Unread testId="settings-unread-business" />
        ) : (
          <BusinessPanel read={screen.read} profile={business.profile} knowledge={business.knowledge} answers={business.answers} />
        )}
        <div id={SETTINGS_ANCHOR.voice} className={ANCHORED}>
          {voice === null || screen.voice === null ? (
            <Unread testId="settings-unread-voice" />
          ) : (
            <VoicePanel
              voice={screen.voice}
              writing={voice.voice.writing}
              note={voice.voice.text}
              never={voice.doNotClaim}
              words={business === null ? null : business.profile.lists.vocabulary.map((item) => item.text)}
              business={name ?? voice.domain}
            />
          )}
        </div>
      </div>
      <div id={SETTINGS_ANCHOR.market} className={`${CARD_COLUMN} scroll-mt-48 lg:scroll-mt-16`}>
        {market === null || screen.market === null || screen.competitors === null ? (
          <>
            <Unread testId="settings-unread-market" />
            <Unread testId="settings-unread-competitors" />
          </>
        ) : (
          <>
            <MarketPanel
              market={screen.market}
              domain={market.settings.domain}
              category={market.settings.market.category}
              locale={market.settings.locale}
              alsoServes={understanding?.where.alsoServes}
              overridden={market.settings.concluded?.categoryOverridden === true}
              timeZone={account.timeZone}
            />
            <CompetitorsPanel competitors={screen.competitors} />
          </>
        )}
      </div>
    </div>
  );
}
