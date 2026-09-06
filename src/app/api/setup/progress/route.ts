// src/app/api/setup/progress/route.ts — BUILD §4.3
//
// "While the deep pass runs: progress screen" (§4.3). The waiting screen
// asks this route which step is under way; the answer carries a stage or
// the fact that the pass ended, and never a duration, estimate, countdown,
// clock or percentage — `PassProgress` has no member that could hold one.
//
// A transport adapter over `readPassProgress()`. It performs no vendor
// call, no measurement and no write. `siteId` is the session's, never the
// query string's — there is no parameter on this route at all, which is
// the strongest form of that property.
import { adapter } from "../../_adapter";
import { readPassProgress } from "@/app/(account)/setup/_setup/provider";
import type { PassProgress } from "@/app/(account)/setup/_setup/progress";

export const GET = adapter("GET /api/setup/progress", async (): Promise<Response> => {
  const progress: PassProgress = await readPassProgress();
  return Response.json(progress);
});
