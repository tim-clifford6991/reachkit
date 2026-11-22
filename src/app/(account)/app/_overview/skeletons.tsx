// SPEC §4 (2026-10-07, issue 1324) — a detail's head while its read is in flight: boxes only (`_shell/skeletons.tsx`).
import type React from "react";
import { Box } from "../_shell/skeletons";

/** The date in a tab's head. */
export function MeasuredSkeleton(): React.JSX.Element {
  return <Box className="h-4 w-36" />;
}
