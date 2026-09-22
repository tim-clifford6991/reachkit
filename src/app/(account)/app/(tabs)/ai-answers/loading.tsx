// SPEC §4 (2026-09-20, #908), issue 912 — the AI answers tab, while its
// read is in flight. The two counts (#953: linked and named are counted
// apart), then the grid of twelve questions.
import type React from "react";
import { CardSkeleton, TilesSkeleton } from "../../_shell/skeletons";

export default function AiAnswersLoading(): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="ai-answers-waiting">
      <TilesSkeleton count={2} />
      <CardSkeleton testId="answer-grid-skeleton" rows={12} />
    </div>
  );
}
