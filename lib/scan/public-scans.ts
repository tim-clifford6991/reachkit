/**
 * Public scans — every completed free scan is a public teardown.
 *
 * We never hide a cost we incurred: each finished scan already has a public,
 * free-redacted report at /scan/{domain}. This module lists them (newest
 * first, one per app) for the teardowns index and the sitemap — turning spent
 * scan credits into permanent SEO surface.
 *
 * Backed by the `public_scans` view (one latest completed WEB scan per app),
 * so dedupe/platform/status filtering lives in SQL — this module just adds
 * search, pagination, and slug mapping.
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

export interface ListPublicScansOpts {
  q?: string;
  limit?: number;
  offset?: number;
}

/** Normalizes the legacy positional-number call (`listPublicScans(48)`) to opts. */
function normalizeOpts(arg?: number | ListPublicScansOpts): ListPublicScansOpts {
  if (typeof arg === "number") return { limit: arg };
  return arg ?? {};
}

/** Newest completed WEB scans, one per app (latest wins), searchable + paginated. */
export async function listPublicScans(opts?: number | ListPublicScansOpts): Promise<PublicScan[]> {
  const { q, limit = 48, offset = 0 } = normalizeOpts(opts);
  const db = serverDb();
  let query = db
    .from("public_scans")
    .select("scan_id, score_total, completed_at, store_url");

  const trimmedQ = q?.trim();
  if (trimmedQ) query = query.ilike("store_url", `%${trimmedQ}%`);

  const { data } = await query
    .order("completed_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const out: PublicScan[] = [];
  for (const row of data ?? []) {
    // The view's WHERE clause guarantees scan_id/store_url are populated for
    // every row; the generated types just can't express that (views drop
    // NOT NULL). Skip defensively rather than assert.
    if (!row.scan_id || !row.store_url) continue;
    const slug = slugForScan({ storeUrl: row.store_url, platform: "web", scanId: row.scan_id });
    out.push({ slug, host: slug, score: row.score_total ?? null, completedAt: row.completed_at });
  }
  return out;
}

/** Total count of public teardowns matching an optional search. */
export async function countPublicScans(opts?: { q?: string }): Promise<number> {
  const db = serverDb();
  let query = db.from("public_scans").select("app_id", { count: "exact", head: true });

  const trimmedQ = opts?.q?.trim();
  if (trimmedQ) query = query.ilike("store_url", `%${trimmedQ}%`);

  const { count } = await query;
  return count ?? 0;
}
