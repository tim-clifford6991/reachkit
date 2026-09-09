// src/jobs/run.ts — BUILD §11
//
// The one path every invocation takes: the kill-switch guard, then the
// body, then the log line. The guard lives here rather than inside each of
// the seven definitions so "before any spend and before any write" is a
// structural property of the runner — a new job cannot forget it, and the
// first unguarded job is not the one with no kill switch.
//
// A body that throws is logged as `failed` and rethrown: the platform's
// own retry and its dashboard are what a failure is for, and swallowing it
// here would turn a broken engine into a silent success.
import { observeKillSwitchEngaged, stoppedByKillSwitch } from "./kill-switch";
import { recordInvocation } from "./observability";
import type { JobDefinition, JobInput, Outcome } from "./types";

/** Never throws and never delays a job it has nothing to say about: an
 *  alerting path that could fail an invocation would make the switch worse
 *  to use than not having it. */
async function reportFlip(): Promise<void> {
  if (!observeKillSwitchEngaged()) return;
  try {
    const { reportKillSwitchEngaged } = await import("@/lib/mail/ops");
    await reportKillSwitchEngaged();
  } catch (error) {
    console.warn(JSON.stringify({ event: "kill_switch_alert_failed", detail: String(error) }));
  }
}

export async function runJob(definition: JobDefinition, input: JobInput): Promise<Outcome> {
  const started = Date.now();

  // The switch, before the guard reads it (issue #329): every invocation
  // passes here, stopped or not, so a job the switch stops still reports
  // it — the news is the switch, not the job. At most once per process;
  // see `observeKillSwitchEngaged` for what that can and cannot see (it
  // reports an engagement and never a release). The mail module
  // is imported at the call and only when there is something to say: it
  // reaches `@/lib/db` behind `sendEmail`, and a static import would put a
  // database client on the runner's own module graph.
  await reportFlip();

  if (stoppedByKillSwitch(definition.id)) {
    const outcome: Outcome = { outcome: "stopped", subjectId: null, by: "kill-switch" };
    recordInvocation({
      jobId: definition.id,
      subjectId: null,
      outcome: "stopped",
      durationMs: Date.now() - started,
    });
    return outcome;
  }

  try {
    const outcome = await definition.run(input);
    recordInvocation({
      jobId: definition.id,
      subjectId: outcome.subjectId,
      outcome: outcome.outcome,
      durationMs: Date.now() - started,
      ...(outcome.outcome === "degraded" ? { step: outcome.step } : {}),
    });
    return outcome;
  } catch (error) {
    recordInvocation({
      jobId: definition.id,
      subjectId: null,
      outcome: "failed",
      durationMs: Date.now() - started,
    });
    throw error;
  }
}
