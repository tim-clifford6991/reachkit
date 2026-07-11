/**
 * /api/competitors/candidates?domain=<host> — ranked competitor candidates for the
 * dashboard picker: closeness score + reason, estimated traffic, and size ratio vs
 * the user's own traffic. The user chooses up to 5 from this list to benchmark.
 *
 * Source preference (cheapest sufficient answer first, W6):
 *   1. Warm `cc:<host>` cache (14-day TTL, shared with the intel layers) — the
 *      richest shape (etv / size tiers), served instantly via
 *      `cachedClosestCompetitors`. Domain-keyed, so it can never serve stale
 *      wrong-domain candidates.
 *   2. Competitors already DISCOVERED by the user's scan (persisted on the
 *      `competitors` table during collect). The free scan pays for this once —
 *      onboarding must not re-run the Tavily + DataForSEO + LLM discovery
 *      pipeline just to show the same names again.
 *   3. Full discovery via `cachedClosestCompetitors` (cold path; result cached
 *      globally per domain for every later caller).
 *
 * `?refresh=1` busts the domain's cache entry AND skips the scan seed so the
 * next compute is genuinely fresh.
 */
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { assertPaid, EntitlementError } from "@/lib/billing/entitlements";
import { activeAppId } from "@/lib/app/active-app";
import { costedIntelStep } from "@/lib/app/latest-scan";
import { serverDb } from "@/lib/db/client";
import { normalizeHost } from "@/lib/scan/referral/classify";
import { resolveCompetitorDomain } from "@/lib/scan/competitor-resolve";
import { cachedClosestCompetitors } from "@/lib/scan/cache/cached-adapters";

export const maxDuration = 60;

/** Mirrors cachedClosestCompetitors' TTL (14d) for the warm-cache peek. */
const CC_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/** Candidate shape the picker consumes — scan-seeded entries carry no traffic
 *  data, so etv/ratio/sizeTier are degraded (the picker renders those softly). */
interface SeededCandidate {
  domain: string;
  name: string;
  closeness: number;
  reason: string;
  etv: number;
  ratio: number | null;
  sizeRelevant: boolean;
  /** 2B — a discovered competitor we couldn't auto-resolve to a domain. Still
   *  selectable; the select route resolves it on commit (name-keyed, no domain). */
  unresolved?: boolean;
}

/** True when the shared `cc:<host>` cache already holds a fresh result — then
 *  cachedClosestCompetitors is an instant read and strictly richer than a seed. */
async function ccCacheIsWarm(self: string): Promise<boolean> {
  try {
    const { data } = await serverDb()
      .from("search_cache")
      .select("created_at")
      .eq("key", `cc:${self.trim().toLowerCase()}`)
      .maybeSingle();
    return !!data?.created_at && Date.now() - new Date(data.created_at).getTime() < CC_TTL_MS;
  } catch {
    return false;
  }
}

/**
 * Build the picker payload from the competitors the user's own scan already
 * discovered (source != 'user_selected'), when the requested domain IS the
 * active app's domain. Returns null when there's nothing to seed from —
 * callers then fall through to the discovery pipeline.
 */
