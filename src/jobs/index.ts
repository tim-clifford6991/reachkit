// src/jobs/index.ts — BUILD §11
//
// The registry: a closed array of exactly the ten job definitions, and
// the handler set that serves them. The registry is closed on purpose — an
// open one, where a job registers itself, means the first job that forgets
// is the one with no kill switch and no cap. A definition not in `jobs` is
// unreachable over HTTP.
//
// This file names no platform and holds no job logic: it imports the ten
// definitions and hands them to `serveJobs()`.
import { serveJobs } from "./client";
import { installHeartbeat } from "./heartbeat";
import { scanRun } from "./scan-run";
import { draftGenerate } from "./draft-generate";
import { publishExecute } from "./publish-execute";
import { publishVerify } from "./publish-verify";
import { publishRetry } from "./publish-retry";
import { weeklyRefresh } from "./weekly-refresh";
import { leadNurture } from "./lead-nurture";
import { accountMaintenance } from "./account-maintenance";
import { scanRescore } from "./scan-rescore";
import { scanFinishReads } from "./scan-finish-reads";
import type { JobDefinition } from "./types";

/** Ten, in `JOB_IDS` order. */
export const jobs: readonly JobDefinition[] = Object.freeze([
  scanRun,
  draftGenerate,
  publishExecute,
  publishVerify,
  publishRetry,
  weeklyRefresh,
  leadNurture,
  accountMaintenance,
  scanRescore,
  scanFinishReads,
]);

/** Mounting the registry is also what installs the heartbeat (issue #799):
 *  where jobs are served, each run is recorded against this schedule. */
export function serve() {
  installHeartbeat(jobs);
  return serveJobs(jobs);
}

export type { JobDefinition, JobId, JobInput, Outcome } from "./types";
