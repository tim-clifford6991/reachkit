/**
 * Settings page — the captured "Settings" tab (plan / tracked product / scoring),
 * wired to live tier + app data. Renders inside the captured AppShell.
 */

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/server";
import { entitlementsFor } from "@/lib/billing/entitlements";
import { activeAppId } from "@/lib/app/active-app";
import { serverDb } from "@/lib/db/client";
import { SettingsMain } from "@/components/app/captured/settings-main";
import { SettingsSkeleton } from "@/components/app/captured/skeletons";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({ title: "Settings", path: "/app/settings" });

const PLAN: Record<string, { title: string; desc: string; upgrade: string | null; upgradePlan: "solo" | "growth" | null }> = {
  free: { title: "Free · €0", desc: "1 free scan · upgrade for weekly tracking", upgrade: "Upgrade", upgradePlan: "solo" },
  solo: { title: "Solo · €59/mo", desc: "1 product · weekly re-scan · 20-keyword depth", upgrade: "Upgrade to Growth", upgradePlan: "growth" },
  growth: { title: "Growth · €129/mo", desc: "3 products · weekly re-scan · 50-keyword depth", upgrade: null, upgradePlan: null },
};

async function SettingsContent() {
  const viewer = await currentUser();
  if (!viewer) redirect("/login?next=/app/settings");
  const { user } = viewer;
  const ent = await entitlementsFor(user.id);
  const tier = ent.active ? ent.tier : "free";
  const plan = PLAN[tier] ?? PLAN.free!;

  const primaryAppId = await activeAppId(user);
  let appName = "your site";
  let storeUrl: string | null = null;
  let productMeta = "No scans yet";
  let dataFresh = false;
  if (primaryAppId) {
    const db = serverDb();
    const { data: appRow } = await db.from("apps").select("name, store_url").eq("id", primaryAppId).maybeSingle();
    appName = appRow?.name ?? appRow?.store_url ?? "your site";
    storeUrl = appRow?.store_url ?? null;
    const { data: scanRow } = await db.from("scans").select("completed_at").eq("app_id", primaryAppId).order("completed_at", { ascending: false }).limit(1).maybeSingle();
    const iso = scanRow?.completed_at as string | null;
    if (iso) {
      // eslint-disable-next-line react-hooks/purity -- server component: single render per request, Date.now is deterministic per-request
      const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
      productMeta = `Web · last fetched ${d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`}`;
      dataFresh = d <= 7;
    }
  }

  return (
    <SettingsMain
      planTitle={plan.title}
      planDesc={plan.desc}
      upgradeLabel={plan.upgrade}
      upgradePlan={plan.upgradePlan}
      isPaid={ent.active}
      appName={appName}
      appInitial={appName.charAt(0).toUpperCase()}
      productMeta={productMeta}
      dataFresh={dataFresh}
      appId={primaryAppId}
      storeUrl={storeUrl}
    />
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <SettingsContent />
    </Suspense>
  );
}
