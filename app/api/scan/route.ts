import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { serverDb } from "@/lib/db/client";
import { classifyUrl } from "@/lib/scan/router";
import { inngest } from "@/lib/inngest/client";
import { currentUser } from "@/lib/auth/server";
import { linkScanToUser } from "@/lib/auth/profile";
import { entitlementsFor } from "@/lib/billing/entitlements";
import { ensureDeepScan } from "@/lib/scan/deepen";
import { slugForScan } from "@/lib/scan/scan-slug";
import {
  AbuseError,
  assertRateLimit,
  findAppByUrl,
  findExistingScanForApp,
  hashIp,
  ipFromRequest,
} from "@/lib/scan/abuse";

// `scan_consent` is the "I own/authorised to scan this URL" affirmation from the
// public scan input (owner re-scans from the app don't send it). Optional here;
// the UI enforces the gate. We record the timestamp when it's affirmed.
const Body = z.object({ store_url: z.string().min(4), scan_consent: z.boolean().optional() });

export async function POST(req: NextRequest) {
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

  // Find-or-create the app by URL. One scan per app (dedupe): if a scan already
  // exists, return it instead of creating a duplicate or re-running the pipeline.
  let appId = await findAppByUrl(routed.url);
  if (appId) {
    const existingScanId = await findExistingScanForApp(appId);
    if (existingScanId) {
      if (viewer) await linkScanToUser(existingScanId, viewer.user.id);
      // A paid viewer opening a previously-free scan gets it deepened (idempotent).
      if (viewerIsPaid) await ensureDeepScan(existingScanId);
      // Personal, run-once URL: the same link always lands on the same scan.
      const slug = slugForScan({ storeUrl: routed.url, platform: routed.platform, scanId: existingScanId });
      return NextResponse.json({ scan_id: existingScanId, slug, deduped: true });
    }
  } else {
    const app = await db.from("apps").insert({ store_url: routed.url, platform: routed.platform }).select("id").single();
    if (app.error) return NextResponse.json({ error: app.error.message }, { status: 500 });
    appId = app.data.id;
  }

  const scan = await db.from("scans").insert({
    app_id: appId, status: "queued", ip_hash: ipHash, tier: scanTier,
    scan_consent_at: parsed.data.scan_consent ? new Date().toISOString() : null,
  }).select("id").single();
  if (scan.error) return NextResponse.json({ error: scan.error.message }, { status: 500 });
  if (viewer) await linkScanToUser(scan.data.id, viewer.user.id);
  await inngest.send({ name: "scan/requested", data: { scanId: scan.data.id } });
  const slug = slugForScan({ storeUrl: routed.url, platform: routed.platform, scanId: scan.data.id });
  return NextResponse.json({ scan_id: scan.data.id, slug });
}
