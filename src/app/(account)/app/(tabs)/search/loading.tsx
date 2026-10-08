// SPEC §4 (2026-10-07, issue 1324) — the Search tab, while its read is in
// flight: the head, the four tiles and the table, which is what this screen
// is, in the shapes it takes on a phone and on a desktop.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { TILE_GRID } from "../../_overview/present";
import { MeasuredSkeleton, NumberTilesSkeleton, SearchTableSkeleton } from "../../_overview/skeletons";
import { TabHead } from "../../_overview/TabHead";

export default function SearchLoading(): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="search-waiting">
      <TabHead title={copy("overview.tab.search")} testId="search" measured={<MeasuredSkeleton />} />
      <NumberTilesSkeleton count={4} grid={TILE_GRID.search} name="h-4 xl:h-8" />
      <SearchTableSkeleton />
    </div>
  );
}
