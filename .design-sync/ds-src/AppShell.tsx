import * as React from "react";

/**
 * AppShell — ReachKit's dashboard chrome: a fixed left sidebar (brand mark,
 * icon+label nav with an active pill, user footer) + a sticky header (title +
 * subtitle) wrapping a content slot. The nav item matching `activeHref` gets the
 * violet active style. Renders fully with no props.
 */
export interface AppShellProps {
  activeHref?: string;
  title?: string;
  subtitle?: string;
  userName?: string;
  userRole?: string;
  children?: React.ReactNode;
}

const NAV: { label: string; href: string; icon: React.ReactNode }[] = [
  { label: "Dashboard", href: "/app", icon: <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg> },
  { label: "Report", href: "/app/report", icon: <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M14 3v5h5" /><path d="M19 8v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h8z" /><path d="M9 13h6M9 17h4" /></svg> },
  { label: "Actions", href: "/app/plays", icon: <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3 8-8" /><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" /></svg> },
  { label: "History", href: "/app/history", icon: <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></svg> },
  { label: "Settings", href: "/app/settings", icon: <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 7.5 19.4l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3 12.6V12a2 2 0 0 1 4 0v.09c.7.32 1.5.13 2-.41" /></svg> },
];

export function AppShell({ activeHref = "/app", title = "Dashboard", subtitle = "Last scanned 2 days ago · nudgi.ai · score v3", userName = "Design Preview", userRole = "solo founder", children }: AppShellProps) {
  const initials = userName.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "RK";
  return (
    <div style={{ fontFamily: "var(--font-sans)", color: "var(--c-ink)", minHeight: 560 }}>
      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", minHeight: 560, background: "var(--c-bg2)" }}>
        <aside style={{ background: "var(--c-surface)", borderRight: "1px solid var(--c-line2)", display: "flex", flexDirection: "column", padding: "18px 14px" }}>
          <a href="/app" style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px 18px", textDecoration: "none", color: "inherit" }}>
            <svg width={26} height={26} viewBox="0 0 28 28" fill="none"><rect width="28" height="28" rx="9" fill="#6E56F7" /><circle cx="14" cy="14" r="1.7" fill="#fff" /><path d="M14 19 A5 5 0 1 1 19 14" stroke="#fff" strokeWidth="1.7" fill="none" strokeLinecap="round" /><path d="M14 23 A9 9 0 1 1 23 14" stroke="#C3B2FF" strokeWidth="1.7" fill="none" strokeLinecap="round" /></svg>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17 }}>ReachKit</span>
          </a>
          <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {NAV.map((n) => {
              const active = n.href === activeHref;
              return (
                <a key={n.href} href={n.href} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 11px", borderRadius: "var(--radius-md)", fontSize: 14, fontWeight: active ? 600 : 500, color: active ? "var(--c-action)" : "var(--c-muted)", background: active ? "var(--c-soft)" : "transparent", textDecoration: "none" }}>{n.icon}{n.label}</a>
              );
            })}
          </nav>
          <div style={{ flex: "1 1 0%" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, borderTop: "1px solid var(--c-line2)" }}>
            <span style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--c-soft)", color: "var(--c-action)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{initials}</span>
            <div style={{ flex: "1 1 0%", minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{userName}</div>
              <div style={{ fontSize: 11.5, color: "var(--c-faint)" }}>{userRole}</div>
            </div>
          </div>
        </aside>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <header style={{ background: "var(--c-glass)", backdropFilter: "blur(10px)", borderBottom: "1px solid var(--c-line2)", padding: "15px 28px", display: "flex", alignItems: "center", gap: 18 }}>
            <div>
              <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, letterSpacing: "-0.01em", margin: 0 }}>{title}</h1>
              <div style={{ fontSize: 12.5, color: "var(--c-faint)", marginTop: 1 }}>{subtitle}</div>
            </div>
          </header>
          <div style={{ overflow: "auto" }}>
            <div style={{ maxWidth: 1440, width: "100%", margin: "0 auto", padding: "28px 32px 64px" }}>
              {children ?? (
                <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-lg)", padding: "40px 28px", color: "var(--c-muted)", fontSize: 14 }}>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: "var(--c-ink)", marginBottom: 6 }}>Content area</div>
                  Page content renders here.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
