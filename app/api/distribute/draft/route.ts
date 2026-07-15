import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, AuthError } from "@/lib/auth/server";
import { assertPaid, EntitlementError } from "@/lib/billing/entitlements";
import { activeAppId } from "@/lib/app/active-app";
import { costedIntelStep } from "@/lib/app/latest-scan";
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
  let viewer: Awaited<ReturnType<typeof requireUser>>;
  try {
    viewer = await requireUser();
    userId = viewer.user.id;
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
    // Invariant #2: this is a paid LLM call — run it under a cost context so the
    // spend bills the user's latest scan (and rolls up to them), instead of
    // writing an unattributable `pipeline_runs.scan_id = NULL` row.
    const appId = await activeAppId(viewer.user);
    const generate = () =>
      generateDraft({ ...parsed.data, platform: parsed.data.platform as DraftPlatform });
    const draft = appId
      ? await costedIntelStep(appId, "distribute-draft", generate)
      : await generate();
    return NextResponse.json({ draft });
  } catch (e) {
    console.error("[distribute/draft] generation failed", e);
    return NextResponse.json({ error: "could not generate a draft — try again" }, { status: 500 });
  }
}
