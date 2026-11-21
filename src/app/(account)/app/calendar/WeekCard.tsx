// SPEC §7 *This week* — whether, and at what time, the week's pages go live.
import { clockTime } from "./dates";
import type { WeekModel } from "./month";

/** A go-live moment is promised only where the address works (Q11), publishing is not held and ReachKit has not stopped. */
export function promisesGoLive(week: Pick<WeekModel, "destination" | "held" | "stopped">): boolean {
  return week.destination?.healthy === true && week.held === null && week.stopped === null;
}

/** Today's go-live clock time, or `null` where none is promised. */
export function weekGoesLive(week: Pick<WeekModel, "destination" | "held" | "stopped">, publishTime: string | null): string | null {
  return promisesGoLive(week) && publishTime !== null ? clockTime(publishTime) : null;
}
