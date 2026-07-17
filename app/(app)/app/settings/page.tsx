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
import { SettingsMain, type TrackedProduct } from "@/components/app/captured/settings-main";
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
  const appIds: string[] = user.app_ids ?? [];

  // eslint-disable-next-line react-hooks/purity -- server component: single render per request, Date.now is deterministic per-request
  const nowMs = Date.now();
  const freshnessMeta = (iso: string | null): { meta: string; fresh: boolean } => {
    if (!iso) return { meta: "No scans yet", fresh: false };
    const d = Math.floor((nowMs - new Date(iso).getTime()) / 86_400_000);
    return {
      meta: `Web · last fetched ${d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`}`,
      fresh: d <= 7,
    };
  };

  // Every tracked product (growth: up to 3), so each can be removed — the exit
  // the at-cap error promises. Batched: one apps read + one latest-scan read per
  // app (≤3), rather than N round-trips through the page.
  const products: TrackedProduct[] = [];
  if (appIds.length > 0) {
    const db = serverDb();
    const { data: appRows } = await db.from("apps").select("id, name, store_url").in("id", appIds);
    const byId = new Map((appRows ?? []).map((a) => [a.id as string, a]));
    for (const appId of appIds) {
      const appRow = byId.get(appId);
      if (!appRow) continue;
      const name = (appRow.name as string | null) ?? (appRow.store_url as string | null) ?? "your site";
      const { data: scanRow } = await db
        .from("scans")
        .select("completed_at")
        .eq("app_id", appId)
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { meta, fresh } = freshnessMeta(scanRow?.completed_at as string | null);
      products.push({
        appId,
        name,
        initial: name.charAt(0).toUpperCase(),
        meta,
        dataFresh: fresh,
        storeUrl: (appRow.store_url as string | null) ?? null,
        isActive: appId === primaryAppId,
      });
    }
  }

  return (
    <SettingsMain
      planTitle={plan.title}
      planDesc={plan.desc}
      upgradeLabel={plan.upgrade}
      upgradePlan={plan.upgradePlan}
      isPaid={ent.active}
      products={products}
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
