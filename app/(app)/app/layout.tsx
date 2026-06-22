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
import { AppSidebar } from "@/components/app/app-sidebar";
import { activeAppId, userApps } from "@/lib/app/active-app";
import { CommandPalette } from "@/components/app/command-palette";
import { AppBreadcrumbs } from "@/components/app/app-breadcrumbs";
import type { Metadata } from "next";

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
  const apps = await userApps(user.app_ids);

  let appName: string | null = null;
  let appScore: number | null = null;

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
      .select("report_payload")
      .eq("app_id", primaryAppId)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (scanRow?.report_payload) {
      const payload = scanRow.report_payload as unknown as ReportPayload;
      appScore = payload.score?.total ?? null;
    }
  }

  const email = user.email ?? "";
  const initials = email.slice(0, 2).toUpperCase();

  return (
    <>
      <AppSidebar
        email={email}
        initials={initials}
        tier={tier}
        appName={appName}
        appScore={appScore}
        hasApp={primaryAppId !== null}
        apps={apps}
        activeId={primaryAppId}
      />
      {children}
    </>
  );
}

// ---------------------------------------------------------------------------
// Sidebar skeleton — shown while auth resolves
// ---------------------------------------------------------------------------

function SidebarSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Minimal sidebar placeholder while loading */}
      <aside
        className="flex w-60 shrink-0 flex-col border-r"
        style={{
          background: "var(--sidebar)",
          borderColor: "var(--sidebar-border)",
          minHeight: "100svh",
        }}
        aria-hidden
      />
      {children}
    </>
  );
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
    <div
      className="flex min-h-screen"
      style={{ background: "var(--color-bg)" }}
    >
      {/* ⌘K command palette — globally available across the app shell */}
      <CommandPalette />
      <Suspense fallback={<SidebarSkeleton>{null}</SidebarSkeleton>}>
        <SidebarData>
          {/* ── Content area — View Transitions swap here ── */}
          <main
            className="flex min-h-screen flex-1 flex-col overflow-x-hidden"
            style={{ background: "var(--color-bg)" }}
          >
            <AppBreadcrumbs />
            {children}
          </main>
        </SidebarData>
      </Suspense>
    </div>
  );
}
