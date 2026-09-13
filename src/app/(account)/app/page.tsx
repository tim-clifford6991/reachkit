// Canvas: Dashboard — Overview, the default view, at `/app`.
//
// The artboard's sections in its own order: the head, the score with the
// searches series beside it, the two tiles, this week, and what needs the
// customer. The rivals card follows them — SPEC §4 gives the customer their
// rivals' lines beside their own, and the artboard draws that as a second
// series the chart primitives do not yet accept.
//
// One read, and the modules are pure over it: `readOverview()` is the one
// call this file makes, so the render performs no measurement, no vendor call
// and no model call.
//
// It declares no `Surface` — the shell's layout owns this route's screen root
// — and it writes no sentence: every word comes from the registry.
import type React from "react";
import { readShell } from "./_shell/provider";
import { readOverview } from "./_overview/provider";
import { HeadModule } from "./_overview/HeadModule";
import { ScoreCard } from "./_overview/ScoreCard";
import { RivalModule } from "./_overview/RivalModule";
import { TileRow } from "./_overview/TileRow";
import { NeedsYouModule } from "./_overview/NeedsYouModule";
import { WeekModule } from "./_overview/WeekModule";
import { SCREEN } from "./_overview/style";

export default async function OverviewPage(): Promise<React.JSX.Element> {
  // The zone is the shell's one stored preference, read through the shell's
  // own request-cached provider rather than restated here: two readers of a
  // customer's zone is how two parts of one screen state two different days.
  const [shell, overview] = await Promise.all([readShell(), readOverview()]);

  return (
    <div className={SCREEN} data-testid="overview">
      <HeadModule head={overview.head} />
      <ScoreCard
        score={overview.score}
        growth={overview.growth}
        timeZone={shell.timeZone}
        weekZero={overview.weekZero}
      />
      <TileRow
        aiAnswers={overview.aiAnswers}
        pagesPublished={overview.pagesPublished}
        timeZone={shell.timeZone}
        weekZero={overview.weekZero}
      />
      <WeekModule week={overview.week} timeZone={shell.timeZone} supply={overview.supply} />
      <NeedsYouModule alerts={overview.alerts} overflow={overview.overflow} />
      <RivalModule rivals={overview.rivals} timeZone={shell.timeZone} weekZero={overview.weekZero} />
    </div>
  );
}
