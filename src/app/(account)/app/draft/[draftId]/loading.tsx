// SPEC §4 (2026-09-20, #908), issue 912 — the page, while its read is in flight: the shape `shape.ts` places for
// this file and for `DraftScreen` alike — the head, the rail, then the tabs with the page in its frame.
import type React from "react";
import { Box, CardSkeleton, PageSkeleton, Waiting } from "../../_shell/skeletons";
import { SHAPE } from "./shape";

export default function DraftLoading(): React.JSX.Element {
  return (
    <div className={SHAPE.screen} data-testid="draft-waiting">
      <div className={SHAPE.grid}>
        <Waiting className={SHAPE.head} testId="head-skeleton">
          <Box className="h-8 w-3/4" />
          <Box className="h-4 w-60" />
        </Waiting>
        <div className={`${SHAPE.rail} border-0`}>
          <CardSkeleton testId="decide-skeleton" rows={4} />
        </div>
        <div className={`${SHAPE.tabs} p-4`}>
          <Box className="mb-4 h-8 w-full" />
          <PageSkeleton />
        </div>
      </div>
    </div>
  );
}
