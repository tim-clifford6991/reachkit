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

/** The platform's ceiling on one invocation of a job step, in seconds
 *  (issue 798) — the same bound `POST /api/scan` declares, and
 *  `TIMING.platformCeilingS` pins it. Unset, a job ran under the plan's
 *  default, shorter than a paid pass. The onboarding pass is split into
 *  steps (`runDeepPass`) so each fits inside it on its own. A literal:
 *  Next reads route segment config out of the source at build time. */
export const maxDuration = 60;
const handlers = serve();

export const GET = adapter(ROUTE_ID, handlers.GET);
export const POST = adapter(ROUTE_ID, handlers.POST);
export const PUT = adapter(ROUTE_ID, handlers.PUT);
