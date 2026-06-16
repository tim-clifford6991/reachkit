import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, AuthError } from "@/lib/auth/server";
import { assertPaid, EntitlementError } from "@/lib/billing/entitlements";
import { generateDraft, type DraftPlatform } from "@/lib/scan/distribute/draft";

// Drafting is paid-only and on-demand (only what the user wants to post), so the
// scan never pre-generates drafts it doesn't need.
const Body = z.object({
  platform: z.string().min(1),
  productName: z.string().min(1),
  productDescription: z.string().optional(),
  angle: z.string().min(1),
  url: z.string().url().optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  let userId: string;
  try {
    ({ user: { id: userId } } = await requireUser());
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "sign in required" }, { status: 401 });
    return NextResponse.json({ error: "auth error" }, { status: 500 });
  }
  try {
    await assertPaid(userId);
  } catch (e) {
    if (e instanceof EntitlementError) return NextResponse.json({ error: "upgrade required" }, { status: 403 });
    return NextResponse.json({ error: "entitlement error" }, { status: 500 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid request" }, { status: 400 });

  try {
    const draft = await generateDraft({
      ...parsed.data,
      platform: parsed.data.platform as DraftPlatform,
    });
    return NextResponse.json({ draft });
  } catch (e) {
    console.error("[distribute/draft] generation failed", e);
    return NextResponse.json({ error: "could not generate a draft — try again" }, { status: 500 });
  }
}
