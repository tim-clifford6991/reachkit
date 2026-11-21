// The report's one paying control: start checkout with this report's scan as the origin. Neither argument is trusted;
// the session re-reads the scan and allow-lists the return address. Server-only modules load inside the action so
// rendering a report needs no Stripe or deployment bindings.
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { parseDomain } from "@/lib/scan/domain";
import { CHECKOUT_QUERY_KEY, REFUSED_MARKER } from "../../../pricing/state";

export async function startReportCheckout(domain: string, scanId: string): Promise<void> {
  const { createCheckoutSession } = await import("@/lib/account/checkout/session");
  const { env } = await import("@/lib/config/env");
  const { takeLimits } = await import("@/lib/limits");
  const { networkKeyOf } = await import("@/lib/scan/admission");
  const parsed = parseDomain(domain);
  const reportPath = parsed.ok ? `/scan/${parsed.domain}` : "/pricing";
  const admitted = await takeLimits("checkout", { network: networkKeyOf(await headers()) });
  const result = admitted
    ? await createCheckoutSession({ origin: { kind: "report", scanId }, returnTo: new URL(reportPath, env.NEXT_PUBLIC_APP_URL).toString() })
    : { ok: false as const };
  // Outside any `try`: `redirect` throws its own control-flow error.
  redirect(result.ok ? result.url : `${reportPath}?${CHECKOUT_QUERY_KEY}=${REFUSED_MARKER}`);
}
