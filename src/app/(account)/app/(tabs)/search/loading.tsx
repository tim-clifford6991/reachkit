// SPEC §4 (2026-10-07, issue 1324) — the Search tab, while its read is in
// flight: the head, the three tiles, the pages and the table, which is what this screen
// is, in the shapes it takes on a phone and on a desktop.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { TILE_GRID } from "../../_overview/present";
import { GooglePagesSkeleton, MeasuredSkeleton, NumberTilesSkeleton, SearchTableSkeleton } from "../../_overview/skeletons";
import { OVERVIEW } from "../../_overview/frame";
import { TabHead } from "../../_overview/TabHead";
import { DetailTilesSkeleton } from "../../_overview/Tiles";

export default function SearchLoading(): React.JSX.Element {
  return (
    <div className={OVERVIEW} data-testid="search-waiting">
      <DetailTilesSkeleton />
      <TabHead title={copy("overview.tab.search")} testId="search" measured={<MeasuredSkeleton />} />
      <NumberTilesSkeleton count={3} grid={TILE_GRID.search} />
      <GooglePagesSkeleton />
      <SearchTableSkeleton />
    </div>
  );
}
