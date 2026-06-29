/**
 * /api/competitors/candidates?domain=<host> — ranked competitor candidates for the
 * dashboard picker: closeness score + reason, estimated traffic, and size ratio vs
 * the user's own traffic. The user chooses up to 5 from this list to benchmark.
 *
 * Cached per app in report_payload.competitorCandidates (7-day TTL) — competitor
 * landscapes change slowly, so the picker should not re-spend DataForSEO each load.
 */
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { activeAppId } from "@/lib/app/active-app";
import { serverDb } from "@/lib/db/client";
import { normalizeHost } from "@/lib/scan/referral/classify";
import type { Json } from "@/lib/db/types";
import { discoverClosestCompetitors } from "@/lib/scan/referral/discover-competitors";

export const maxDuration = 60;
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const viewer = await currentUser();
  if (!viewer) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const domain = req.nextUrl.searchParams.get("domain")?.trim();
  if (!domain) return NextResponse.json({ error: "domain required" }, { status: 400 });
  const fresh = req.nextUrl.searchParams.get("refresh") === "1";

  const appId = await activeAppId(viewer.user);
  const db = serverDb();
  const { data: scan } = appId
    ? await db.from("scans").select("id, report_payload").eq("app_id", appId).order("completed_at", { ascending: false }).limit(1).maybeSingle()
    : { data: null };
  const payload = (scan?.report_payload ?? null) as Record<string, unknown> | null;

  // Serve cached candidates when fresh.
  const cached = payload?.competitorCandidates as { generatedAt?: string } | undefined;
  if (!fresh && cached?.generatedAt && Date.now() - Date.parse(cached.generatedAt) < TTL_MS) {
    return NextResponse.json(cached);
  }

  try {
    const result = await discoverClosestCompetitors(normalizeHost(domain));
    if (scan?.id && payload) {
      payload.competitorCandidates = { generatedAt: new Date().toISOString(), ...result };
      try {
        await db.from("scans").update({ report_payload: payload as Json }).eq("id", scan.id);
      } catch (e) {
        console.error("[competitors/candidates] cache write failed (best-effort)", e);
      }
    }
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
