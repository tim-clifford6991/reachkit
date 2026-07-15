import { NextResponse } from "next/server";
import { serverDb } from "@/lib/db/client";

/**
 * GET /api/health — liveness + DB-reachability probe for an external monitor
 * (P4). Returns 200 when the app can reach Postgres, 503 otherwise, plus build
 * info so a monitor can confirm WHICH deploy is live. Never cached.
 *
 * Not `blockInProd` — this must answer in production (that's its whole point).
 * No auth: it exposes only liveness + the public commit SHA, never data.
 *
 * No `dynamic`/`runtime` route-segment config: this project runs Next.js Cache
 * Components, which rejects those exports. The live DB query + `no-store`
 * response header keep it uncached per request.
 */
export async function GET() {
  // VERCEL_* are platform-injected and safe to read as literals (env-lint exempt).
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev";
  const region = process.env.VERCEL_REGION ?? "local";
  const now = new Date().toISOString();

  let dbOk = false;
  try {
    // Cheapest possible reachability check: HEAD count, no rows returned.
    const { error } = await serverDb().from("users").select("id", { head: true, count: "exact" }).limit(1);
    dbOk = !error;
  } catch {
    dbOk = false;
  }

  const body = { status: dbOk ? "ok" : "degraded", db: dbOk ? "ok" : "down", commit, region, time: now };
  return NextResponse.json(body, {
    status: dbOk ? 200 : 503,
    headers: { "cache-control": "no-store" },
  });
}
