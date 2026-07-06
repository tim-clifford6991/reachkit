import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth/server";
import { activeAppId } from "@/lib/app/active-app";
import { entitlementsFor } from "@/lib/billing/entitlements";
import { linkScanToUser } from "@/lib/auth/profile";
import { serverDb } from "@/lib/db/client";
import { inngest } from "@/lib/inngest/client";
import { slugForScan } from "@/lib/scan/scan-slug";

/**
 * Run a single scan for the user's *current* tracked app — the on-demand "Scan
 * this product now" action shown on the dashboard when the active app has no
 * completed scan yet (e.g. right after switching the tracked product). Scans by
 * app id (not URL) so it always targets the freshly-switched app, and reuses an
 * already-in-flight scan instead of queuing a duplicate. No onboarding, one scan.
 */
export async function POST(): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireUser>>["user"];
  try {
    ({ user } = await requireUser());
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: "authentication required" }, { status: 401 });
    }
    return NextResponse.json({ error: "unexpected auth error" }, { status: 500 });
  }

  const userId = user.id;
  const appId = await activeAppId(user);
  if (!appId) {
    return NextResponse.json({ error: "no tracked product" }, { status: 400 });
  }

  const db = serverDb();
  const { data: app, error: appErr } = await db
    .from("apps")
    .select("store_url, platform")
    .eq("id", appId)
    .maybeSingle();
  if (appErr) return NextResponse.json({ error: "failed to load app" }, { status: 500 });
  if (!app?.store_url) return NextResponse.json({ error: "tracked product has no URL" }, { status: 400 });

  // Reuse an in-flight scan (queued/running) rather than queuing a duplicate —
  // guards against a double-click or an eager retry re-spending the pipeline.
  const { data: inflight } = await db
    .from("scans")
    .select("id")
    .eq("app_id", appId)
    .not("status", "in", "(done,failed,degraded)")
    .order("started_at", { ascending: false, nullsFirst: true })
    .limit(1)
    .maybeSingle();
  if (inflight) {
    const slug = slugForScan({ storeUrl: app.store_url, platform: app.platform, scanId: inflight.id });
    return NextResponse.json({ scan_id: inflight.id, slug, inflight: true });
  }

  // Paid owners get the deep ('full') track; otherwise the free teaser.
  const paid = (await entitlementsFor(userId)).active;
  const tier: "free" | "full" = paid ? "full" : "free";

  const { data: scan, error: scanErr } = await db
    .from("scans")
    .insert({ app_id: appId, status: "queued", tier })
    .select("id")
    .single();
  if (scanErr || !scan) {
    return NextResponse.json({ error: "failed to start scan" }, { status: 500 });
  }

  await linkScanToUser(scan.id, userId);
  await inngest.send({ name: "scan/requested", data: { scanId: scan.id } });

  const slug = slugForScan({ storeUrl: app.store_url, platform: app.platform, scanId: scan.id });
  return NextResponse.json({ scan_id: scan.id, slug });
}
