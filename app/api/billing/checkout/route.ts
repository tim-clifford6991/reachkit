import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, AuthError } from "@/lib/auth/server";
import { createCheckout } from "@/lib/billing/checkout";

const Body = z.object({
  plan: z.enum(["solo", "growth"]),
  interval: z.enum(["month", "year"]).optional().default("month"),
});

export async function POST(req: NextRequest) {
  // Auth guard.
  let userId: string;
  try {
    const { user } = await requireUser();
    userId = user.id;
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: "authentication required" }, { status: 401 });
    }
    return NextResponse.json({ error: "unexpected auth error" }, { status: 500 });
  }

  // Parse body.
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid request: plan must be 'solo' or 'growth'" },
      { status: 400 },
    );
  }

  const { plan, interval } = parsed.data;

  // Create checkout session.
  try {
    const { url } = await createCheckout({ userId, plan, interval });
    return NextResponse.json({ url });
  } catch (e) {
    console.error("billing/checkout POST error", e);
    return NextResponse.json({ error: "failed to create checkout session" }, { status: 500 });
  }
}
