// The report's one paying control: start checkout with this report's scan as the origin. Neither argument is trusted;
// the session re-reads the scan and allow-lists the return address. The session module loads inside the action so
// rendering a report needs no Stripe or deployment bindings.
"use server";

import { parseDomain } from "@/lib/scan/domain";

export async function startReportCheckout(domain: string, scanId: string): Promise<void> {
  const { startCheckoutFrom } = await import("@/lib/account/checkout/session");
  const parsed = parseDomain(domain);
  await startCheckoutFrom({ kind: "report", scanId }, parsed.ok ? `/scan/${parsed.domain}` : "/pricing");
}
