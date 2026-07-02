/**
 * /api/competitors/candidates?domain=<host> — ranked competitor candidates for the
 * dashboard picker: closeness score + reason, estimated traffic, and size ratio vs
 * the user's own traffic. The user chooses up to 5 from this list to benchmark.
 *
 * Backed by the SAME domain-keyed global cache the intel layers use (`cc:<host>`,
 * 14-day TTL) via `cachedClosestCompetitors`. This means:
 *   - Picker loads share the intel-layer cache instead of re-paying the full
 *     Tavily + DataForSEO + LLM discovery pipeline per load (even for users
 *     without a completed scan).
 *   - Results are inherently DOMAIN-CORRECT: the cache is keyed on the resolved
 *     host, so changing the app's domain can never serve stale wrong-domain
 *     candidates (the old report_payload blob was served regardless of which
 *     domain it was computed for).
 *
 * `?refresh=1` busts the domain's cache entry so the next compute is fresh.
 */
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { serverDb } from "@/lib/db/client";
import { normalizeHost } from "@/lib/scan/referral/classify";
import { cachedClosestCompetitors } from "@/lib/scan/cache/cached-adapters";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const viewer = await currentUser();
  if (!viewer) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const domain = req.nextUrl.searchParams.get("domain")?.trim();
  if (!domain) return NextResponse.json({ error: "domain required" }, { status: 400 });
  const fresh = req.nextUrl.searchParams.get("refresh") === "1";

  const self = normalizeHost(domain);

  // refresh=1 → bust the domain-keyed cache entry (mirrors cachedClosestCompetitors'
  // `cc:${norm(self)}` key) so the wrapper below recomputes and re-persists.
  if (fresh) {
    try {
      await serverDb().from("search_cache").delete().eq("key", `cc:${self.trim().toLowerCase()}`);
    } catch (e) {
      console.error("[competitors/candidates] cache bust failed (best-effort)", e);
    }
  }

  try {
    const result = await cachedClosestCompetitors(self);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
