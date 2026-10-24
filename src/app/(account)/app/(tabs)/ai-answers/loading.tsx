// SPEC §4 (board AppAI) — the AI tab while its read is in flight: the head,
// the three tiles, then the card of each page in AI answers.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { CardSkeleton } from "../../_shell/skeletons";
import { TILE_GRID } from "../../_overview/present";
import { MeasuredSkeleton, NumberTilesSkeleton } from "../../_overview/skeletons";
import { TabHead } from "../../_overview/TabHead";

export default function AiAnswersLoading(): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="ai-answers-waiting">
      <TabHead title={copy("overview.tile.ai-answers.label")} testId="ai-answers" measured={<MeasuredSkeleton />} />
      <NumberTilesSkeleton count={3} grid={TILE_GRID.answers} />
      <CardSkeleton testId="ai-pages-skeleton" rows={6} />
    </div>
  );
}
