import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth/server";
import { createPortalSession } from "@/lib/billing/portal";

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
    console.error("billing/portal POST error", e);
    return NextResponse.json({ error: "failed to create portal session" }, { status: 500 });
  }
}
