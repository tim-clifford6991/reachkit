/**
 * App shell layout — auth-gated, persistent sidebar, View Transitions on nav.
 *
 * §21.3 / §22.3: Four-question sidebar nav + Score + Plays + Feed + Settings +
 * Billing. Auth gate via currentUser(). Data-fetching wrapped in Suspense per
 * Next.js 16 cacheComponents requirement. Shows user email/avatar + tier badge.
 *
 * The primary app is users.app_ids[0]. If app_ids is empty, the dashboard
 * page shows an empty state linking to / to run a scan.
 *
 * First-run gate: computes setupState (profile → competitors → ready) and,
 * until "ready", renders the blocking <SetupOverlay/> over the inert shell —
 * the entire app is locked until onboarding + competitor selection complete.
 */

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/server";
import { entitlementsFor } from "@/lib/billing/entitlements";
import { serverDb } from "@/lib/db/client";
import type { ReportPayload } from "@/lib/scan/report";
import type { Tier } from "@/lib/billing/tiers";
import { activeAppId, userApps } from "@/lib/app/active-app";
import { getSelectedCompetitors } from "@/lib/scan/competitor-selection";
import { CommandPalette } from "@/components/app/command-palette";
import { AppShell } from "@/components/app/captured/app-shell";
import { ShellSkeleton } from "@/components/app/captured/skeletons";
import { SetupOverlayLazy as SetupOverlay } from "@/components/app/setup/setup-overlay-lazy";
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
  let domain: string | null = null;
  let lastScannedIso: string | null = null;
  const actionsCount = 0;

  const db = serverDb();
  if (primaryAppId) {
    const { data: appRow } = await db
      .from("apps")
      .select("name, store_url")
      .eq("id", primaryAppId)
      .maybeSingle();
    appName = appRow?.name ?? appRow?.store_url ?? null;
    domain = (appRow?.store_url as string | null) ?? null;

    const { data: scanRow } = await db
      .from("scans")
      .select("completed_at")
      .eq("app_id", primaryAppId)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    lastScannedIso = (scanRow?.completed_at as string | null) ?? null;
  }

  // ── Setup gate ─────────────────────────────────────────────────────────────
  // The blocking first-run sequence. "profile" until saveOnboarding sets
  // `onboarded_at`; then "competitors" until the active app has a confirmed
  // benchmark cohort (same source resolveIntelContext reads); else "ready".
  // Users with no scanned app can't pick competitors — they're "ready" after
  // the profile step (the dashboard empty state points at the first scan).
  let setupState: "profile" | "competitors" | "ready" = "ready";
  if (!user.onboarded_at) {
    setupState = "profile";
  } else if (primaryAppId && domain && (await getSelectedCompetitors(primaryAppId)).length === 0) {
    setupState = "competitors";
  }

  // Profile step prefill: detected ICP traits from the latest scan report
  // (fetched only when the step will actually render — report payloads are big).
  let icpSignals: string[] = [];
  if (setupState === "profile" && primaryAppId) {
    const { data: reportRow } = await db
      .from("scans")
      .select("report_payload")
      .eq("app_id", primaryAppId)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (reportRow?.report_payload) {
      const payload = reportRow.report_payload as unknown as ReportPayload;
      icpSignals = payload.whoItsFor?.signals?.slice(0, 8) ?? [];
    }
  }

  const email = user.email ?? "";
  const initials = email.slice(0, 2).toUpperCase();
  const userName = email ? email.split("@")[0]!.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Founder";

  // App switcher: the user's apps + whether the plan has a free slot to add one.
  const apps = (await userApps(user.app_ids)).map((a) => ({ id: a.id, name: a.name }));
  const APP_LIMIT: Record<string, number> = { free: 1, solo: 1, growth: 3 };
  const canAddApp = apps.length < (APP_LIMIT[tier] ?? 1);

  // Side card: paid users get the next-auto-scan countdown; free users get a
  // single upgrade prompt (no trial — the free scan is the only free capability).
  // The free CTA goes STRAIGHT to Stripe checkout (Solo default, W6) — the
  // billing page is only the error fallback / plan-comparison surface.
  let sideCard = null as null | { title: string; sub: string; cta?: { label: string; href: string; checkoutPlan?: "solo" | "growth" }; tone: "trial" | "scan" };
  if (entitlements.active && lastScannedIso) {
    // eslint-disable-next-line react-hooks/purity -- server component: single render per request, Date.now is deterministic per-request
    const d = Math.max(0, Math.ceil((new Date(lastScannedIso).getTime() + 7 * 86_400_000 - Date.now()) / 86_400_000));
    sideCard = { title: `Next auto-scan in ${d} day${d === 1 ? "" : "s"}`, sub: "Weekly tracking keeps your score current.", tone: "scan" };
  } else if (!entitlements.active) {
    sideCard = {
      title: "Unlock the weekly engine",
      sub: "Turn your report into a ranked, verified weekly action queue.",
      cta: { label: "Upgrade", href: "/app/billing", checkoutPlan: "solo" },
      tone: "trial",
    };
  }

  void actionsCount;

  const shell = (
    <AppShell
      appName={appName ?? "your site"}
      plan={PLAN_LABEL[tier] ?? "Free plan"}
      appInitial={(appName ?? "?").charAt(0).toUpperCase()}
      actionsCount={0}
      apps={apps}
      activeAppId={primaryAppId}
      canAddApp={canAddApp}
      addAppUpgradePlan={tier === "growth" ? null : "growth"}
      sideCard={sideCard}
      userName={userName}
      userRole="solo founder"
      userInitials={initials}
      lastScannedLabel={relAge(lastScannedIso)}
      scoreVersion="v3"
    >
      {children}
    </AppShell>
  );

  // Setup not complete → the SetupOverlay locks the WHOLE app. The shell still
  // renders behind it (inert, hidden from AT, unclickable) so completing setup
  // feels like unlocking the dashboard in place. The ⌘K palette only mounts once
  // the app is unlocked. Sign-out stays possible from inside the overlay.
  if (setupState !== "ready") {
    return (
      <>
        <div inert aria-hidden style={{ pointerEvents: "none", userSelect: "none" }}>
          {shell}
        </div>
        <SetupOverlay initialStep={setupState} domain={domain} icpSignals={icpSignals} />
      </>
    );
  }

  return (
    <>
      <CommandPalette />
      {shell}
    </>
  );
}

// ---------------------------------------------------------------------------
// Sidebar skeleton — shown while auth resolves
// ---------------------------------------------------------------------------

// ShellSkeleton (sidebar + header structure) renders instantly while SidebarData
// resolves; the per-tab content keeps its own structural skeleton inside.

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // The ⌘K command palette mounts inside SidebarData (only once setup is
    // complete — while the SetupOverlay locks the app, no palette either).
    <Suspense fallback={<ShellSkeleton>{children}</ShellSkeleton>}>
      <SidebarData>{children}</SidebarData>
    </Suspense>
  );
}
