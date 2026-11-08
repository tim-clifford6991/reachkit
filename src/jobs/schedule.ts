// src/jobs/schedule.ts — the registry's cron jobs, without loading a job: what `/api/health` judges.
// `tests/jobs/schedule.test.ts` holds it equal to the registry, so a cron changed in a job file turns it red.
import type { JobDefinition } from "./types";

export const CRON_JOBS: readonly Pick<JobDefinition, "id" | "trigger">[] = [
  { id: "draft/generate", trigger: { kind: "cron", cron: "3 * * * *" } },
  { id: "publish/retry", trigger: { kind: "cron", cron: "0 * * * *" } },
  { id: "weekly/refresh", trigger: { kind: "cron", cron: "41 * * * *" } },
  { id: "lead/nurture", trigger: { kind: "cron", cron: "26 * * * *" } },
  { id: "account/maintenance", trigger: { kind: "cron", cron: "*/15 * * * *" } },
  { id: "scan/rescore", trigger: { kind: "cron", cron: "7,22,37,52 * * * *" } },
];
