// SPEC §4 (2026-09-20, #908 · 2026-10-07, issue 1319 · 2026-10-09, issue
// 1364) — Overview, while its read is in flight.
//
// "A skeleton is the shape of the screen that arrives, on a phone and on a
// desktop." The boxes below are the new Overview's own, in its own order
// and on its own grids — `_overview/frame.ts`, which the loaded screen
// draws with too (issue 1484): the four headline numbers — two columns on a
// phone, one row from `lg` — the action for the page in review, then this
// week beside needs-you from `xl` and above it below. What arrives lands
// where its box already is and nothing on the screen moves.
//
// It is **inside** the tabs' layout, so the four tab links are drawn and
// stay drawn while the well waits: the customer can leave for Search, AI
// answers or Rivals without the screen they are leaving finishing first.
//
// A Server Component: it reads nothing at all.
import type React from "react";
import { CardSkeleton, TilesSkeleton } from "../_shell/skeletons";
import { OVERVIEW, REGION, TILES, WEEK_ROW } from "../_overview/frame";

export default function OverviewLoading(): React.JSX.Element {
  return (
    <div className={OVERVIEW} data-testid="overview-waiting">
      <TilesSkeleton count={4} grid={TILES} frame={REGION.tiles} />
      <CardSkeleton testId="waiting-page-skeleton" rows={2} />
      <div className={WEEK_ROW} data-frame={REGION.week}>
        <CardSkeleton testId="week-skeleton" rows={2} />
        <CardSkeleton testId="needs-you-skeleton" rows={2} />
      </div>
    </div>
  );
}
