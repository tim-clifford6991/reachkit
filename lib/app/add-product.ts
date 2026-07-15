/**
 * The SINGLE product-resolution policy (spec: 2026-07-15-add-product-onboarding).
 *
 * Two paths already disagreed on what a URL means — `/api/scan` find-or-creates,
 * `addFirstTrackedProduct` always inserted — and that disagreement is what
 * produced nudgi.ai's incoherent live state (an anonymous free scan hand-attached
 * to a paid account: paid dashboard over free data). Every caller now asks this.
 *
 * It BUILDS ON the existing dedupe primitives rather than re-implementing them:
 * `findExistingScanForApp` already resolves done-vs-running-vs-dead. The only new
 * rule here is freshness.
 */
import { findAppByUrl, findExistingScanForApp } from "@/lib/scan/abuse";
import { serverDb } from "@/lib/db/client";

/** Deepen a scan at most this old; older ⇒ re-scan. Weekly refresh keeps a healthy
 *  tracked app <7d, so 14 is a grace margin (owner decision 2026-07-15). */
export const SCAN_STALE_DAYS = 14;

export type ProductScanPlan =
  | { kind: "deepen"; appId: string; scanId: string }
  | { kind: "rescan"; appId: string }
  | { kind: "attach"; appId: string; scanId: string }
  | { kind: "fresh" };

export async function resolveProductScan(
  canonicalUrl: string,
  opts: { paid: boolean; now?: Date },
): Promise<ProductScanPlan> {
  const now = opts.now ?? new Date();
  const appId = await findAppByUrl(canonicalUrl);
  if (!appId) return { kind: "fresh" };

  const scanId = await findExistingScanForApp(appId);
  if (!scanId) return { kind: "rescan", appId }; // failed/stuck ⇒ owed a scan

  const { data } = await serverDb().from("scans").select("status, created_at").eq("id", scanId).maybeSingle();
  // Running (<15min per findExistingScanForApp) — never trigger a duplicate run.
  if (!data || data.status !== "done") return { kind: "attach", appId, scanId };

  // A free viewer never pays for a re-scan: existing dedupe semantics, unchanged.
  if (!opts.paid) return { kind: "attach", appId, scanId };

  const ageDays = (now.getTime() - new Date(data.created_at as string).getTime()) / 86_400_000;
  return ageDays <= SCAN_STALE_DAYS ? { kind: "deepen", appId, scanId } : { kind: "rescan", appId };
}
