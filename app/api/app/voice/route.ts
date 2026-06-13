import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, AuthError } from "@/lib/auth/server";
import { serverDb } from "@/lib/db/client";

/**
 * Founder-voice capture (Cycle 5 Task 6, §11 rule 7).
 *
 * POST { voice: string } stores the raw string on `users.founder_voice` for the
 * authenticated user. `readFounderVoice` (lib/llm/actions) handles a string value
 * directly, injecting it into the FORMAT prompt so action-card drafts adopt the
 * founder's tone. Empty/whitespace clears the value to null.
 */

const Body = z.object({
  // Cap at the raw (pre-trim) length so a giant paste is rejected, not silently
  // truncated. Trimming happens after, to decide store-vs-clear.
  voice: z.string().max(4000),
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
      { error: "invalid request: voice must be a string of at most 4000 characters" },
      { status: 400 },
    );
  }

  // Trim; empty/whitespace clears the value to null.
  const trimmed = parsed.data.voice.trim();
  const value = trimmed.length > 0 ? trimmed : null;

  const { error } = await serverDb()
    .from("users")
    .update({ founder_voice: value })
    .eq("id", userId);

  if (error) {
    console.error("app/voice POST error", error);
    return NextResponse.json({ error: "failed to save founder voice" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
