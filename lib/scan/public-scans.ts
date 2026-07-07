/**
 * Public scans — every completed free scan is a public teardown.
 *
 * We never hide a cost we incurred: each finished scan already has a public,
 * free-redacted report at /scan/{domain}. This module lists them (newest
 * first, one per app) for the teardowns index and the sitemap — turning spent
 * scan credits into permanent SEO surface.
 */

import { serverDb } from "@/lib/db/client";
import { slugForScan } from "@/lib/scan/scan-slug";

export interface PublicScan {
  /** Canonical public slug (domain for web scans). */
  slug: string;
  /** Bare domain for display. */
  host: string;
  score: number | null;
  completedAt: string | null;
}

/** Newest completed WEB scans, one per app (latest wins), capped. */
export async function listPublicScans(limit = 48): Promise<PublicScan[]> {
  const db = serverDb();
  const { data } = await db
    .from("scans")
    .select("id, app_id, score_total, completed_at, apps(store_url, platform)")
    .eq("status", "done")
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(limit * 4); // headroom for per-app dedupe

  const seen = new Set<string>();
  const out: PublicScan[] = [];
  for (const row of data ?? []) {
    const app = row.apps as unknown as { store_url: string; platform: string } | null;
    if (!app || app.platform !== "web") continue; // app-store scans keep UUID URLs — not listed
    if (seen.has(row.app_id)) continue;
    seen.add(row.app_id);
    const slug = slugForScan({ storeUrl: app.store_url, platform: app.platform, scanId: row.id });
    out.push({ slug, host: slug, score: row.score_total ?? null, completedAt: row.completed_at });
    if (out.length >= limit) break;
  }
  return out;
}
