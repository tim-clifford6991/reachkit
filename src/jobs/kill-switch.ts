// src/jobs/kill-switch.ts — BUILD §11 bounds
//
// `BUILD.md` §11: "kill switch env var stops scan+generate+publish". The
// scope is those ids and no others — a stop that also held
// `publish/verify` would leave a published page unchecked, and a stop that
// held `account/maintenance` would hold a purge, withhold a hosting notice
// and strand a paid customer waiting for a sign-in link. Widening this set
// is the mutation `tests/jobs/kill-switch.test.ts` fails on.
//
// The switch is an environment binding an operator sets. Nothing here
// decides *when* it is engaged.
import { env } from "@/lib/config/env";
import type { JobId } from "./types";

/** The ids §11 names, closed. `publish/retry` is one of them (issue #200):
 *  it is the same delivery `publish/execute` makes, occasioned by a clock
 *  rather than by an approval, and a stop that held one and not the other
 *  would stop publishing for a page a customer approved while letting one
 *  that failed go out. */
export const KILL_SWITCH_SCOPE = Object.freeze([
  "scan/run",
  "draft/generate",
  "publish/execute",
  "publish/retry",
] as const) satisfies readonly JobId[];

/** Reads `KILL_SWITCH` through `env`, which parses it once at boot. Read
 *  per call rather than captured, so a redeploy that flips the binding
 *  takes effect on the next invocation. */
export function killSwitchEngaged(): boolean {
  return env.KILL_SWITCH;
}

/** What this process last saw the switch reading. `null` until it has
 *  looked once. */
let lastObserved: boolean | null = null;

/**
 * Looks at the switch and says whether this process has just found it
 * engaged for the first time — `null` otherwise.
 *
 * **Why this reports an engagement and never a release.** `KILL_SWITCH` is
 * an environment binding `env` parses once at boot, so within one process
 * it cannot change: a flip is a redeploy, and the only transition anything
 * here can witness is a *new* process's first look. A first look that
 * finds the switch engaged is that transition — the deployment carrying it
 * is the flip — and is reported. A first look that finds it off is
 * indistinguishable from every ordinary cold start, so it is reported by
 * nothing: a release can only be told apart from an ordinary boot by a
 * durable record of what the last process saw, and BUILD §10 gives this
 * product no table to keep one in ("a 10th table needs a rendered surface
 * that reads it, specified first"). Reporting the release is therefore
 * owed, not built — it waits on somewhere to remember (issue #329's PR
 * names it).
 *
 * The other consequence, stated rather than hidden: while the switch is
 * engaged, each new process reports the engagement once, so a scaled
 * deployment can tell the owner about one flip more than once. That is the
 * failure this trades for never reporting it at all, and it is bounded —
 * only the job runner asks (`run.ts`), so the processes that can report
 * are the few that run work rather than the many that serve screens.
 */
export function observeKillSwitchEngaged(): boolean {
  const engaged = killSwitchEngaged();
  const first = lastObserved === null;
  lastObserved = engaged;
  return first && engaged;
}

/** Puts this process back to having never looked — a test fixture, and the
 *  only writer of that state besides `observeKillSwitchEngaged` itself. */
export function __resetKillSwitchObservationForTesting(): void {
  lastObserved = null;
}

/** The guard `runJob()` applies before a job body runs — so it runs before
 *  the body's first spend and before its first write, structurally, rather
 *  than by each job remembering to ask. */
export function stoppedByKillSwitch(id: JobId): boolean {
  if (!killSwitchEngaged()) return false;
  return (KILL_SWITCH_SCOPE as readonly JobId[]).includes(id);
}
