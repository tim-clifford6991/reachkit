import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";

// Signature verification: `serve()` reads INNGEST_SIGNING_KEY from process.env
// and verifies every invocation with it. lib/config/env.ts REQUIRES that key in
// production (PAID_KEYS) — enforced at the first env access on any real request —
// so a prod deploy missing it fails rather than serving this endpoint unsigned.
// (Not forced at module load: that would run during `next build` page-data
// collection, where the key isn't set, and break the build.)
import { scanDemo } from "@/lib/inngest/functions/scan-demo";
import { scanRequested } from "@/lib/inngest/functions/scan-requested";
import { scanDeepen } from "@/lib/inngest/functions/scan-deepen";
import { weeklyRefresh } from "@/lib/inngest/functions/weekly-refresh";
import { actionVerifyRequested } from "@/lib/inngest/functions/verify-action";
import { searchCacheCleanup } from "@/lib/inngest/functions/search-cache-cleanup";
import { scorePulse } from "@/lib/inngest/functions/score-pulse";
import { dailyFocus } from "@/lib/inngest/functions/daily-focus";

// Scans run multi-minute durable steps; pin to 300s so a single step is not
// cut off by Vercel's lower default function timeout.
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [scanDemo, scanRequested, scanDeepen, weeklyRefresh, actionVerifyRequested, searchCacheCleanup, scorePulse, dailyFocus],
});
