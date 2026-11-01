// What a draft row's transitions say about the page, read once with the screen's clock, so the draft screen names
// a page exactly as This week does (owner O7).
import type { CopyKey } from "@/lib/presentation/copy";
import { needsYouOf, setAsideOf } from "@/lib/publish/record/needs-you";
import type { Tone } from "@/ui/types";
import { DAY_STATE_COPY_KEY, DAY_STATE_TONE, STAGE_BEACON, STAGE_FILTER_COPY_KEY, STAGE_TONE, stageOf, type Stage, type State } from "../../calendar/stages";

/** A page's stage, or This week's grey *Set aside* day for one the daily re-check set aside; `null` draws no chip. */
export type DraftStage = Stage | "set_aside" | null;

export interface Standing {
  /** Whether §9's record shows the page in review at any point (#1180): a stopped page that never did may be
   *  edited, written again or skipped. */
  enteredReview: boolean;
  /** The stage This week names the page at; absent reads `state` through `STAGE_OF`. */
  stage?: DraftStage;
}

export function standingAtRead(row: { state: State; transitions: unknown; meta: unknown }, at: Date): Required<Standing> {
  return {
    enteredReview: Array.isArray(row.transitions) && row.transitions.some((move: { to?: unknown } | null) => move?.to === "in_review"),
    stage: setAsideOf(row) ? "set_aside" : stageOf({ state: row.state, needsYou: needsYouOf(row) }, at),
  };
}

/** The chip's word, tone and dot for a stage, in This week's words. */
export function stageChipOf(stage: Stage | "set_aside"): { word: CopyKey; tone: Tone; beacon: string } {
  return stage === "set_aside"
    ? { word: DAY_STATE_COPY_KEY.set_aside, tone: DAY_STATE_TONE.set_aside, beacon: "" }
    : { word: STAGE_FILTER_COPY_KEY[stage], tone: STAGE_TONE[stage], beacon: STAGE_BEACON[stage] };
}
