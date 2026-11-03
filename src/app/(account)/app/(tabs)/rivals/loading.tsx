// SPEC §4 (board AppCompetitors) — the Competitors tab while its read is in
// flight: the head, the counting cards, the table, and the gap card under it.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { CardSkeleton } from "../../_shell/skeletons";
import { MeasuredSkeleton, RivalPresenceSkeleton, RivalTableSkeleton } from "../../_overview/skeletons";
import { OVERVIEW } from "../../_overview/frame";
import { TabHead } from "../../_overview/TabHead";

export default function RivalsLoading(): React.JSX.Element {
  return (
    <div className={OVERVIEW} data-testid="rivals-waiting">
      <TabHead title={copy("overview.tab.rivals")} testId="rivals" measured={<MeasuredSkeleton />} />
      <CardSkeleton testId="rival-top-skeleton" rows={7} />
      <RivalPresenceSkeleton />
      <RivalTableSkeleton />
      <CardSkeleton testId="rival-rows-skeleton" rows={2} />
    </div>
  );
}
