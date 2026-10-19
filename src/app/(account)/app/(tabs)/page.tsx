// SPEC §4 (2026-10-07, issue 1319) — the Overview tab, at `/app`.
//
// The core data at a glance (owner 2026-10-15, issue 1457): the Visibility
// Score, Google, AI and Content, then the biggest gap — each number opening
// exactly the items it counts — then what autopilot is doing, and — while a
// page is in review — that page with *Read or edit* and *Stop this page*,
// then this week and needs you.
//
// **The head states what autopilot is doing** (owner 2026-10-09, issue
// 1362; `_overview/autopilot.ts`), and it is said once: while a page is in
// review its card carries the screen's `h1`; otherwise the head stands
// alone.
//
// **Every read is a stored one, and the modules are pure over them.** No
// module fetches for itself, so the render performs no measurement, no
// vendor call and no model call — a property
// `tests/app/overview/page.test.tsx` asserts rather than assumes. Google
// is the Google tab's own reading, AI the AI tab's and Content Plan's, each
// through that screen's request-cached provider and its one selector.
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
import { readPublished } from "../_overview/content-provider";
import { contentOf } from "../_overview/content";
import { readDone } from "../_overview/done-provider";
import { overviewNotice, readOnboarding, readReleaseNotice } from "../_shell/onboarding";
import { FirstPageNotice, ReleaseNoticeLine } from "../_shell/OnboardingStatus";
import { MARKET_TOO_SMALL, readCategoryChoice } from "../_shell/remeasure";
import { writtenLine } from "../_shell/written";
import { formatDate } from "../_shell/format";
import { copy } from "@/lib/presentation/copy";
import { readAutopilot } from "../_overview/autopilot";
import { LinkedTiles } from "../_overview/LinkedTiles";
import { NeedsYouModule } from "../_overview/NeedsYouModule";
import { ScoreHead, type HeadNote } from "../_overview/ScoreHead";
import { WaitingPageCard } from "../_overview/WaitingPageCard";
import { WeekModule } from "../_overview/WeekModule";
import { WeekWaiting } from "../_overview/WeekWaiting";
import { DoneThisWeek } from "../_overview/DoneThisWeek";
import { ProcessTimeline } from "../_shell/ProcessTimeline";
import { WhatWeRead } from "@/app/_business/WhatWeRead";
import { MainSiteLink } from "../_overview/MainSiteLink";
import { MisstatedFacts } from "../_overview/MisstatedFacts";
import { OVERVIEW, REGION, WEEK_ROW } from "../_overview/frame";

/** /app's own `<title>` (#945). Without it this screen announced
 *  nothing at all — the `(account)` layout's fallback is the floor, not
 *  the name of this screen. */
/** Where the customer corrects what *What we read* says (issue 1454). */
const BUSINESS_SETTINGS = "/app/settings";

export const metadata: Metadata = { title: copy("meta.app.overview.title") };

export default async function OverviewPage(): Promise<React.JSX.Element> {
  // The zone is the shell's one stored preference (REQ-073 c1), read through
  // the shell's own request-cached provider rather than restated here: two
  // readers of a customer's time zone is how two parts of one screen come to
  // state two different days.
  const [shell, overview, onboarding, prompts, google, published, done, understanding, mainLink, misstated] = await Promise.all([
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
      .then((model) => model.tiles.pages)
      .catch(() => null),
    readPublished(),
    // Issue 1395: what ReachKit did this week, from stored rows.
    readDone(),
    // Issue 1454: what ReachKit read of the business. Reached at the call,
    // as the Search tile is; where it cannot be read the card is not drawn
    // and the rest of Overview stands.
    import("../_overview/understanding-provider")
      .then((provider) => provider.readUnderstanding())
      .catch(() => null),
    // Issue 1511: whether the main site links the articles — an optional
    // finding, read from the stored scan; where it cannot be read it is not
    // drawn.
    import("../_overview/main-link-provider")
      .then((provider) => provider.readMainSiteLink())
      .catch(() => null),
    // Issue 1539: what the newest AI answers misstate of the business, read
    // from the stored report against the knowledge base; where it cannot be
    // read it is not drawn.
    import("../_overview/misstated-provider")
      .then((provider) => provider.readMisstated())
      .catch(() => []),
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
    <div className={OVERVIEW} data-testid="overview">
      {/* The core data opens the screen (owner 2026-10-15, issue 1457);
          what autopilot is doing, and everything else, is under it. */}
      <LinkedTiles
        score={overview.score}
        biggestGap={overview.biggestGap}
        google={google}
        prompts={prompts}
        content={contentOf(published)}
        nextAt={shell.publishing.next}
        firstDueOn={overview.firstDueOn}
        timeZone={shell.timeZone}
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
      <div className={WEEK_ROW} data-frame={REGION.week}>
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
            done={<DoneThisWeek facts={{ ...done, nextLiveAt: shell.publishing.next }} timeZone={shell.timeZone} />}
          />
        )}
        <NeedsYouModule alerts={overview.alerts} overflow={overview.overflow} issuesOverflow={overview.issuesOverflow} />
      </div>

      {/* Issue 1454: what ReachKit read of the business, and where the
          customer corrects it. */}
      {understanding === null ? null : <WhatWeRead understanding={understanding} editHref={BUSINESS_SETTINGS} />}

      {/* Issue 1511: the main site's link to the articles, said once and
          optional; gone once the scan finds the link. */}
      {mainLink === null ? null : <MainSiteLink finding={mainLink} />}

      {/* Issue 1539: a fact an AI answer gave the business that its own
          site contradicts, both said; gone once no answer misstates one. */}
      {misstated.length === 0 ? null : <MisstatedFacts findings={misstated} />}

      {/* While the first pass runs there is no week to report, so the
          screen says what the pass is working through instead (SPEC §4,
          2026-10-10; issue 1395). A figure not read yet says so. */}
      {onboarding.kind === "running" ? <ProcessTimeline facts={done} timeZone={shell.timeZone} /> : null}
    </div>
  );
}
