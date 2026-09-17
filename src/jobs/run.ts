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
import { beat } from "./heartbeat";
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

/** Issue 330: tells `OWNER_EMAILS`. Imported at the call, like the switch's
 *  report above, and swallowed: an alert never fails the invocation or
 *  changes what it rethrows. */
async function reportToOwners(
  incident: { occasion: "job-failed"; jobId: string; attempt: number; error: unknown } | { occasion: "dead-lettered"; jobId: string; error: unknown }
): Promise<void> {
  try {
    const { errorNameOf, reportIncident } = await import("@/lib/mail/ops");
    const errorName = errorNameOf(incident.error);
    await reportIncident(
      incident.occasion === "job-failed"
        ? { occasion: "job-failed", jobId: incident.jobId, attempt: incident.attempt, errorName }
        : { occasion: "dead-lettered", jobId: incident.jobId, errorName }
    );
  } catch {
    console.warn(JSON.stringify({ event: "ops_incident_alert", occasion: incident.occasion, outcome: "threw" }));
  }
}

/**
 * The platform gave up on a job: every retry failed (issue 330's
 * dead-letter). Called from the platform's failure handler in `client.ts`.
 */
export async function reportDeadLettered(jobId: string, error: unknown): Promise<void> {
  await reportToOwners({ occasion: "dead-lettered", jobId, error });
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
    await beat(definition.id, "stopped", input.now);
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
    // Issue #799: the job's last run and outcome, and the stale-job check.
    await beat(definition.id, outcome.outcome, input.now);
    return outcome;
  } catch (error) {
    recordInvocation({
      jobId: definition.id,
      subjectId: null,
      outcome: "failed",
      durationMs: Date.now() - started,
    });
    await beat(definition.id, "failed", input.now);
    // Issue 330: the owner hears of a failing job on its first delivery
    // only — a retry that fails again is the same failure, and one whose
    // retries run out is told once more, as dead-lettered.
    if ((input.attempt ?? 0) === 0) {
      await reportToOwners({ occasion: "job-failed", jobId: definition.id, attempt: 0, error });
    }
    throw error;
  }
}
