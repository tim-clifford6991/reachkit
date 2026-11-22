// SPEC §4 (plate O3) — Linked by AI's detail while its read is in flight: the tiles, the head, then the questions' card.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { CardSkeleton } from "../../_shell/skeletons";
import { MeasuredSkeleton } from "../../_overview/skeletons";
import { OVERVIEW } from "../../_overview/frame";
import { TabHead } from "../../_overview/TabHead";
import { DetailTilesSkeleton } from "../../_overview/Tiles";

export default function AiAnswersLoading(): React.JSX.Element {
  return (
    <div className={OVERVIEW} data-testid="ai-answers-waiting">
      <DetailTilesSkeleton />
      <TabHead title={copy("overview.tile.ai-answers.label")} testId="ai-answers" measured={<MeasuredSkeleton />} />
      <CardSkeleton testId="ai-questions-skeleton" rows={6} />
    </div>
  );
}
