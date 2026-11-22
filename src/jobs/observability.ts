// src/jobs/observability.ts — BUILD §11
//
// One structured line per invocation, carrying four fields — job id,
// subject id, outcome, duration — plus, for a `degraded` outcome, which
// step degraded. Nothing else is ever emitted: not the event payload, not
// a vendor response, not an error message. The allow-list below is the
// whole line, and `tests/jobs/registry.test.ts` fails on a fifth field.
//
// `console.log` is this module's log channel, the same one
// `src/lib/scan/admission.ts` uses for its own decisions. Reversal cost if
// a logging seam lands: one call site.
import type { JobId, Outcome, SubjectId } from "./types";

/** The outcomes a line can carry. `failed` is not an `Outcome` — a job
 *  body that threw has no outcome to report, and the line says so without
 *  repeating what was thrown. */
export type LoggedOutcome = Outcome["outcome"] | "failed";

export interface Invocation {
  readonly jobId: JobId;
  readonly subjectId: SubjectId;
  readonly outcome: LoggedOutcome;
  readonly durationMs: number;
  /** Present only on `degraded` or a `stopped` the body chose; the name of the step, never a payload. */
  readonly step?: string;
}

/** The exact field set. A line is built from this and nothing else. */
export const LINE_FIELDS = Object.freeze([
  "event",
  "jobId",
  "subjectId",
  "outcome",
  "durationMs",
  "step",
] as const);

export function lineFor(invocation: Invocation): Record<string, unknown> {
  const line: Record<string, unknown> = {
    event: "job",
    jobId: invocation.jobId,
    subjectId: invocation.subjectId,
    outcome: invocation.outcome,
    durationMs: invocation.durationMs,
  };
  if ((invocation.outcome === "degraded" || invocation.outcome === "stopped") && invocation.step !== undefined) {
    line.step = invocation.step;
  }
  return line;
}

export function recordInvocation(invocation: Invocation): void {
  console.log(JSON.stringify(lineFor(invocation)));
}
