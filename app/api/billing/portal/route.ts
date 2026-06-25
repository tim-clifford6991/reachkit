import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth/server";
import { createPortalSession, NoBillingAccountError } from "@/lib/billing/portal";

export async function POST(): Promise<NextResponse> {
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

  try {
    const { url } = await createPortalSession(userId);
    return NextResponse.json({ url });
  } catch (e) {
    // Clear, user-facing condition (no Stripe customer to manage) → 400, not 500.
    if (e instanceof NoBillingAccountError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("billing/portal POST error", e);
    return NextResponse.json({ error: "failed to create portal session" }, { status: 500 });
  }
}
