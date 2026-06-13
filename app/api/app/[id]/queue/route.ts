import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth/server";
import { assertPaid, EntitlementError } from "@/lib/billing/entitlements";
import { assembleWeeklyPlan } from "@/lib/scan/weekly-plan";

/** The authenticated user shape returned by `requireUser` (its `.user`). */
type AuthedUser = Awaited<ReturnType<typeof requireUser>>["user"];

/**
 * Weekly action-queue API (Cycle 4 Task 12, §10.3) — the read sibling of the
 * manual-refresh endpoint. Returns the assembled WeeklyPlan for an app the
 * caller owns and is entitled to.
 *
 * Gating, in order:
 *   1. Authenticated user (else 401).
 *   2. Ownership — `user.app_ids` includes the id (else 404, NOT 403: we don't
 *      leak whether an app the caller doesn't own exists).
 *   3. Active paid subscription (else 402 "upgrade required" — the queue is a
 *      paid surface).
 * Then assemble the §10.3 plan and return it. Unexpected failures → 500.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  // 2. Ownership — 404 (not 403) so we don't leak existence of others' apps.
  const { id: appId } = await params;
  if (!user.app_ids.includes(appId)) {
    return NextResponse.json({ message: "app not found" }, { status: 404 });
  }

  // 3. Paid entitlement — the queue is a paid surface.
  try {
    await assertPaid(user.id);
  } catch (e) {
    if (e instanceof EntitlementError) {
      return NextResponse.json({ message: "upgrade required" }, { status: 402 });
    }
    return NextResponse.json({ message: "unexpected entitlement error" }, { status: 500 });
  }

  // 4. Assemble + return the §10.3 weekly plan.
  try {
    const plan = await assembleWeeklyPlan(appId);
    return NextResponse.json(plan);
  } catch (e) {
    console.error("app/[id]/queue GET error", e);
    return NextResponse.json({ message: "failed to assemble queue" }, { status: 500 });
  }
}
