// SPEC §4 (2026-09-20, #908) — the Overview tab, at `/app`.
//
// The screen a signed-in customer lands on, in the order that date's ruling
// puts it in: "the Discoverability Score with change and goal in the header;
// the page waiting for review with a one-sentence reason, a small view of it
// as readers will see it, *Read it* and *Stop this page*; three tiles with a
// trend — searches you appear for, questions that name you, your nearest
// rival's lead — each opening its tab; this week, opening Plan; needs you."
//
// **What left this screen, and where it went.** The twelve-week growth card,
// the AI-answers matrix and the rival rows are the Search, AI answers and
// Rivals tabs' own (#916, #918, #917) — each of those readings still stands
// here as one tile that opens the tab behind it. The modules that draw them
// (`GrowthModule`, `TileRow`, `RivalModule`) are unchanged and still tested;
// they are what those three issues build their tabs from.
//
// **One read, and the modules are pure over it.** `readOverview()` is the
// one call this file makes; no module fetches for itself, so the render
// performs no measurement, no vendor call and no model call — a property
// `tests/app/overview/page.test.tsx` asserts rather than assumes.
//
// **It declares no `Surface`:** the shell's layout owns this route's screen
// root (see `../layout.tsx`), and a second one would be a second
// `[data-surface]` in the document.
//
// **It writes no sentence.** Every word comes from the registry, and a line
// the owner has not written renders as nothing rather than as a placeholder
// — the shell's own `writtenLine` rule, shared rather than re-derived.
import type React from "react";
import type { Metadata } from "next";
import { readShell } from "../_shell/provider";
import { readOverview } from "../_overview/provider";
import { overviewNotice, readOnboarding, readReleaseNotice } from "../_shell/onboarding";
import { FirstPageNotice, MarketChoice, ReleaseNoticeLine } from "../_shell/OnboardingStatus";
import { MARKET_TOO_SMALL, readCategoryChoice } from "../_shell/remeasure";
import { ENGINE_LABEL } from "../_shell/page-target-words";
import { writtenLine } from "../_shell/written";
import { copy } from "@/lib/presentation/copy";
import { LinkedTiles } from "../_overview/LinkedTiles";
import { NeedsYouModule } from "../_overview/NeedsYouModule";
import { ScoreHead } from "../_overview/ScoreHead";
import { WaitingPageCard } from "../_overview/WaitingPageCard";
import { WeekModule } from "../_overview/WeekModule";

/** /app's own `<title>` (#945). Without it this screen announced
 *  nothing at all — the `(account)` layout's fallback is the floor, not
 *  the name of this screen. */
export const metadata: Metadata = { title: copy("meta.app.overview.title") };

export default async function OverviewPage(): Promise<React.JSX.Element> {
  // The zone is the shell's one stored preference (REQ-073 c1), read through
  // the shell's own request-cached provider rather than restated here: two
  // readers of a customer's time zone is how two parts of one screen come to
  // state two different days.
  const [shell, overview, onboarding] = await Promise.all([readShell(), readOverview(), readOnboarding()]);
  // issue 784: the founder's reason when the pass released them short — what the
  // shell's panel is not already saying.
  const notice =
    onboarding.kind === "none"
      ? overviewNotice({ onboarding, notice: await readReleaseNotice(), weekZero: shell.weeks.kind !== "counted" })
      : null;
  // Issue 837: an empty Overview over a market too small offers the choice
  // that fills it, unless the shell's panel already does.
  const choice =
    onboarding.kind === "none" && (notice === MARKET_TOO_SMALL || overview.supply?.key === "overview.supply.unmeasured")
      ? await readCategoryChoice()
      : null;

  // Issue 867: the Overview says which engine its AI-answers number is
  // counted from. The line is written here and handed to the tile, so the
  // tile composes no sentence of its own.
  const engineLine = writtenLine("overview.tile.ai-answers.counted-from", {
    engine: copy(ENGINE_LABEL[overview.aiAnswers.engines.countedFrom]),
  });

  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="overview">
      <FirstPageNotice state={onboarding} />
      <ReleaseNoticeLine noticeKey={notice} />
      {choice === null ? null : (
        <section className="card card-border min-w-0 bg-base-100" data-testid="overview-market-choice">
          <div className="card-body">
            <MarketChoice choice={choice} />
          </div>
        </section>
      )}

      <ScoreHead
        head={overview.head}
        score={overview.score}
        today={overview.today}
        timeZone={shell.timeZone}
      />

      {overview.waitingPage === null ? null : (
        <WaitingPageCard page={overview.waitingPage} timeZone={shell.timeZone} />
      )}

      <LinkedTiles
        searches={overview.searches}
        searchTrend={overview.searchTrend}
        pagesPublished={overview.pagesPublished}
        aiAnswers={overview.aiAnswers}
        rivals={overview.rivals}
        engineLine={engineLine}
      />

      {/* The week takes the wider of the two columns: seven day cells each
          hold a stage word, and an even split leaves them narrow enough to
          break one. Needs-you is a short list beside it. */}
      <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <WeekModule week={overview.week} timeZone={shell.timeZone} supply={overview.supply} />
        <NeedsYouModule alerts={overview.alerts} overflow={overview.overflow} issuesOverflow={overview.issuesOverflow} />
      </div>
    </div>
  );
}
