import { NextResponse } from "next/server";
import { requireUser, AuthError, createServerSupabase } from "@/lib/auth/server";
import { deleteAccount, AccountNotFoundError } from "@/lib/account/delete";

/**
 * POST /api/app/account/delete — self-serve account HARD-DELETE (launch P3b).
 *
 * Authenticated-only (401), and can ONLY delete the caller's own account — the
 * target is always `requireUser().user.id`, never a body param, so there is no
 * way to delete someone else. Cancels Stripe, revokes auth, hard-deletes every
 * owned row (see lib/account/delete.ts). Irreversible.
 */
export async function POST() {
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
    const result = await deleteAccount(userId);
    // The auth user is gone; clear the now-stale session cookie best-effort so
    // the browser doesn't carry a dead session (route handlers can write cookies).
    try {
      await (await createServerSupabase()).auth.signOut();
    } catch {
      /* cookie clear is best-effort — the account is already deleted */
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof AccountNotFoundError) {
      return NextResponse.json({ error: "account not found" }, { status: 404 });
    }
    console.error("[account/delete] failed", (e as Error).message);
    return NextResponse.json({ error: "account deletion failed" }, { status: 500 });
  }
}
