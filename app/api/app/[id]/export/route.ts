import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth/server";
import { assertPaid, EntitlementError } from "@/lib/billing/entitlements";
import { serverDb } from "@/lib/db/client";
import { reportToCsv } from "@/lib/scan/export-csv";
import type { ReportPayload } from "@/lib/scan/report";

/**
 * CSV export of an app's latest report (ChannelIntel Phase 4) — the paid
 * "exportable lists" deliverable.
 *
 * Gating mirrors the refresh route: authenticated (401) + owns the app (404) +
 * active paid subscription (402). Streams a multi-section CSV (competitors,
 * keyword gap, demand pockets, ranked playbook) as a file download.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: appId } = await params;
  if (!appId) return NextResponse.json({ error: "missing app id" }, { status: 400 });

  // 1. Auth.
  let userId: string;
  let appIds: string[];
  try {
    const { user } = await requireUser();
    userId = user.id;
    appIds = user.app_ids ?? [];
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: "authentication required" }, { status: 401 });
    }
    return NextResponse.json({ error: "unexpected auth error" }, { status: 500 });
  }

  // 2. Ownership.
  if (!appIds.includes(appId)) {
    return NextResponse.json({ error: "app not found" }, { status: 404 });
  }

  // 3. Paid entitlement.
  try {
    await assertPaid(userId);
  } catch (e) {
    if (e instanceof EntitlementError) {
      return NextResponse.json({ error: "upgrade required" }, { status: 402 });
    }
    return NextResponse.json({ error: "unexpected entitlement error" }, { status: 500 });
  }

  // 4. Latest scan's report payload.
  const db = serverDb();
  const { data: scanRow, error } = await db
    .from("scans")
    .select("report_payload")
    .eq("app_id", appId)
    .not("report_payload", "is", null)
    .order("started_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "failed to load report" }, { status: 500 });
  if (!scanRow?.report_payload) {
    return NextResponse.json({ error: "no report to export yet" }, { status: 409 });
  }

  const csv = reportToCsv(scanRow.report_payload as unknown as ReportPayload);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="reachkit-${appId}.csv"`,
    },
  });
}
