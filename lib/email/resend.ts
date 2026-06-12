import { Resend } from "resend";
import { env } from "@/lib/config/env";

export function resendClient() {
  return new Resend(env.resendApiKey);
}

/**
 * Placeholder — wired in Cycle 3 when the confirmed user reaches the results page.
 * Sends a "your report is ready" email with a link back to the full scan.
 */
export async function sendScanReadyEmail(_opts: {
  to: string;
  scanId: string;
  appName: string;
}): Promise<void> {
  // TODO(Cycle 3): compose and send via resendClient()
}
