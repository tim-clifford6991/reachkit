import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { serverDb } from "@/lib/db/client";
import { createAnonymousCheckout } from "@/lib/billing/checkout";
import { hashIp, ipFromRequest } from "@/lib/scan/abuse";
import { rateLimitAllow, CHECKOUT_PER_IP } from "@/lib/auth/rate-limit";

/**
 * POST /api/scan/[id]/checkout — payment-first trial checkout, Path A (scan-first).
 *
 * Public (no auth): the account is created from the Stripe-collected email after
 * payment. The scanId is bound so the scanned app lands in the new user's
 * dashboard. Rate-limited per IP (public, account-creating endpoint).
 */
const Body = z.object({
  plan: z.enum(["solo", "growth"]).default("solo"),
  interval: z.enum(["month", "year"]).default("month"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "missing scan id" }, { status: 400 });

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

  // Validate the scan exists before opening a checkout against it.
  const { data: scan } = await serverDb()
    .from("scans")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!scan) return NextResponse.json({ error: "scan not found" }, { status: 404 });

  try {
    const { url } = await createAnonymousCheckout({
      scanId: id,
      plan: parsed.data.plan,
      interval: parsed.data.interval,
    });
    return NextResponse.json({ url });
  } catch (e) {
    console.error("scan/checkout POST error", e);
    return NextResponse.json({ error: "failed to create checkout session" }, { status: 500 });
  }
}
