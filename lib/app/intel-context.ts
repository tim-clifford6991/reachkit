/**
 * Shared server context for the intel pages (Supply / Demand / Synthesis / Plans).
 *
 * Resolves the signed-in user → active app → subject domain + the user's CHOSEN
 * benchmark competitors. The pages gate on this: no competitors chosen → the
 * inline CompetitorSetup picker; else → render data. First-run gating (profile +
 * competitor selection) is owned by the app layout's blocking SetupOverlay.
 */
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/server";
import { activeAppId } from "@/lib/app/active-app";
import { serverDb } from "@/lib/db/client";
import { getSelectedCompetitors } from "@/lib/scan/competitor-selection";

export interface IntelContext {
  appId: string;
  domain: string | null;
  competitors: string[];
}

/** Resolve the intel context, redirecting to login/onboarding as needed. */
export async function resolveIntelContext(path: string): Promise<IntelContext> {
  const viewer = await currentUser();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(path)}`);
  // NOTE: no onboarded_at redirect here — the app layout's SetupOverlay is the
  // blocking gate now, and any /app-bound redirect from an intel page would
  // loop (/app → /app/dashboard → resolveIntelContext → /app …). Un-onboarded
  // users see these pages only dimmed + inert underneath the overlay.

  // No app at all → Settings (a non-intel page, so no redirect cycle) is where
  // a product URL gets added; the overlay still renders above it if setup is
  // incomplete.
  const appId = await activeAppId(viewer.user);
  if (!appId) redirect("/app/settings");

  const db = serverDb();
  const { data: appRow } = await db.from("apps").select("store_url").eq("id", appId).maybeSingle();
  const domain = (appRow?.store_url as string | null) ?? null;
  const competitors = await getSelectedCompetitors(appId);

  return { appId, domain, competitors };
}
