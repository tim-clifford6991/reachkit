// src/app/(public)/scan/[domain]/_address/checkout.ts — SPEC §3, BUILD §13 (issue #785)
//
// The report's one paying control: begin checkout with this report's scan
// as the origin, and go wherever the answer says. The twin of
// `/pricing`'s `startCheckout`, differing only in the origin it names and
// the address a buyer returns to.
//
// The scan id and domain are bound by the report that rendered the card.
// Neither is trusted: `resolveOrigin` re-reads the scan and refuses one that
// has no report, provisioning reads the site's domain off that same scan
// row, and the return address is parsed here and allow-listed by
// `createCheckoutSession` against this deployment's own host.
//
// The checkout and env modules are imported inside the action, not at the
// top: `report-view.tsx` imports this file, and rendering a report must not
// need Stripe's or the deployment's bindings loaded.
"use server";

import { redirect } from "next/navigation";
import { parseDomain } from "@/lib/scan/domain";
import { CHECKOUT_QUERY_KEY, REFUSED_MARKER } from "../../../pricing/state";

export async function startReportCheckout(domain: string, scanId: string): Promise<void> {
  const { createCheckoutSession } = await import("@/lib/account/checkout/session");
  const { env } = await import("@/lib/config/env");
  const parsed = parseDomain(domain);
  const reportPath = parsed.ok ? `/scan/${parsed.domain}` : "/pricing";
  const result = await createCheckoutSession({
    origin: { kind: "report", scanId },
    returnTo: new URL(reportPath, env.NEXT_PUBLIC_APP_URL).toString(),
  });
  // Outside any `try`: `redirect` throws its own control-flow error.
  redirect(result.ok ? result.url : `${reportPath}?${CHECKOUT_QUERY_KEY}=${REFUSED_MARKER}`);
}
