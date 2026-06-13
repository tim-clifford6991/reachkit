import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { scanDemo } from "@/lib/inngest/functions/scan-demo";
import { scanRequested } from "@/lib/inngest/functions/scan-requested";
import { weeklyRefresh } from "@/lib/inngest/functions/weekly-refresh";
import { actionVerifyRequested } from "@/lib/inngest/functions/verify-action";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [scanDemo, scanRequested, weeklyRefresh, actionVerifyRequested],
});
