import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth/server";
import { exportAccount } from "@/lib/account/export";
import { AccountNotFoundError } from "@/lib/account/delete";

/**
 * GET /api/app/account/export — self-serve GDPR data export (launch P3b).
 *
 * Authenticated-only (401); always exports the caller's own data
 * (`requireUser().user.id`, never a param). Streams the full JSON dump as a file
 * download. Unlike /api/app/[id]/export (paid CSV of one app's report), this is
 * the whole-account portability export and is available to any signed-in user.
 */
export async function GET() {
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
    const data = await exportAccount(userId);
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="reachkit-account-export.json"`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof AccountNotFoundError) {
      return NextResponse.json({ error: "account not found" }, { status: 404 });
    }
    console.error("[account/export] failed", (e as Error).message);
    return NextResponse.json({ error: "export failed" }, { status: 500 });
  }
}
