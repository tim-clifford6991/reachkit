import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, AuthError } from "@/lib/auth/server";
import { assertPaid, EntitlementError } from "@/lib/billing/entitlements";
import { serverDb } from "@/lib/db/client";
import { inngest } from "@/lib/inngest/client";

/** The authenticated user shape returned by `requireUser` (its `.user`). */
type AuthedUser = Awaited<ReturnType<typeof requireUser>>["user"];

const Body = z.object({
  // Optional: the URL the founder shipped (overwrites the action's verify_url).
  verify_url: z.string().url().optional(),
});

/**
 * Mark an action complete → kick off verification (Cycle 4 Task 14, §10.4).
 *
 * POST { verify_url? }
 *
 * Gating, in order:
 *   1. Authenticated user (else 401).
 *   2. Ownership — the action's app_id is in user.app_ids (else 404; we don't
 *      leak whether an action the caller doesn't own exists).
 *   3. Active paid subscription (else 402 — completing/verifying is a paid surface).
 *
 * Then: persist verify_url (if given) + verify_state="pending", emit the
 * "action/verify" Inngest event (the async verify → outcomes → score-move flow),
 * and return { ok: true }. The heavy work happens off the request path.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: actionId } = await params;
  if (!actionId) {
    return NextResponse.json({ message: "missing action id" }, { status: 400 });
  }

  // 0. Parse the (optional) body. An empty/malformed body is fine (verify_url omitted).
  const raw = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(raw ?? {});
  if (!parsed.success) {
    return NextResponse.json({ message: "invalid verify_url" }, { status: 400 });
  }
  const verifyUrl = parsed.data.verify_url;

  // 1. Auth.
  let user: AuthedUser;
  try {
    ({ user } = await requireUser());
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ message: "authentication required" }, { status: 401 });
    }
    return NextResponse.json({ message: "unexpected auth error" }, { status: 500 });
  }

  const db = serverDb();

  // 2. Ownership — load the action's app_id and check it's the caller's.
  //    404 (not 403) so we don't leak existence of others' actions.
  const { data: action, error: loadErr } = await db
    .from("actions")
    .select("id, app_id")
    .eq("id", actionId)
    .maybeSingle();
  if (loadErr) {
    return NextResponse.json({ message: "failed to load action" }, { status: 500 });
  }
  if (!action || !user.app_ids.includes(action.app_id)) {
    return NextResponse.json({ message: "action not found" }, { status: 404 });
  }

  // 3. Paid entitlement — completing/verifying is a paid surface.
  try {
    await assertPaid(user.id);
  } catch (e) {
    if (e instanceof EntitlementError) {
      return NextResponse.json({ message: "upgrade required" }, { status: 402 });
    }
    return NextResponse.json({ message: "unexpected entitlement error" }, { status: 500 });
  }

  // 4. Persist verify_url (if provided) + flip verify_state to pending.
  const update: { verify_state: string; verify_url?: string } = { verify_state: "pending" };
  if (verifyUrl !== undefined) update.verify_url = verifyUrl;

  const { error: updErr } = await db.from("actions").update(update).eq("id", actionId);
  if (updErr) {
    return NextResponse.json({ message: "failed to mark action pending" }, { status: 500 });
  }

  // 5. Kick off async verification.
  await inngest.send({ name: "action/verify", data: { actionId } });

  return NextResponse.json({ ok: true });
}
