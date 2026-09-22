// SPEC §4 (2026-09-20, #908), issue 912 — the page, while its read is in
// flight. The page in its frame (#931) with the review rail's cards beside
// it, which is the shape this screen settles into.
import type React from "react";
import { CardSkeleton, PageSkeleton } from "../../_shell/skeletons";

export default function DraftLoading(): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="draft-waiting">
      <PageSkeleton />
      <CardSkeleton testId="decide-skeleton" rows={4} />
    </div>
  );
}
