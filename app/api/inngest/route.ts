import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { scanDemo } from "@/lib/inngest/functions/scan-demo";

export const { GET, POST, PUT } = serve({ client: inngest, functions: [scanDemo] });
