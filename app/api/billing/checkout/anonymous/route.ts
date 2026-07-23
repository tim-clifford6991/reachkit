import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAnonymousCheckout } from "@/lib/billing/checkout";
import { hashIp, ipFromRequest } from "@/lib/scan/abuse";
import { rateLimitAllow, CHECKOUT_PER_IP } from "@/lib/auth/rate-limit";

/**
 * POST /api/billing/checkout/anonymous — payment-first checkout, Path B
 * (direct checkout; formerly /api/billing/trial — renamed 2026-07-16, the
 * trial itself was removed in P2/#62 and plans charge immediately).
 *
 * Public (no auth, no scan): the pricing table / marketing CTA posts here so a
 * user can subscribe without ever running a free scan. The account is created
 * from the Stripe-collected email after payment, and the user runs their first
 * scan from inside the dashboard. Rate-limited per IP. The authed sibling
 * (`../route.ts`) is the in-app upgrade path; this one is anonymous —
 * `createAnonymousCheckout` collects the email in Stripe.
 */
const Body = z.object({
  plan: z.enum(["solo", "growth"]).default("solo"),
  interval: z.enum(["month", "year"]).default("month"),
});

export async function POST(req: NextRequest) {
  // Real per-IP cap on session creation (the old scans-table limiter never
  // incremented here — it counted a table this route doesn't write).
  const ipHash = hashIp(ipFromRequest(req));
  if (!rateLimitAllow(`checkout:ip:${ipHash}`, CHECKOUT_PER_IP)) {
    return NextResponse.json({ error: "rate limit — try again later" }, { status: 429 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid plan/interval" }, { status: 400 });
  }

  try {
    const { url } = await createAnonymousCheckout({
      plan: parsed.data.plan,
      interval: parsed.data.interval,
    });
    return NextResponse.json({ url });
  } catch (e) {
    console.error("billing/checkout/anonymous POST error", e);
    return NextResponse.json({ error: "failed to create checkout session" }, { status: 500 });
  }
}
