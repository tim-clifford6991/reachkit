// SPEC §4 (2026-09-20, #908), issue 912 — Overview, while its read is in
// flight.
//
// "a route paints its shell and daisyUI `skeleton` placeholders at once and
// fills in." The boxes below are this screen's own cards in this screen's
// own order — the score head, the page waiting for review, the three tiles,
// this week and needs-you — so what arrives lands where its box already is
// and nothing on the screen moves.
//
// It is **inside** the tabs' layout, so the four tab links are drawn and
// stay drawn while the well waits: the customer can leave for Search, AI
// answers or Rivals without the screen they are leaving finishing first.
//
// A Server Component: it reads nothing at all.
import type React from "react";
import { CardSkeleton, TilesSkeleton } from "../_shell/skeletons";

export default function OverviewLoading(): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="overview-waiting">
      <CardSkeleton testId="score-head-skeleton" rows={2} />
      <CardSkeleton testId="waiting-page-skeleton" rows={4} />
      <TilesSkeleton />
      <CardSkeleton testId="week-skeleton" rows={2} />
      <CardSkeleton testId="needs-you-skeleton" rows={2} />
    </div>
  );
}
