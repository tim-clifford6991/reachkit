// BUILD §4.3: what the waiting screen is told. The running arm carries each stage's recorded start instant and the screen subtracts consecutive entries in `_setup/stages.ts`,
// so no duration is composed from a tab's clock. No arm carries a forecast.
// `stage` is read from `sites.setup_stage` (see `runFirstPass`); the ended arm carries only `degraded`, and why the wait ended is `releaseNotice()`'s to state.
import { dbAdmin } from "@/lib/db";
import { STAGES, type StageName } from "../stages";
import { isReleased } from "./release";

/** The first draft, written before the founder is released, so "the pass is running" covers the first page. Not one of the engine's six handles, so its own value. */
export const FIRST_DRAFT_STAGE = "writing_first_draft" as const;
export type OnboardingStage = StageName | typeof FIRST_DRAFT_STAGE;

export type DeepPassProgress =
  | {
      running: true;
      stage: OnboardingStage;
      /** When each stage began (`sites.setup_stage_times`); a finished stage's time is the gap to the next entry, the running one is drawn as a dash. Empty where none recorded. */
      enteredAt: Readonly<Partial<Record<StageName, string>>>;
      /** A pass measured again after release, as opposed to the onboarding pass; the side panel heads them differently. */
      remeasure?: boolean;
    }
  | { running: false; degraded: boolean };

interface StageRow {
  setup_stage: string | null;
  setup_stage_times: Record<string, string> | null;
}

/** `sites.setup_stage` is outside the generated `Database` type; the same narrow cast as `release.ts`. */
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

function isStage(value: string | null): value is OnboardingStage {
  return value === FIRST_DRAFT_STAGE || (value !== null && (STAGES as readonly string[]).includes(value));
}

/** One founder's pass as the waiting screen sees it. Reading it latches the release deadline (`isReleased`), so no scheduled job exists in this path.
 *  A released pass that recorded no stage answers with the first stage: a bare spinner is not allowed. */
export async function passProgressFor(
  siteId: string,
  now: Date = new Date()
): Promise<DeepPassProgress> {
  const release = await isReleased(siteId, now);
  if (release.released) {
    // A released founder whose market is being measured again is shown that pass's steps until it ends.
    const { remeasureUnderWay } = await import("./remeasure");
    const stage = await readStage(siteId);
    if ((stage.setup_stage ?? null) === null || !(await remeasureUnderWay(siteId, release.at, now))) {
      return { running: false, degraded: release.reason !== "completed" };
    }
    return { ...running(stage), remeasure: true };
  }
  return running(await readStage(siteId));
}

async function readStage(siteId: string): Promise<StageRow> {
  const { data, error } = await (dbAdmin() as unknown as MinimalClient)
    .from<StageRow>("sites")
    .select("setup_stage, setup_stage_times")
    .eq("id", siteId)
    .limit(1);
  if (error) throw new Error(`passProgressFor: ${error.message}`);
  return data?.[0] ?? { setup_stage: null, setup_stage_times: null };
}

function running(row: StageRow): Extract<DeepPassProgress, { running: true }> {
  const recorded = row.setup_stage ?? null;
  return {
    running: true,
    stage: isStage(recorded) ? recorded : STAGES[0]!,
    // Only the handles this engine knows: a key the column carries that
    // `STAGES` does not name is a stage from an older shape, and a screen
    // that timed it would draw a row it has no name for.
    enteredAt: knownEntries(row.setup_stage_times ?? null),
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

