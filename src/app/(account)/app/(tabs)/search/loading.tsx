// SPEC §4 (2026-09-20, #908), issue 912 — the Search tab, while its read is
// in flight. Three tiles over one table, which is what this screen is.
import type React from "react";
import { TableSkeleton, TilesSkeleton } from "../../_shell/skeletons";

export default function SearchLoading(): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="search-waiting">
      <TilesSkeleton />
      <TableSkeleton testId="search-table-skeleton" rows={8} />
    </div>
  );
}
