import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { scanDemo } from "@/lib/inngest/functions/scan-demo";
import { scanRequested } from "@/lib/inngest/functions/scan-requested";

export const { GET, POST, PUT } = serve({ client: inngest, functions: [scanDemo, scanRequested] });
