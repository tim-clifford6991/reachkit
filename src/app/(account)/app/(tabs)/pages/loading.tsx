// SPEC §4 *Pages Live detail* — the wait: the same link, strip and head, then the card's box.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { CardSkeleton } from "../../_shell/skeletons";
import { MeasuredSkeleton } from "../../_overview/skeletons";
import { OVERVIEW } from "../../_overview/frame";
import { TabHead } from "../../_overview/TabHead";
import { DetailTilesSkeleton } from "../../_overview/Tiles";

export default function PagesLiveLoading(): React.JSX.Element {
  return (
    <div className={OVERVIEW} data-testid="pages-waiting">
      <DetailTilesSkeleton />
      <TabHead title={copy("overview.tile.short.pages")} testId="pages" lead={copy("overview.pages.lead")} measured={<MeasuredSkeleton />} />
      <CardSkeleton testId="live-pages-skeleton" rows={8} />
    </div>
  );
}