async function seedFromScan(
  user: { app_ids: string[] },
  self: string,
): Promise<{ category: string; blurb: string; subjectEtv: number; ranked: SeededCandidate[]; suggested: string[] } | null> {
  const db = serverDb();
  const appId = await activeAppId(user);
  if (!appId) return null;

  const { data: appRow } = await db.from("apps").select("store_url").eq("id", appId).maybeSingle();
  if (!appRow?.store_url || normalizeHost(appRow.store_url) !== self) return null;

  const { data: rows } = await db
    .from("competitors")
    .select("id, competitor_store_url, name, source")
    .eq("app_id", appId)
    .neq("source", "user_selected");

  const seen = new Set<string>();
  const ranked: SeededCandidate[] = [];
  const add = (host: string, name: string) => {
    if (!host || host === self || seen.has(host) || ranked.length >= 15) return;
    seen.add(host);
    ranked.push({ domain: host, name: name || host, closeness: 3, reason: "Found during your scan", etv: 0, ratio: null, sizeRelevant: true });
  };

  // Rows that already carry a domain (SERP/Tavily-sourced) go straight in;
  // LLM-extracted rows are name-only and must be resolved (A4) — otherwise the
  // picker drops every one of them and falls back to 1 live-discovery result.
  const nameOnly: Array<{ id: string; name: string }> = [];
  for (const r of rows ?? []) {
    const host = normalizeHost(r.competitor_store_url ?? "");
    if (host) add(host, r.name ?? host);
    else if (r.name) nameOnly.push({ id: r.id as string, name: r.name });
  }

  // Resolve name-only competitors → domains in parallel, then BACKFILL the row so
  // this cost is paid once (subsequent loads see the host and skip resolution).
  // 2B — a name we CAN'T resolve is no longer silently dropped: it's surfaced as
  // an `unresolved` candidate (name-keyed) so the user sees every discovered rival
  // and can still pick it; the select route resolves it on commit.
  const seenNames = new Set<string>();
  if (nameOnly.length > 0 && ranked.length < 15) {
    const resolved = await Promise.all(
      nameOnly.slice(0, 10).map(async (u) => ({ u, host: await resolveCompetitorDomain(u.name) })),
    );
    for (const { u, host } of resolved) {
      if (host && host !== self && !seen.has(host)) {
        add(host, u.name);
        try {
          await db.from("competitors").update({ competitor_store_url: `https://${host}` }).eq("id", u.id);
        } catch (e) {
          console.error("[competitors/candidates] backfill failed (best-effort)", e);
        }
      } else if (!host) {
        const key = u.name.trim().toLowerCase();
        if (key && !seenNames.has(key) && ranked.length < 15) {
          seenNames.add(key);
          ranked.push({ domain: "", name: u.name, closeness: 2, reason: "Found during your scan (name only)", etv: 0, ratio: null, sizeRelevant: true, unresolved: true });
        }
      }
    }
  }

  if (ranked.length === 0) return null;
  // Auto-suggest only resolved candidates (an unresolved one has no domain to seed).
  const suggested = ranked.filter((c) => c.domain).slice(0, 5).map((c) => c.domain);
  return { category: "", blurb: "", subjectEtv: 0, ranked, suggested };
}

export async function GET(req: NextRequest) {
  const viewer = await currentUser();
  if (!viewer) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  // Paid entitlement — the cold path runs DataForSEO competitor discovery; gate it
  // like the rest of the paid onboarding surface (§6 #6).
  try {
    await assertPaid(viewer.user.id);
  } catch (e) {
    if (e instanceof EntitlementError) return NextResponse.json({ error: "upgrade required" }, { status: 402 });
    return NextResponse.json({ error: "unexpected entitlement error" }, { status: 500 });
  }
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

  // Scan continuity (W6): when the discovery cache is cold but the user's scan
  // already found competitors for THIS domain, serve those instead of re-paying
  // the discovery pipeline during onboarding. Best-effort — any failure falls
  // through to the normal path.
  if (!fresh && !(await ccCacheIsWarm(self))) {
    try {
      const seeded = await seedFromScan(viewer.user, self);
      if (seeded) return NextResponse.json(seeded);
    } catch (e) {
      console.error("[competitors/candidates] scan seed failed (best-effort)", e);
    }
  }

  try {
    // costedIntelStep: the cold discovery path spends DataForSEO/Tavily —
    // attribute it to the viewer's latest scan row (CLAUDE.md invariant #2).
    const appId = await activeAppId(viewer.user);
    const result = appId
      ? await costedIntelStep(appId, "candidates", () => cachedClosestCompetitors(self))
      : await cachedClosestCompetitors(self);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
