// SPEC §4 (2026-09-20, #908), issue 912 — Plan, while its read is in
// flight. The supply line, then the month at the height the month draws.
import type React from "react";
import { CardSkeleton, MonthSkeleton } from "../_shell/skeletons";

export default function CalendarLoading(): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="calendar-waiting">
      <CardSkeleton testId="supply-skeleton" rows={1} />
      <MonthSkeleton />
    </div>
  );
}
