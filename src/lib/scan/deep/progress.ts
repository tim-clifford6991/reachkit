// BUILD §4.3 — what the waiting screen is told, and what it is never told.
//
// Two arms and neither carries a time: no elapsed, no estimate, no
// countdown, no clock, no percentage. That is the shape, not a rendering
// convention — a screen cannot show a duration it was never given, and
// there is no field here one could be added to without this file changing.
//
// The running arm's `stage` is the step the pipeline last entered, read
// from `sites.setup_stage` (written by `runDeepPass` — see its header for
// why a row and not the event bus). The ended arm carries `degraded` and
// nothing else: which of the four release reasons ended the wait is a fact
// the app states through `releaseNotice()`, not a fact this frame carries
// to a screen that is about to disappear.
import { dbAdmin } from "@/lib/db";
import { STAGES, type StageName } from "../stages";
import { isReleased } from "./release";

export type DeepPassProgress =
  | { running: true; stage: StageName }
  | { running: false; degraded: boolean };

interface StageRow {
  setup_stage: string | null;
}

/** The generated `Database` type does not carry `sites.setup_stage` yet —
 *  the same narrow cast `release.ts` documents. */
interface MinimalResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}
interface MinimalQuery<T> extends PromiseLike<MinimalResult<T>> {
  select(columns: string): MinimalQuery<T>;
  eq(column: string, value: unknown): MinimalQuery<T>;
  limit(n: number): MinimalQuery<T>;
}
interface MinimalClient {
  from<T>(table: string): MinimalQuery<T>;
}

function isStage(value: string | null): value is StageName {
  return value !== null && (STAGES as readonly string[]).includes(value);
}

/**
 * One founder's pass, as the waiting screen sees it.
 *
 * Reading it is also what latches the ten-minute deadline (`isReleased`),
 * so the founder refreshing the progress screen is the thing that releases
 * them — no scheduled job exists in this path at all.
 *
 * A pass that has been released but recorded no stage still answers: the
 * first stage stands in, because "which step is under way" has no honest
 * empty value and a bare spinner is the thing REQ-029 c1 forbids.
 */
export async function passProgressFor(
  siteId: string,
  now: Date = new Date()
): Promise<DeepPassProgress> {
  const release = await isReleased(siteId, now);
  if (release.released) {
    return { running: false, degraded: release.reason !== "completed" };
  }

  const { data, error } = await (dbAdmin() as unknown as MinimalClient)
    .from<StageRow>("sites")
    .select("setup_stage")
    .eq("id", siteId)
    .limit(1);
  if (error) throw new Error(`passProgressFor: ${error.message}`);

  const recorded = data?.[0]?.setup_stage ?? null;
  return { running: true, stage: isStage(recorded) ? recorded : STAGES[0]! };
}
