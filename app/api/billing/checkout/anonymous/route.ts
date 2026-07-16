import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAnonymousCheckout } from "@/lib/billing/checkout";
import {
  AbuseError,
  assertRateLimit,
  hashIp,
  ipFromRequest,
} from "@/lib/scan/abuse";

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
  const ipHash = hashIp(ipFromRequest(req));
  try {
    await assertRateLimit(ipHash);
  } catch (e) {
    if (e instanceof AbuseError) {
      return NextResponse.json({ error: "rate limit — try again later" }, { status: 429 });
    }
    throw e;
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
