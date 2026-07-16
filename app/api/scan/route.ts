import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/config/env";
import { serverDb } from "@/lib/db/client";
import { classifyUrl } from "@/lib/scan/router";
import { inngest } from "@/lib/inngest/client";
import { currentUser } from "@/lib/auth/server";
import { linkScanToUser } from "@/lib/auth/profile";
import { entitlementsFor } from "@/lib/billing/entitlements";
import { ensureDeepScan } from "@/lib/scan/deepen";
import { slugForScan } from "@/lib/scan/scan-slug";
import { resolveProductScan } from "@/lib/app/add-product";
import { AbuseError, assertRateLimit, hashIp, ipFromRequest } from "@/lib/scan/abuse";

// `scan_consent` is accepted-but-ignored for backwards compatibility: the
// authorisation checkbox was removed 2026-07-16 (scans read only public data;
// owner decision). The `scans.scan_consent_at` column stays, unwritten.
const Body = z.object({ store_url: z.string().min(4), scan_consent: z.boolean().optional() });

export async function POST(req: NextRequest) {
  // Kill switch (P4): pause all new scans without a redeploy when a scan
  // dependency (Anthropic / DataForSEO / Tavily) is degraded.
  if (!env.scanningEnabled) {
    return NextResponse.json(
      { error: "Scanning is temporarily paused. Please try again shortly." },
      { status: 503 },
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "store_url required" }, { status: 400 });
  let routed;
  try { routed = classifyUrl(parsed.data.store_url); }
  catch { return NextResponse.json({ error: "invalid url" }, { status: 400 }); }

  // Per-IP rate limit (R4) — stops enumeration abuse. Only the IP hash is stored.
  const ipHash = hashIp(ipFromRequest(req));
  try { await assertRateLimit(ipHash); }
  catch (e) {
    if (e instanceof AbuseError) return NextResponse.json({ error: "rate limit — try again later" }, { status: 429 });
    throw e;
  }

  const db = serverDb();

  // A logged-in user (e.g. a trial-direct user running their first scan from the
  // dashboard) gets the scanned app linked to their account for continuity.
  // Two-track split: a paid viewer's scan runs the deep ('full') pipeline; an
  // anonymous/free viewer gets the cheap ('free') teaser track.
  const viewer = await currentUser();
  let viewerIsPaid = false;
  if (viewer) {
    viewerIsPaid = (await entitlementsFor(viewer.user.id)).active;
  }
  const scanTier: "free" | "full" = viewerIsPaid ? "full" : "free";

  // Resolve what this URL means through the ONE shared policy (spec 2026-07-15)
  // so the public scan route and the in-app add can never disagree again.
  const plan = await resolveProductScan(routed.url, { paid: viewerIsPaid });
  if (plan.kind === "deepen" || plan.kind === "attach") {
    if (viewer) await linkScanToUser(plan.scanId, viewer.user.id);
    // A paid viewer landing on EITHER a done-but-reusable scan (deepen) OR a
    // scan that's already in flight (attach) must still get deepened — an
    // in-flight scan with no viewer watching it can finish on the free track
    // and never be re-upgraded (Finding 2, code review 2026-07-15).
    // ensureDeepScan is idempotent (lib/scan/deepen.ts): a no-op if the deep
    // pass already ran, safe to call from either branch.
    if (viewerIsPaid) await ensureDeepScan(plan.scanId);
    const slug = slugForScan({ storeUrl: routed.url, platform: routed.platform, scanId: plan.scanId });
    return NextResponse.json({ scan_id: plan.scanId, slug, deduped: true });
  }
  // fresh | rescan → fall through to create the scan row below.
  let appId = plan.kind === "rescan" ? plan.appId : null;
  if (!appId) {
    const app = await db.from("apps").insert({ store_url: routed.url, platform: routed.platform }).select("id").single();
    if (app.error) return NextResponse.json({ error: app.error.message }, { status: 500 });
    appId = app.data.id;
  }

  const scan = await db.from("scans").insert({
    app_id: appId, status: "queued", ip_hash: ipHash, tier: scanTier,
  }).select("id").single();
  if (scan.error) return NextResponse.json({ error: scan.error.message }, { status: 500 });
  if (viewer) await linkScanToUser(scan.data.id, viewer.user.id);
  await inngest.send({ name: "scan/requested", data: { scanId: scan.data.id } });
  const slug = slugForScan({ storeUrl: routed.url, platform: routed.platform, scanId: scan.data.id });
  return NextResponse.json({ scan_id: scan.data.id, slug });
}
