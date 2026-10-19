// src/app/api/health/route.ts
//
// Transport only: the outside monitor's one question, answered from
// `job_runs` by `jobsHealth`. A request, not a job, so it still answers
// when every job has stopped (RUNBOOK §4).
import { jobs } from "@/jobs";
import { jobsHealth } from "@/jobs/heartbeat";
import { adapter } from "../_adapter";

const ROUTE_ID = "/api/health";

// A cached answer would hold a stopped job system green.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const HEADERS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } as const;

async function answer(withBody: boolean): Promise<Response> {
  const health = await jobsHealth(jobs, new Date());
  const status = health.ok ? 200 : 503;
  return withBody
    ? Response.json(health, { status, headers: HEADERS })
    : new Response(null, { status, headers: HEADERS });
}

export const GET = adapter(ROUTE_ID, () => answer(true));
export const HEAD = adapter(ROUTE_ID, () => answer(false));
