// SPEC §4 (2026-09-20, #908 · 2026-10-07, issue 1319 · 2026-10-09, issue
// 1364) — Overview, while its read is in flight.
//
// "A skeleton is the shape of the screen that arrives, on a phone and on a
// desktop." The boxes below are the new Overview's own, in its own order
// and on its own frame — `_overview/frame.ts`, which the loaded screen
// draws with too (issue 1484): today's page, the ladder, this week's pages,
// then the figures. What arrives lands where its box already is and nothing on the
// screen moves.
//
// It is **inside** the tabs' layout, so the four tab links are drawn and
// stay drawn while the well waits: the customer can leave for Search, AI
// answers or Rivals without the screen they are leaving finishing first.
//
// A Server Component: it reads nothing at all.
import type React from "react";
import { CardSkeleton } from "../_shell/skeletons";
import { OVERVIEW, REGION } from "../_overview/frame";

export default function OverviewLoading(): React.JSX.Element {
  return (
    <div className={OVERVIEW} data-testid="overview-waiting">
      <CardSkeleton testId="waiting-page-skeleton" rows={2} />
      <CardSkeleton testId="ladder-skeleton" rows={3} />
      <div className="min-w-0" data-frame={REGION.week}>
        <CardSkeleton testId="week-skeleton" rows={7} />
      </div>
      <CardSkeleton testId="figures-skeleton" rows={4} />
    </div>
  );
}
