// src/app/api/jobs/[[...slug]]/route.ts — BUILD §11
//
// Transport only. This route registers nothing: it mounts the closed
// registry in `src/jobs/` and adds the one request log line every
// `src/app/api/**` route emits. It holds no job, no trigger and no schedule
// — a job that is not in `jobs` is not reachable through here.
//
// The optional catch-all segment is the platform's own address space: the
// handler set answers `/api/jobs` and every path beneath it with the same
// three methods.
import { serve } from "@/jobs";
import { adapter } from "../../_adapter";

const ROUTE_ID = "/api/jobs";

// The ceiling on one invocation of a job step, in seconds (issue 798) —
// `TIMING.jobsCeilingS` pins it. It is the project's fluid-compute default
// and the plan's ceiling, not the free request path's 60: the onboarding
// pass's measurement step buys every question's SERPs and answers in one
// invocation and needs the room. A literal: Next reads route segment
// config out of the source at build time.
export const maxDuration = 300;

const handlers = serve();

export const GET = adapter(ROUTE_ID, handlers.GET);
export const POST = adapter(ROUTE_ID, handlers.POST);
export const PUT = adapter(ROUTE_ID, handlers.PUT);
