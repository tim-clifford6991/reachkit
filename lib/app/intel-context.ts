/**
 * Shared server context for the intel pages (Supply / Demand / Synthesis / Plans).
 *
 * Resolves the signed-in user → active app → subject domain + the user's CHOSEN
 * benchmark competitors. The four pages all gate on this: no app → empty state;
 * no competitors chosen → onboarding (competitor selection); else → render data.
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
  if (!viewer.user.onboarded_at) redirect("/app/onboarding");

  const appId = await activeAppId(viewer.user);
  if (!appId) redirect("/app/onboarding");

  const db = serverDb();
  const { data: appRow } = await db.from("apps").select("store_url").eq("id", appId).maybeSingle();
  const domain = (appRow?.store_url as string | null) ?? null;
  const competitors = await getSelectedCompetitors(appId);

  return { appId, domain, competitors };
}
