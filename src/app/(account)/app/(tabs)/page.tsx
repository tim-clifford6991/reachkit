// SPEC §4 (2026-10-07, issue 1319) — the Overview tab, at `/app`.
//
// A dashboard that opens with its numbers (owner 2026-10-09, issue 1364):
// D22's four headline numbers, each opening its screen, then what autopilot
// is doing — and, while a page is in review, that page with *Read or edit*
// and *Stop this page* — then this week and needs you. No Discoverability
// Score and no goal (D22, D23), and the page as a reader will see it is one
// step away, not here.
//
// **The head states what autopilot is doing** (owner 2026-10-09, issue
// 1362; `_overview/autopilot.ts`), and it is said once: while a page is in
// review its card carries the screen's `h1`; otherwise the head stands
// alone.
//
// **Every read is a stored one, and the modules are pure over them.** No
// module fetches for itself, so the render performs no measurement, no
// vendor call and no model call — a property
// `tests/app/overview/page.test.tsx` asserts rather than assumes. The
// top-20 number is the Search tab's own reading and AI visits is the AI
// answers tab's, each through that tab's request-cached provider.
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
import { readPrompts } from "../_overview/prompts-provider";
import { readBlogReads } from "../_overview/blog-reads-provider";
import { overviewNotice, readOnboarding, readReleaseNotice } from "../_shell/onboarding";
import { FirstPageNotice, ReleaseNoticeLine } from "../_shell/OnboardingStatus";
import { MARKET_TOO_SMALL, readCategoryChoice } from "../_shell/remeasure";
import { ENGINE_LABEL } from "../_shell/page-target-words";
import { writtenLine } from "../_shell/written";
import { formatDate } from "../_shell/format";
import { copy } from "@/lib/presentation/copy";
import { readAutopilot } from "../_overview/autopilot";
import { unmeasured } from "@/lib/measure/measured";
import { LinkedTiles } from "../_overview/LinkedTiles";
import { NeedsYouModule } from "../_overview/NeedsYouModule";
import { ScoreHead, type HeadNote } from "../_overview/ScoreHead";
import { WaitingPageCard } from "../_overview/WaitingPageCard";
import { WeekModule } from "../_overview/WeekModule";
import { WeekWaiting } from "../_overview/WeekWaiting";

/** /app's own `<title>` (#945). Without it this screen announced
 *  nothing at all — the `(account)` layout's fallback is the floor, not
 *  the name of this screen. */
export const metadata: Metadata = { title: copy("meta.app.overview.title") };

