// SPEC §4 (2026-09-20, #908), issue 912 — the Rivals tab, while its read is
// in flight. The presence card, then the rival table.
import type React from "react";
import { CardSkeleton, TableSkeleton } from "../../_shell/skeletons";

export default function RivalsLoading(): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="rivals-waiting">
      <CardSkeleton testId="rival-presence-skeleton" rows={4} />
      <TableSkeleton testId="rival-table-skeleton" rows={6} />
    </div>
  );
}
