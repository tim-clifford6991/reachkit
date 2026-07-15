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
import { classifyUrl } from "@/lib/scan/router";
import { entitlementsFor } from "@/lib/billing/entitlements";
import { TIER_LIMITS, isTier } from "@/lib/billing/tiers";
import { ensureDeepScan } from "@/lib/scan/deepen";
import { inngest } from "@/lib/inngest/client";
import { env } from "@/lib/config/env";

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

export class AddProductError extends Error {
  constructor(public code: "cap" | "already_tracked" | "invalid_url" | "paused", message: string) {
    super(message);
    this.name = "AddProductError";
  }
}

/**
 * Add a tracked product for `userId`, always producing a scan.
 *
 * NOT assertPaid-gated — deliberately. `addFirstProduct` (the Settings zero-app
 * form this replaces) is `requireUser`-only, so a FREE user can add their first
 * product today; gating on payment here would be a REGRESSION. The TIER CAP is
 * the real limit (free 1 / solo 1 / growth 3), and entitlement decides the scan's
 * TIER, mirroring /api/scan.
 */
export async function addTrackedProduct(userId: string, rawUrl: string): Promise<{ appId: string; scanId: string | null }> {
  if (!env.scanningEnabled) throw new AddProductError("paused", "Scanning is temporarily paused. Please try again shortly.");

  let routed;
  try { routed = classifyUrl(rawUrl); }
  catch { throw new AddProductError("invalid_url", "That doesn't look like a valid website address."); }

  const db = serverDb();
  const { data: user } = await db.from("users").select("tier, app_ids").eq("id", userId).maybeSingle();
  if (!user) throw new AddProductError("invalid_url", "Account not found.");

  const appIds: string[] = user.app_ids ?? [];
  const tier = isTier(user.tier as string) ? (user.tier as keyof typeof TIER_LIMITS) : "free";
  const cap = TIER_LIMITS[tier].apps;
  // Cap FIRST — before any lookup/create/spend. (linkScanToUser fails silently here.)
  if (appIds.length >= cap) {
    throw new AddProductError("cap", `You're tracking ${appIds.length} of ${cap} products on ${tier}. Upgrade or remove one to add another.`);
  }

  const { active: paid } = await entitlementsFor(userId);
  const plan = await resolveProductScan(routed.url, { paid });

  const existingAppId = "appId" in plan ? plan.appId : null;
  if (existingAppId && appIds.includes(existingAppId)) {
    throw new AddProductError("already_tracked", "You're already tracking this product.");
  }

  // NOTHING cost-bearing happens above this line. `apps` row creation (below,
  // for a brand-new URL) isn't cost-bearing either — no scan, no LLM/data
  // call — so it's safe before the cap re-check too (Finding 3, code review
  // 2026-07-15: spend must never precede the link that attributes it).
  let appId: string;
  if (plan.kind === "fresh") {
    const app = await db.from("apps").insert({ store_url: routed.url, platform: routed.platform }).select("id").single();
    if (app.error || !app.data) throw new Error(`addTrackedProduct: create app failed — ${app.error?.message}`);
    appId = app.data.id;
  } else {
    appId = plan.appId;
  }

  // Re-read + re-assert the cap BEFORE any spend (check-then-act race). Every
  // refusal from here down has spent NOTHING — no scans row, no LLM/data call.
  const { data: fresh } = await db.from("users").select("app_ids").eq("id", userId).maybeSingle();
  const nowIds: string[] = fresh?.app_ids ?? [];
  if (!nowIds.includes(appId)) {
    if (nowIds.length >= cap) throw new AddProductError("cap", `You're tracking ${nowIds.length} of ${cap} products on ${tier}.`);

    // ORDER IS LOAD-BEARING: link BEFORE any setActiveApp — setActiveApp
    // silently no-ops when the appId isn't yet in app_ids (PR #68 ownership
    // check). Also load-bearing here: link BEFORE any spend below — a link
    // failure now aborts before a single cent is spent, instead of orphaning
    // a scan that already started (Finding 3).
    const { error: linkErr } = await db.from("users").update({ app_ids: [...nowIds, appId] }).eq("id", userId);
    if (linkErr) throw new Error(`addTrackedProduct: link failed — ${linkErr.message}`);
  }

  // Only now — the app durably linked (or already was) — does any
  // cost-bearing call happen. A scan-row insert failure still leaves the app
  // linked; the dashboard offers retry (never strand a slot, see startScan).
  let scanId: string | null = null;
  if (plan.kind === "fresh" || plan.kind === "rescan") {
    scanId = await startScan(appId, paid);
  } else if (plan.kind === "deepen") {
    scanId = plan.scanId;
    if (paid) await ensureDeepScan(plan.scanId); // flips tier→full, emits scan/deepen
  } else {
    scanId = plan.scanId; // attach — a scan is already running; watch it
    // A paid viewer attaching to an in-flight scan must still get it deepened
    // — otherwise it finishes on the free track and nothing ever re-triggers
    // an upgrade (Finding 2, code review 2026-07-15). ensureDeepScan is
    // idempotent (lib/scan/deepen.ts): a no-op once the deep pass has run.
    if (paid) await ensureDeepScan(plan.scanId);
  }

  return { appId, scanId };
}

/** Insert a scan row at the viewer's tier and kick the pipeline. Mirrors /api/scan. */
async function startScan(appId: string, paid: boolean): Promise<string | null> {
  const scan = await serverDb().from("scans").insert({ app_id: appId, status: "queued", tier: paid ? "full" : "free" }).select("id").single();
  if (scan.error || !scan.data) {
    console.error("[add-product] scan row insert failed", scan.error?.message);
    return null; // app still links; the dashboard offers retry (never strand a slot)
  }
  await inngest.send({ name: "scan/requested", data: { scanId: scan.data.id } });
  return scan.data.id;
}
