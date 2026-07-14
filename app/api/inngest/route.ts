import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { env } from "@/lib/config/env";

// Force the env parse when this route module loads. lib/config/env.ts now
// REQUIRES INNGEST_SIGNING_KEY in production, so a prod deploy missing it throws
// here instead of serving an unauthenticated invocation endpoint. `serve()`
// reads the key from process.env automatically to verify invocation signatures.
void env.inngestSigningKey;
import { scanDemo } from "@/lib/inngest/functions/scan-demo";
import { scanRequested } from "@/lib/inngest/functions/scan-requested";
import { scanDeepen } from "@/lib/inngest/functions/scan-deepen";
import { weeklyRefresh } from "@/lib/inngest/functions/weekly-refresh";
import { actionVerifyRequested } from "@/lib/inngest/functions/verify-action";
import { searchCacheCleanup } from "@/lib/inngest/functions/search-cache-cleanup";
import { scorePulse } from "@/lib/inngest/functions/score-pulse";

// Scans run multi-minute durable steps; pin to 300s so a single step is not
// cut off by Vercel's lower default function timeout.
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [scanDemo, scanRequested, scanDeepen, weeklyRefresh, actionVerifyRequested, searchCacheCleanup, scorePulse],
});
