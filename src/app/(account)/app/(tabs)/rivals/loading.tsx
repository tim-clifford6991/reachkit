// SPEC §4 (2026-10-07, issue 1324) — the Rivals tab, while its read is in
// flight: the head, the two counting cards, the table, and the card of
// rivals' rows under it.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { CardSkeleton } from "../../_shell/skeletons";
import { MeasuredSkeleton, RivalPresenceSkeleton, RivalTableSkeleton } from "../../_overview/skeletons";
import { TabHead } from "../../_overview/TabHead";

export default function RivalsLoading(): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="rivals-waiting">
      <TabHead title={copy("overview.tab.rivals")} testId="rivals" measured={<MeasuredSkeleton />} />
      <RivalPresenceSkeleton />
      <RivalTableSkeleton />
      <CardSkeleton testId="rival-rows-skeleton" rows={8} />
    </div>
  );
}
