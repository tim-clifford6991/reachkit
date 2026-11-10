// SPEC §4 (board AppAI) — the AI tab while its read is in flight: the head,
// the month's figure, then the card of each page in AI answers.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { CardSkeleton } from "../../_shell/skeletons";
import { MeasuredSkeleton } from "../../_overview/skeletons";
import { OVERVIEW } from "../../_overview/frame";
import { TabHead } from "../../_overview/TabHead";

export default function AiAnswersLoading(): React.JSX.Element {
  return (
    <div className={OVERVIEW} data-testid="ai-answers-waiting">
      <TabHead title={copy("overview.tile.ai-answers.label")} testId="ai-answers" measured={<MeasuredSkeleton />} />
      <CardSkeleton testId="ai-lead-skeleton" rows={4} />
      <CardSkeleton testId="ai-pages-skeleton" rows={6} />
    </div>
  );
}
