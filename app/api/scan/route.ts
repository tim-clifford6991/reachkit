import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/config/env";
import { serverDb } from "@/lib/db/client";
import { classifyUrl } from "@/lib/scan/router";
import { inngest } from "@/lib/inngest/client";
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

  // INVARIANT: the public scan surface is ALWAYS a free preview — for anonymous
  // AND authenticated (incl. paid) viewers alike (owner decision 2026-07-18). It
  // NEVER runs the deep pass and NEVER enrols the URL as a tracked product:
  // deepening + product tracking are a deliberate /app/add (or post-checkout
  // provision) action, never a side effect of pasting a URL into the marketing
  // scan box. This is why tier is hard-'free', paid:false is passed to the shared
  // policy (so it can never resolve to a `deepen`), and there is no viewer lookup
  // / ensureDeepScan / linkScanToUser here. Removing those closes the cardpointers
  // leak (2026-07-18): a logged-in growth user previewing a third-party URL got a
  // 66¢ deep scan silently billed and the URL auto-tracked. Guarded by
  // app/api/scan/route.tier.test.ts (mutation-proven).

  // Resolve what this URL means through the ONE shared policy (spec 2026-07-15).
  // paid:false — the public surface never resolves to a `deepen` plan; deepen/attach
  // are pure dedupe here (hand back the existing scan; never upgrade or link it).
  const plan = await resolveProductScan(routed.url, { paid: false });
  if (plan.kind === "deepen" || plan.kind === "attach") {
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
    app_id: appId, status: "queued", ip_hash: ipHash, tier: "free",
  }).select("id").single();
  if (scan.error) return NextResponse.json({ error: scan.error.message }, { status: 500 });
  await inngest.send({ name: "scan/requested", data: { scanId: scan.data.id, tier: "free" } });
  const slug = slugForScan({ storeUrl: routed.url, platform: routed.platform, scanId: scan.data.id });
  return NextResponse.json({ scan_id: scan.data.id, slug });
}
