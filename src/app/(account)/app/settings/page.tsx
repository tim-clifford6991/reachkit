// `docs/SPEC.md §4 Settings has three tabs`: Settings › Your business, at `/app/settings`, plates F1a and F9: four
// cards in two columns from `lg`, each answer one line whose *Change* opens a dialog. Each card streams in on its own
// reads, and a failed one leaves only its card on the error line; `businessScreen` decides everything the cards state.
import type React from "react";
import { Suspense } from "react";
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
import { businessScreen, type BusinessScreen, type BusinessScreenInput } from "./business-screen";
import { readSettings } from "./provider";
import { readsLanded } from "./model";
import { marketFigures } from "./market-figures";
import { CARD_COLUMN, CARD_GRID } from "./frame";
import { ANCHORED, SETTINGS_ANCHOR } from "./tabs";
import { recorded } from "@/lib/ops/events";
import { CardSkeleton } from "../_shell/skeletons";
import { Part } from "../_shell/Part";
import { readBusinessName } from "./voice/name";
import { BusinessPanel } from "./panels/BusinessPanel";
import { CompetitorsPanel } from "./panels/CompetitorsPanel";
import { MarketPanel } from "./panels/MarketPanel";
import { VoicePanel } from "./panels/VoicePanel";

/** `/app/settings` keeps "Settings · ReachKit": it is the address the menu points at (#945). */
export const metadata: Metadata = { title: copy("meta.app.settings.title") };

/** A card's lines, dated in the account's zone. */
async function screenOf(input: Pick<BusinessScreenInput, "business" | "kind" | "market" | "voice">): Promise<BusinessScreen> {
  const account = await requireSetUpAccount();
  return businessScreen({ now: now(), timeZone: account.timeZone, ...input });
}

const soft = <T,>(work: Promise<T>, read: string): Promise<T | null> => recorded(work, read).catch(() => null);

export default function SettingsBusinessTab(): React.JSX.Element {
  return (
    <div className={CARD_GRID} data-testid="settings-tab-panel-business">
      <div className={CARD_COLUMN}>
        <Part testId="settings-business-failed">
          <Suspense fallback={<CardSkeleton testId="settings-business-skeleton" rows={6} />}>
            <Business />
          </Suspense>
        </Part>
        <div id={SETTINGS_ANCHOR.voice} className={ANCHORED}>
          <Part testId="settings-voice-failed">
            <Suspense fallback={<CardSkeleton testId="settings-voice-skeleton" />}>
              <Voice />
            </Suspense>
          </Part>
        </div>
      </div>
      <div id={SETTINGS_ANCHOR.market} className={`${CARD_COLUMN} scroll-mt-48 lg:scroll-mt-16`}>
        {/* Both market cards state the measured sets from one read, so they arrive, or fail, together. */}
        <Part testId="settings-market-failed">
          <Suspense
            fallback={
              <>
                <CardSkeleton testId="settings-market-skeleton" />
                <CardSkeleton testId="settings-competitors-skeleton" />
              </>
            }
          >
            <Market />
          </Suspense>
        </Part>
      </div>
    </div>
  );
}

async function Business(): Promise<React.JSX.Element> {
  const [business, understanding] = await Promise.all([recorded(readBusiness(), "business"), soft(readUnderstanding(), "understanding")]);
  const screen = await screenOf({
    business: { profile: business.profile, knowledge: business.knowledge, empty: profileIsEmpty(business.profile) },
    kind: understanding?.kind == null ? null : copy(`report.read.as.kind.${understanding.kind}`),
    market: null,
    voice: null,
  });
  if (screen.read === null) throw new Error("settings: the business card has no read");
  return <BusinessPanel read={screen.read} profile={business.profile} knowledge={business.knowledge} answers={business.answers} />;
}

async function Voice(): Promise<React.JSX.Element> {
  const [all, business, name] = await Promise.all([recorded(readSettings(), "settings"), soft(readBusiness(), "business"), soft(readBusinessName(), "businessName")]);
  const voice = readsLanded(all, "site", "pages");
  const screen = await screenOf({
    business: business === null ? null : { profile: business.profile, knowledge: business.knowledge, empty: profileIsEmpty(business.profile) },
    kind: null,
    market: null,
    voice,
  });
  if (screen.voice === null) throw new Error("settings: the voice card has no read");
  return (
    <VoicePanel
      voice={screen.voice}
      writing={voice.voice.writing}
      note={voice.voice.text}
      never={voice.doNotClaim}
      words={business === null ? null : business.profile.lists.vocabulary.map((item) => item.text)}
      business={name ?? voice.domain}
    />
  );
}

async function Market(): Promise<React.JSX.Element> {
  const overviewRead = recorded(readOverview(), "overview");
  // The month's AI questions are read at the overview's week, so they wait on it.
  const reputationRead = overviewRead.then((overview) => recorded(readPromptsAt(overview.months?.reading?.week ?? null), "reputation"));
  const [all, rivals, overview, reputation, tiles, understanding, account] = await Promise.all([
    recorded(readSettings(), "settings"),
    recorded(readRivals(), "rivals"),
    overviewRead,
    reputationRead,
    soft(readTiles(0, false), "tiles"),
    soft(readUnderstanding(), "understanding"),
    requireSetUpAccount(),
  ]);
  const measured = readsLanded(all, "answers", "measured");
  const screen = await screenOf({
    business: null,
    kind: null,
    market: {
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
    },
    voice: null,
  });
  if (screen.market === null || screen.competitors === null) throw new Error("settings: the market cards have no read");
  return (
    <>
      <MarketPanel
        market={screen.market}
        domain={measured.domain}
        category={measured.market.category}
        locale={measured.locale}
        alsoServes={understanding?.where.alsoServes}
        overridden={measured.concluded?.categoryOverridden === true}
        timeZone={account.timeZone}
      />
      <CompetitorsPanel competitors={screen.competitors} />
    </>
  );
}
