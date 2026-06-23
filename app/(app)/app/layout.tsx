/**
 * App shell layout — auth-gated, persistent sidebar, View Transitions on nav.
 *
 * §21.3 / §22.3: Four-question sidebar nav + Score + Plays + Feed + Settings +
 * Billing. Auth gate via currentUser(). Data-fetching wrapped in Suspense per
 * Next.js 16 cacheComponents requirement. Shows user email/avatar + tier badge.
 *
 * The primary app is users.app_ids[0]. If app_ids is empty, the dashboard
 * page shows an empty state linking to / to run a scan.
 */

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/server";
import { entitlementsFor } from "@/lib/billing/entitlements";
import { serverDb } from "@/lib/db/client";
import type { ReportPayload } from "@/lib/scan/report";
import type { Tier } from "@/lib/billing/tiers";
import { activeAppId } from "@/lib/app/active-app";
import { CommandPalette } from "@/components/app/command-palette";
import { AppShell } from "@/components/app/captured/app-shell";
import type { Metadata } from "next";

function relAge(iso: string | null): string {
  if (!iso) return "No scans yet";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d <= 0) return "Last scanned today";
  if (d === 1) return "Last scanned yesterday";
  return `Last scanned ${d} days ago`;
}
const PLAN_LABEL: Record<string, string> = { free: "Free plan", solo: "Solo plan", growth: "Growth plan" };

export const metadata: Metadata = {
  title: {
    template: "%s — ReachKit",
    default: "Dashboard — ReachKit",
  },
};

// ---------------------------------------------------------------------------
// Sidebar data-fetcher — async, runs server-side inside Suspense
// ---------------------------------------------------------------------------

async function SidebarData({ children }: { children: React.ReactNode }) {
  const viewer = await currentUser();
  if (!viewer) redirect("/login?next=/app");

  const { user } = viewer;
  const entitlements = await entitlementsFor(user.id);
  const tier: Tier = entitlements.active ? entitlements.tier : "free";
  const primaryAppId = await activeAppId(user);

  let appName: string | null = null;
  let lastScannedIso: string | null = null;
  const actionsCount = 0;

  if (primaryAppId) {
    const db = serverDb();
    const { data: appRow } = await db
      .from("apps")
      .select("name, store_url")
      .eq("id", primaryAppId)
      .maybeSingle();
    appName = appRow?.name ?? appRow?.store_url ?? null;

    const { data: scanRow } = await db
      .from("scans")
      .select("completed_at")
      .eq("app_id", primaryAppId)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    lastScannedIso = (scanRow?.completed_at as string | null) ?? null;
  }

  const email = user.email ?? "";
  const initials = email.slice(0, 2).toUpperCase();
  const userName = email ? email.split("@")[0]!.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Founder";
  // Next auto-scan (paid weekly cadence): last scan + 7 days.
  let nextScanLabel = "Re-scan anytime";
  if (lastScannedIso && tier !== "free") {
    const days = Math.max(0, Math.ceil((new Date(lastScannedIso).getTime() + 7 * 86_400_000 - Date.now()) / 86_400_000));
    nextScanLabel = `Next auto-scan in ${days} day${days === 1 ? "" : "s"}`;
  }

  return (
    <AppShell
      appName={appName ?? "your site"}
      plan={PLAN_LABEL[tier] ?? "Free plan"}
      appInitial={(appName ?? "?").charAt(0).toUpperCase()}
      actionsCount={actionsCount}
      nextScanLabel={nextScanLabel}
      userName={userName}
      userRole="solo founder"
      userInitials={initials}
      lastScannedLabel={relAge(lastScannedIso)}
      scoreVersion="v3"
    >
      {children}
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// Sidebar skeleton — shown while auth resolves
// ---------------------------------------------------------------------------

function SidebarSkeleton({ children }: { children: React.ReactNode }) {
  // While auth/data resolve, render content full-bleed (the captured AppShell
  // takes over once SidebarData resolves).
  return <div style={{ minHeight: "100vh", background: "#FAFAFC" }}>{children}</div>;
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* ⌘K command palette — globally available across the app shell */}
      <CommandPalette />
      <Suspense fallback={<SidebarSkeleton>{children}</SidebarSkeleton>}>
        <SidebarData>{children}</SidebarData>
      </Suspense>
    </>
  );
}
