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

/** The guard `runJob()` applies before a job body runs — so it runs before
 *  the body's first spend and before its first write, structurally, rather
 *  than by each job remembering to ask. */
export function stoppedByKillSwitch(id: JobId): boolean {
  if (!killSwitchEngaged()) return false;
  return (KILL_SWITCH_SCOPE as readonly JobId[]).includes(id);
}
