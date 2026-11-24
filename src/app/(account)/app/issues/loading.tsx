// Gives Site Fixes a loading boundary, so the default prefetch reaches it and a tap shows this at once.
import type React from "react";
import { CardSkeleton } from "../_shell/skeletons";

export default function IssuesLoading(): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="issues-waiting">
      <CardSkeleton testId="issues-skeleton" rows={5} />
    </div>
  );
}
