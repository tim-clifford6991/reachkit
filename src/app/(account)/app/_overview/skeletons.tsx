// SPEC §4 (2026-10-07, issue 1324) — a detail's head while its read is in flight: boxes only (`_shell/skeletons.tsx`).
import type React from "react";
import { Box, Waiting } from "../_shell/skeletons";
import { REGION } from "./frame";

/** The date in a tab's head. */
export function MeasuredSkeleton(): React.JSX.Element {
  return <Box className="h-4 w-36" />;
}

/** Overview's four tiles: two columns, four from `lg`, as the row draws them. */
export function TilesSkeleton(): React.JSX.Element {
  return (
    <Waiting testId="tiles-skeleton" className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4" frame={REGION.tiles}>
      {[0, 1, 2, 3].map((i) => (
        <Box key={i} className="h-40 w-full" />
      ))}
    </Waiting>
  );
}