export default async function OverviewPage(): Promise<React.JSX.Element> {
  // The zone is the shell's one stored preference (REQ-073 c1), read through
  // the shell's own request-cached provider rather than restated here: two
  // readers of a customer's time zone is how two parts of one screen come to
  // state two different days.
  const [shell, overview, onboarding, prompts, top20, blogReads] = await Promise.all([
    readShell(),
    readOverview(),
    readOnboarding(),
    readPrompts(),
    // The Search tab's own provider, reached at the call: `search-model.ts`
    // type-imports the page target, whose graph reaches the vendor clients,
    // and this screen's import graph holds neither (`_overview/waiting.ts`
    // says the same of its own target). A stored read, like the rest. It is
    // one headline, not the screen: where that tab's read fails, the tile
    // says the number could not be read and the rest of Overview stands.
    import("../_overview/search-provider")
      .then((tab) => tab.readSearch())
      .then((model) => model.tiles.firstTwoPages)
      .catch(() => null),
    readBlogReads(),
  ]);
  // issue 784: the founder's reason when the pass released them short — what the
  // shell's panel is not already saying.
  const notice =
    (onboarding.kind === "none" || onboarding.kind === "ended")
      ? overviewNotice({ onboarding, notice: await readReleaseNotice(), weekZero: shell.weeks.kind !== "counted" })
      : null;
  // Issue 837: an empty Overview over a market too small offers the choice
  // that fills it, unless the shell's panel already does.
  const choice =
    (onboarding.kind === "none" || onboarding.kind === "ended") && (notice === MARKET_TOO_SMALL || overview.supply?.key === "overview.supply.unmeasured")
      ? await readCategoryChoice()
      : null;

  // Issue 867: the Overview says which engine its AI-answers number is
  // counted from. The line is written here and handed to the tile, so the
  // tile composes no sentence of its own.
  const engineLine = writtenLine("overview.tile.ai-answers.counted-from", {
    engine: copy(ENGINE_LABEL[overview.aiAnswers.engines.countedFrom]),
  });

  // #1070: the market-too-small notice moves into *This week* beside its
  // one suggestion, so it is not said a second time above the headline.
  const broader =
    choice === null ? null : { choice, notice: notice === MARKET_TOO_SMALL ? copy(MARKET_TOO_SMALL) : null };
  const topNotice = broader !== null && notice === MARKET_TOO_SMALL ? null : notice;

  // Issue 1362: the head states what autopilot is doing, and under it what
  // went live last. Where nothing is planned the head also says why — the
  // one supply statement, moved up from *This week* rather than said twice.
  // It stays below where it carries the broader-categories choice.
  const autopilot = readAutopilot({ shell, today: overview.today, writingOn: overview.writingOn });
  const supplyInHead = autopilot.state === "nothing_planned" && broader === null && overview.supply !== undefined;
  const headNotes: HeadNote[] = [];
  const why =
    supplyInHead && overview.supply !== undefined
      ? writtenLine(overview.supply.key, overview.supply.vars)
      : null;
  if (why !== null) headNotes.push({ testId: "overview-supply", line: why });
  const lastLive =
    overview.lastLive === null
      ? null
      : writtenLine("overview.head.last-live", {
          title: overview.lastLive.title,
          on: formatDate(overview.lastLive.at, shell.timeZone),
        });
  if (lastLive !== null) headNotes.push({ testId: "overview-head-note", line: lastLive });

  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="overview">
      {/* The headline numbers open the screen (owner 2026-10-09, issue
          1364); what autopilot is doing, and everything else, is under
          them. */}
      <LinkedTiles
        aiAnswers={overview.aiAnswers}
        engineLine={engineLine}
        prompts={prompts}
        top20={top20 ?? { value: unmeasured("undeterminable", overview.today), of: unmeasured("undeterminable", overview.today) }}
        blogReads={blogReads}
      />

      <FirstPageNotice state={onboarding} />
      <ReleaseNoticeLine noticeKey={topNotice} />

      {overview.waitingPage === null ? (
        <ScoreHead line={autopilot.line} notes={headNotes} today={overview.today} timeZone={shell.timeZone} />
      ) : (
        <WaitingPageCard
          page={overview.waitingPage}
          head={autopilot.line}
          notes={headNotes}
          scheduled={shell.publishing.next !== null}
          timeZone={shell.timeZone}
          now={overview.today}
        />
      )}

      {/* The week takes the wider of the two columns: seven day cells each
          hold a stage word, and an even split leaves them narrow enough to
          break one. Needs-you is a short list beside it. */}
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* **Skeletons for the week while the pass runs** (SPEC §4,
            2026-09-20; issue 912). Before the pass ends there is no week to
            state: the days are not planned and the numbers are not measured,
            so the box holds its place and says what it is waiting on rather
            than drawing seven empty cells as though they were an answer.
            It fills in when the pass ends — `readOnboarding` reads `none`
            and this arm goes. */}
        {onboarding.kind === "running" ? (
          <WeekWaiting />
        ) : (
          <WeekModule
            week={overview.week}
            timeZone={shell.timeZone}
            supply={supplyInHead ? undefined : overview.supply}
            broader={broader}
          />
        )}
        <NeedsYouModule alerts={overview.alerts} overflow={overview.overflow} issuesOverflow={overview.issuesOverflow} />
      </div>
    </div>
  );
}
