// BUILD §4.3 — what the waiting screen is told, and what it is never told.
//
// Two arms. The running one carries the instant each stage began, and
// nothing more (issue #356): UI-SPEC S11 draws a finished stage's elapsed
// time, and a duration the screen composed from its own clock would be how
// long a tab was open rather than how long the work took. So this frame
// passes recorded instants through, and the screen subtracts consecutive
// entries — the arithmetic lives in `_setup/stages.ts` and nowhere else,
// which is what keeps a duration from being invented in two places.
//
// What no arm carries is a forecast: nothing here estimates, counts down,
// shows a clock or a percentage, and the row under way is drawn as a dash
// rather than a number that grows.
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
  | {
      running: true;
      stage: StageName;
      /** When each stage of this pass began, keyed by handle
       *  (`sites.setup_stage_times`, issue #356). A finished stage's
       *  elapsed time is the difference between its own entry and the
       *  next one's; the running stage has no end yet and UI-SPEC S11
       *  draws it as a dash rather than a clock. Empty where the pass
       *  recorded none. */
      enteredAt: Readonly<Partial<Record<StageName, string>>>;
    }
  | { running: false; degraded: boolean };

interface StageRow {
  setup_stage: string | null;
  setup_stage_times: Record<string, string> | null;
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
    .select("setup_stage, setup_stage_times")
    .eq("id", siteId)
    .limit(1);
  if (error) throw new Error(`passProgressFor: ${error.message}`);

  const recorded = data?.[0]?.setup_stage ?? null;
  return {
    running: true,
    stage: isStage(recorded) ? recorded : STAGES[0]!,
    // Only the handles this engine knows: a key the column carries that
    // `STAGES` does not name is a stage from an older shape, and a screen
    // that timed it would draw a row it has no name for.
    enteredAt: knownEntries(data?.[0]?.setup_stage_times ?? null),
  };
}

/** The recorded entries, filtered to the stages this engine names. */
function knownEntries(
  raw: Record<string, string> | null
): Readonly<Partial<Record<StageName, string>>> {
  if (raw === null) return {};
  const out: Partial<Record<StageName, string>> = {};
  for (const stage of STAGES) {
    const at = raw[stage];
    if (typeof at === "string" && at.length > 0) out[stage] = at;
  }
  return out;
}
