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
 * POST /api/billing/trial — payment-first trial checkout, Path B (trial-direct).
 *
 * Public (no auth, no scan): the pricing table / marketing CTA posts here so a
 * user can start the trial without ever running a free scan. The account is
 * created from the Stripe-collected email after payment, and the user runs their
 * first scan from inside the dashboard. Rate-limited per IP.
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
    console.error("billing/trial POST error", e);
    return NextResponse.json({ error: "failed to create checkout session" }, { status: 500 });
  }
}
