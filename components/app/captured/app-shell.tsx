"use client";

/**
 * AppShell — the Claude Design app chrome (sidebar + sticky header), converted
 * to React 1:1 from the Phase-0 capture (exact inline styles). Wraps the app
 * routes; nav active state + header title derive from the current path. Wired to
 * live data via props (app name, tier, score-version, user, actions count).
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

const SG = "Space Grotesk", PJ = "Plus Jakarta Sans", JM = "JetBrains Mono";

const NAV: { label: string; href: string; badge?: boolean; icon: React.ReactNode }[] = [
  { label: "Dashboard", href: "/app", icon: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>
  ) },
  { label: "Report", href: "/app/report", icon: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3v5h5" /><path d="M19 8v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h8z" /><path d="M9 13h6M9 17h4" /></svg>
  ) },
  { label: "Actions", href: "/app/plays", badge: true, icon: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3 8-8" /><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" /></svg>
  ) },
  { label: "History", href: "/app/history", icon: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></svg>
  ) },
  { label: "Settings", href: "/app/settings", icon: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 7.5 19.4l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3 12.6V12a2 2 0 0 1 4 0v.09c.7.32 1.5.13 2-.41" /></svg>
  ) },
] as const;

const TITLES: Record<string, string> = {
  "/app": "Dashboard", "/app/report": "Report", "/app/plays": "Actions",
  "/app/history": "History", "/app/settings": "Settings", "/app/billing": "Billing",
};

export interface AppShellProps {
  appName: string;
  plan: string;
  appInitial: string;
  actionsCount: number;
  nextScanLabel: string;
  userName: string;
  userRole: string;
  userInitials: string;
  lastScannedLabel: string;
  scoreVersion: string;
  children: React.ReactNode;
}

export function AppShell(p: AppShellProps) {
  const pathname = usePathname() || "/app";
  const activeHref =
    [...NAV].sort((a, b) => b.href.length - a.href.length).find((n) => pathname === n.href || (n.href !== "/app" && pathname.startsWith(n.href)))?.href ?? "/app";
  const title = TITLES[activeHref] ?? "Dashboard";

  return (
    <div style={{ fontFamily: `${PJ}, sans-serif`, color: "#14131A", minHeight: "100vh" }}>
      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", minHeight: "100vh", background: "#FAFAFC" }}>
        {/* Sidebar */}
        <aside style={{ background: "#fff", borderRight: "1px solid #EEEDF3", display: "flex", flexDirection: "column", padding: "18px 14px", position: "sticky", top: 0, height: "100vh" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px 18px" }}>
            <svg width="26" height="26" viewBox="0 0 28 28"><rect width="28" height="28" rx="9" fill="#6E56F7" /><circle cx="14" cy="14" r="1.7" fill="#fff" /><path d="M14 19 A5 5 0 1 1 19 14" stroke="#fff" strokeWidth="1.7" fill="none" strokeLinecap="round" /><path d="M14 23 A9 9 0 1 1 23 14" stroke="#C3B2FF" strokeWidth="1.7" fill="none" strokeLinecap="round" /></svg>
            <span style={{ fontFamily: SG, fontWeight: 700, fontSize: 17 }}>ReachKit</span>
          </div>
          {/* Product switcher */}
          <div style={{ position: "relative", marginBottom: 16 }}>
            <button style={{ width: "100%", fontFamily: PJ, background: "#FAFAFC", border: "1px solid #EEEDF3", borderRadius: 11, padding: "9px 11px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", textAlign: "left" }}>
              <span style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg, #6E56F7, #9A88FF)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: SG, flex: "0 0 auto" }}>{p.appInitial}</span>
              <div style={{ flex: "1 1 0%", minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#14131A" }}>{p.appName}</div>
                <div style={{ fontSize: 11.5, color: "#9A97A5" }}>{p.plan}</div>
              </div>
              <span style={{ color: "#9A97A5", fontSize: 11 }}>▾</span>
            </button>
          </div>
          {/* Nav */}
          <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {NAV.map((n) => {
              const active = n.href === activeHref;
              return (
                <Link key={n.href} href={n.href} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 11px", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: active ? 600 : 500, color: active ? "#6E56F7" : "#56535F", background: active ? "#F2EEFF" : "transparent", textDecoration: "none" }}>
                  {n.icon}{n.label}
                  {n.badge && p.actionsCount > 0 && (
                    <span style={{ marginLeft: "auto", background: "#6E56F7", color: "#fff", fontFamily: JM, fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 7 }}>{p.actionsCount}</span>
                  )}
                </Link>
              );
            })}
          </nav>
          <div style={{ flex: "1 1 0%" }} />
          {/* Next-scan card */}
          <div style={{ background: "linear-gradient(150deg, #14131A, #2B2640)", borderRadius: 13, padding: 15, color: "#fff", marginBottom: 10 }}>
            <div style={{ fontFamily: SG, fontWeight: 700, fontSize: 14.5 }}>{p.nextScanLabel}</div>
            <div style={{ fontSize: 12, color: "#B7B4C4", margin: "5px 0 11px" }}>Weekly tracking is on. Re-run anytime.</div>
            <button style={{ width: "100%", fontFamily: PJ, fontWeight: 600, fontSize: 12.5, background: "#6E56F7", color: "#fff", border: "none", borderRadius: 8, padding: 8, cursor: "pointer" }}>Re-scan now</button>
          </div>
          {/* User footer */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, borderTop: "1px solid #F0EEF6" }}>
            <span style={{ width: 30, height: 30, borderRadius: "50%", background: "#E7E2FF", color: "#6E56F7", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>{p.userInitials}</span>
            <div style={{ flex: "1 1 0%", minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{p.userName}</div>
              <div style={{ fontSize: 11.5, color: "#9A97A5" }}>{p.userRole}</div>
            </div>
            <Link href="/auth/signout" title="Sign out" style={{ color: "#9A97A5", cursor: "pointer", fontSize: 15, textDecoration: "none" }}>⏻</Link>
          </div>
        </aside>

        {/* Content column */}
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <header style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(10px)", borderBottom: "1px solid #EEEDF3", padding: "15px 28px", display: "flex", alignItems: "center", gap: 18, position: "sticky", top: 0, zIndex: 20 }}>
            <div>
              <h1 style={{ fontFamily: SG, fontWeight: 700, fontSize: 20, letterSpacing: "-0.01em", margin: 0 }}>{title}</h1>
              <div style={{ fontSize: 12.5, color: "#9A97A5", marginTop: 1 }}>{p.lastScannedLabel} · {p.appName} · score {p.scoreVersion}</div>
            </div>
            <div style={{ flex: "1 1 0%" }} />
            <button style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: PJ, fontWeight: 600, fontSize: 13.5, color: "#fff", background: "#14131A", border: "none", borderRadius: 9, padding: "9px 15px", cursor: "pointer" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v5h-5" /></svg>Re-scan
            </button>
          </header>
          <div style={{ padding: "26px 28px 60px", overflow: "auto" }}>{p.children}</div>
        </div>
      </div>
    </div>
  );
}
