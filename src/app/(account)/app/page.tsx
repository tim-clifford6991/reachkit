// BUILD §4.5 — Overview, the default view, at `/app`.
//
// The screen a signed-in customer lands on. §4.5's five modules, in §4.5's
// order: the head and the chart that backs it, the three tiles, the rival
// gaps, and this week with its alerts.
//
// **One read, and the modules are pure over it.** `readOverview()` is the
// one call this file makes; no module fetches for itself, so the render
// performs no measurement, no vendor call and no model call — a property
// `tests/app/overview/page.test.tsx` asserts rather than assumes. Today that
// read returns a fixture (`_overview/fixture.ts`) behind the typed provider;
// the queries arrive with #41, #45 and #27, and no caller changes when they
// do.
//
// **It declares no `Surface`:** the shell's layout owns this route's screen
// root (see `./layout.tsx`), and a second one would be a second
// `[data-surface]` in the document.
//
// **It writes no sentence.** Every word comes from the registry, and a line
// the owner has not written renders as nothing rather than as a placeholder
// — the shell's own `writtenLine` rule, shared rather than re-derived.
import type React from "react";
import { readShell } from "./_shell/provider";
import { readOverview } from "./_overview/provider";
import { GrowthModule } from "./_overview/GrowthModule";
import { HeadModule } from "./_overview/HeadModule";
import { RivalModule } from "./_overview/RivalModule";
import { TileRow } from "./_overview/TileRow";
import { WeekModule } from "./_overview/WeekModule";
import { SCREEN } from "./_overview/style";

export default async function OverviewPage(): Promise<React.JSX.Element> {
  // The zone is the shell's one stored preference (REQ-073 c1), read through
  // the shell's own request-cached provider rather than restated here: two
  // readers of a customer's time zone is how two parts of one screen come to
  // state two different days.
  const [shell, overview] = await Promise.all([readShell(), readOverview()]);

  return (
    <div style={SCREEN} data-testid="overview">
      <HeadModule head={overview.head} />
      <GrowthModule growth={overview.growth} timeZone={shell.timeZone} />
      <TileRow
        searches={overview.searches}
        aiAnswers={overview.aiAnswers}
        pagesPublished={overview.pagesPublished}
        timeZone={shell.timeZone}
      />
      <RivalModule rivals={overview.rivals} />
      <WeekModule
        week={overview.week}
        timeZone={shell.timeZone}
        alerts={overview.alerts}
        overflow={overview.overflow}
        supply={overview.supply}
      />
    </div>
  );
}
