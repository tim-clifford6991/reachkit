"use server";

/**
 * Server action behind /app/add — adding a tracked product from INSIDE the app.
 *
 * ORCHESTRATOR only: `addTrackedProduct` (lib/app/add-product.ts) already owns
 * tier-cap enforcement, already-tracked refusal, URL canonicalisation, the
 * SCANNING_ENABLED kill switch, the shared resolveProductScan policy, and app
 * creation/linking + scan start. This file must not duplicate any of that.
 *
 * It RETURNS the result rather than redirecting: /app/add is a client-driven
 * 3-step flow (URL → scanning → competitors), so the client owns navigation.
 * Previously this redirected straight to /app/dashboard, which is exactly why
 * add-product felt "disconnected" — the competitor pick was left to a later
 * banner instead of being part of the flow (owner report 2026-07-17). The
 * competitor step now lives IN this route; first-run onboarding (the overlay)
 * is unchanged — the two paths never overlap (first app → overlay; Nth app →
 * this route), so `appCount<=1` still correctly keeps product #2 from
 * inert-ing product #1.
 *
 * NOT assertPaid-gated — deliberately (see lib/app/add-product.ts). requireUser()
 * is the only auth gate; the tier cap inside addTrackedProduct is the real limit.
 */
import { redirect } from "next/navigation";
import { requireUser, AuthError } from "@/lib/auth/server";
import { addTrackedProduct, AddProductError } from "@/lib/app/add-product";
import { entitlementsFor } from "@/lib/billing/entitlements";
import { setActiveApp } from "@/lib/app/set-active-app";
import { classifyUrl } from "@/lib/scan/router";
import { hostname } from "@/lib/scan/url";

export type AddState = { error: string | null };

export type AddResult =
  | { ok: false; error: string }
  | {
      ok: true;
      appId: string;
      /** null when the scan-row insert failed — the app still links; the flow
       *  skips the scanning step and lands on the dashboard's retry state. */
      scanId: string | null;
      /** The subject hostname (e.g. "nudgi.ai") — CompetitorSetup's `domain`. */
      host: string;
      /** Paid viewer → the scan runs/deepens on the full (deep) track. */
      paid: boolean;
    };

export async function addProduct(rawUrl: string): Promise<AddResult> {
  const url = (rawUrl ?? "").trim();
  if (!url) return { ok: false, error: "Enter your product's website address." };

  let userId: string;
  try {
    ({
      user: { id: userId },
    } = await requireUser());
  } catch (e) {
    if (e instanceof AuthError) redirect("/login?next=/app/add");
    throw e;
  }

  // Canonical host for the competitor step. classifyUrl is pure; a bad URL is a
  // user error, surfaced inline (addTrackedProduct would reject it too).
  let host: string;
  try {
    host = hostname(classifyUrl(url).url);
  } catch {
    return { ok: false, error: "That doesn't look like a valid website address." };
  }

  let appId: string;
  let scanId: string | null;
  try {
    ({ appId, scanId } = await addTrackedProduct(userId, url));
  } catch (e) {
    if (e instanceof AddProductError) return { ok: false, error: e.message };
    console.error("[add-product] failed", e);
    return { ok: false, error: "Couldn't add that product. Please try again." };
  }

  // ORDER IS LOAD-BEARING: addTrackedProduct already linked appId into
  // users.app_ids before returning — setActiveApp re-checks ownership against
  // that list and silently no-ops for an app not yet in it (PR #68), so this
  // must come AFTER addTrackedProduct resolves, never before/in parallel.
  await setActiveApp(appId);

  const { active: paid } = await entitlementsFor(userId);
  return { ok: true, appId, scanId, host, paid };
}
