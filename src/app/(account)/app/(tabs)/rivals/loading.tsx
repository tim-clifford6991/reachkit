// SPEC §4 *Competitors tab* (plate O5) — Against Competitors' detail while its read is in flight: the tiles, the head, then the table's card.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { CardSkeleton } from "../../_shell/skeletons";
import { MeasuredSkeleton } from "../../_overview/skeletons";
import { OVERVIEW } from "../../_overview/frame";
import { TabHead } from "../../_overview/TabHead";
import { DetailTilesSkeleton } from "../../_overview/Tiles";

export default function RivalsLoading(): React.JSX.Element {
  return (
    <div className={OVERVIEW} data-testid="rivals-waiting">
      <DetailTilesSkeleton />
      <TabHead title={copy("overview.tab.rivals")} testId="rivals" measured={<MeasuredSkeleton />} />
      <CardSkeleton testId="rivals-table-skeleton" rows={6} />
    </div>
  );
}
