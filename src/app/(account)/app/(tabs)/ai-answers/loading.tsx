// SPEC §4 (2026-10-07, issue 1324) — the AI answers tab, while its read is
// in flight: the head, the two number tiles, then the grid of questions.
// The cards under the grid are drawn only for a site that has them, so
// they hold no box here.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { TILE_GRID } from "../../_overview/present";
import { AnswerGridSkeleton, MeasuredSkeleton, NumberTilesSkeleton } from "../../_overview/skeletons";
import { TabHead } from "../../_overview/TabHead";

export default function AiAnswersLoading(): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="ai-answers-waiting">
      <TabHead
        title={copy("overview.tile.ai-answers.label")}
        testId="ai-answers"
        measured={<MeasuredSkeleton />}
      />
      <NumberTilesSkeleton count={2} grid={TILE_GRID.answers} />
      <AnswerGridSkeleton />
    </div>
  );
}
