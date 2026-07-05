/**
 * Scan slugs — personal, run-once scan URLs.
 *
 * A web scan's public identity is its DOMAIN, not a UUID: /scan/nudgi.ai and
 * /report/nudgi.ai. That reads personal, dedupes by construction (the same
 * link always resolves to the same app's scan — the /api/scan find-or-create
 * already guarantees one scan per app), and makes every scan an indexable SEO
 * asset instead of an unguessable artifact.
 *
 * App Store scans keep the scan UUID as their slug (an app-store URL has no
 * clean domain identity). Old UUID links keep working for every platform —
 * pages resolve either form and 308 web scans to their canonical domain URL.
 */

import { serverDb } from "@/lib/db/client";
import { classifyUrl } from "@/lib/scan/router";
import { hostname } from "@/lib/scan/url";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isScanUuid(param: string): boolean {
  return UUID_RE.test(param);
}

/** The canonical public slug for a scan: bare domain for web, UUID otherwise. */
export function slugForScan(args: { storeUrl: string; platform: string; scanId: string }): string {
  if (args.platform !== "web") return args.scanId;
  return hostname(args.storeUrl); // already strips www.
}

export interface ResolvedScan {
  scanId: string;
  /** Canonical slug — redirect here when the visited param differs. */
  slug: string;
  appId: string;
  storeUrl: string;
  platform: string;
}

/**
 * Resolve a route param that is EITHER a scan UUID or a domain to the scan it
 * identifies. Domain params resolve to the app's most recent scan (any status
 * — the funnel page must find in-flight scans too). Returns null when nothing
 * matches (callers notFound()).
 */
export async function resolveScanParam(param: string): Promise<ResolvedScan | null> {
  const db = serverDb();
  const decoded = decodeURIComponent(param).trim().toLowerCase();

  if (isScanUuid(decoded)) {
    const { data } = await db
      .from("scans")
      .select("id, app_id, apps(store_url, platform)")
      .eq("id", decoded)
      .maybeSingle();
    const app = data?.apps as { store_url: string; platform: string } | null;
    if (!data || !app) return null;
    return {
      scanId: data.id,
      slug: slugForScan({ storeUrl: app.store_url, platform: app.platform, scanId: data.id }),
      appId: data.app_id,
      storeUrl: app.store_url,
      platform: app.platform,
    };
  }

  // Domain form. Guard: a plausible hostname only (no paths/queries smuggled in).
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(decoded)) return null;

  // Normalize exactly like scan creation does, so lookup matches store_url
  // byte-for-byte in the common case; fall back to the www. variant and a
  // prefix match for apps scanned with a path.
  let candidates: string[];
  try {
    candidates = [classifyUrl(decoded).url, classifyUrl(`www.${decoded}`).url];
  } catch {
    return null;
  }

  let app: { id: string; store_url: string; platform: string } | null = null;
  for (const url of candidates) {
    const { data } = await db
      .from("apps")
      .select("id, store_url, platform")
      .eq("store_url", url)
      .limit(1)
      .maybeSingle();
    if (data) { app = data; break; }
  }
  if (!app) {
    const { data } = await db
      .from("apps")
      .select("id, store_url, platform")
      .or(`store_url.ilike.https://${decoded}%,store_url.ilike.https://www.${decoded}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    app = data ?? null;
  }
  if (!app) return null;

  const { data: scan } = await db
    .from("scans")
    .select("id")
    .eq("app_id", app.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!scan) return null;

  return {
    scanId: scan.id,
    slug: slugForScan({ storeUrl: app.store_url, platform: app.platform, scanId: scan.id }),
    appId: app.id,
    storeUrl: app.store_url,
    platform: app.platform,
  };
}
