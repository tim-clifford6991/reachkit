/* @mirrors components/app/captured/app-shell.tsx */
import * as React from "react";

/**
 * AppShell — ReachKit's dashboard chrome: a fixed left sidebar (brand mark,
 * grouped icon+label nav with an active pill, user footer) + a header (title +
 * subtitle + "Re-scan now") wrapping a content slot. Nav structure mirrors the
 * canonical template: a top-level "Dashboard" item; a grouped "Audience"
 * section (Competitors, Customers); a grouped "Plan" section (Content,
 * Distribution); "Progress"; "Settings". The item/group matching `active`
 * gets the violet `--c-soft` / `--c-action` pill. Purely presentational — no
 * click handling, no internal state. Renders fully with no props.
 */
export interface AppShellProps {
  /** @deprecated use `active` — key of the highlighted nav item/group */
  activeHref?: string;
  /** @deprecated use `headerTitle` */
  title?: string;
  /** @deprecated use `headerSub` */
  subtitle?: string;
  /** @deprecated use `user.name` */
  userName?: string;
  /** @deprecated use `user.sub` */
  userRole?: string;
  /**
   * Highlighted nav key: "dashboard" | "report" (Audience group) | "audComp"
   * | "audCust" | "actions" (Plan group) | "planContent" | "planDist" |
   * "history" (Progress) | "settings". Selecting a sub-item (e.g. "audComp")
   * also highlights its parent group ("report").
   */
  active?: string;
  user?: { name: string; sub: string };
  headerTitle?: string;
  headerSub?: string;
  children?: React.ReactNode;
}

const DOT = <span style={{ width: 5, height: 5, borderRadius: 99, background: "currentColor", flex: "0 0 auto" }} />;

const ICON_DASHBOARD = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 18, height: 18 }}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);
const ICON_AUDIENCE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" style={{ width: 18, height: 18, flex: "0 0 auto" }}>
    <path d="M6 3h8l4 4v14H6z" /><path d="M9 12h6M9 16h6" />
  </svg>
);
const ICON_PLAN = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18, flex: "0 0 auto" }}>
    <rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 12l3 3 5-6" />
  </svg>
);
const ICON_PROGRESS = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" style={{ width: 18, height: 18 }}>
    <circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" />
  </svg>
);
const ICON_SETTINGS = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" style={{ width: 18, height: 18 }}>
    <path d="M4 8h9M17 8h3M4 16h3M11 16h9" /><circle cx="15" cy="8" r="2.3" /><circle cx="9" cy="16" r="2.3" />
  </svg>
);
const ICON_CARET = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);
const ICON_RESCAN = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" style={{ width: 15, height: 15 }}>
    <path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v6h-6" />
  </svg>
);

function pill(isActive: boolean) {
  return { background: isActive ? "var(--c-soft)" : "transparent", color: isActive ? "var(--c-action)" : "var(--c-muted)" };
}

function NavItem({ icon, label, active }: { icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderRadius: "var(--radius-lg)", fontSize: 14.5, fontWeight: 600, ...pill(active) }}>
      {icon}
      {label}
    </div>
  );
}

function NavSubItem({ label, active }: { label: string; active: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 12px 7px 42px", borderRadius: "var(--radius-lg)", fontSize: 13, fontWeight: 600, ...pill(active) }}>
      {DOT}
      {label}
    </div>
  );
}

function NavGroup({ icon, label, groupActive, children }: { icon: React.ReactNode; label: string; groupActive: boolean; children: React.ReactNode }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", borderRadius: "var(--radius-lg)", ...pill(groupActive) }}>
        <div style={{ flex: "1 1 0%", minWidth: 0, display: "flex", alignItems: "center", gap: 12, padding: "11px 4px 11px 12px", fontSize: 14.5, fontWeight: 600 }}>
          {icon}
          {label}
        </div>
        <div style={{ flex: "0 0 auto", alignSelf: "stretch", display: "flex", alignItems: "center", justifyContent: "center", width: 32 }}>
          {ICON_CARET}
        </div>
      </div>
      {children}
    </>
  );
}

export function AppShell({
  activeHref,
  title,
  subtitle,
  userName,
  userRole,
  active,
  user,
  headerTitle,
  headerSub,
  children,
}: AppShellProps) {
  const activeKey = active ?? "dashboard";
  const resolvedUser = user ?? { name: userName ?? "Nadia L.", sub: userRole ?? "nudgi.ai · solo founder" };
  const resolvedTitle = headerTitle ?? title ?? "Dashboard";
  const resolvedSub = headerSub ?? subtitle ?? "Last scanned 2 days ago · nudgi.ai · score v3";
  const initials = resolvedUser.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "RK";

  const isAudComp = activeKey === "audComp";
  const isAudCust = activeKey === "audCust";
  const isReportGroup = activeKey === "report" || isAudComp || isAudCust;
  const isPlanContent = activeKey === "planContent";
  const isPlanDist = activeKey === "planDist";
  const isPlanGroup = activeKey === "actions" || isPlanContent || isPlanDist;

  return (
    <div style={{ fontFamily: "var(--font-sans)", color: "var(--c-ink)", minHeight: 560 }}>
      <div style={{ display: "grid", gridTemplateColumns: "248px 1fr", minHeight: 560, background: "var(--c-bg2)" }}>
        <aside style={{ background: "var(--c-surface)", borderRight: "1px solid var(--c-line)", display: "flex", flexDirection: "column", padding: "22px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "6px 8px 24px" }}>
            <span style={{ width: 32, height: 32, borderRadius: 9, background: "var(--c-action)", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
              <svg viewBox="0 0 100 100" fill="none" style={{ width: 19, height: 19 }}>
                <g stroke="#fff" strokeWidth={8.5} strokeLinecap="round">
                  <circle cx="40" cy="60" r="30" strokeDasharray="141 230" transform="rotate(140 40 60)" />
                  <circle cx="40" cy="60" r="17" strokeDasharray="80 130" transform="rotate(140 40 60)" />
                </g>
                <circle cx="40" cy="60" r="8" fill="#fff" />
              </svg>
            </span>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 19, color: "var(--c-ink)", letterSpacing: "-0.01em" }}>ReachKit</span>
          </div>
          <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <NavItem icon={ICON_DASHBOARD} label="Dashboard" active={activeKey === "dashboard"} />
            <NavGroup icon={ICON_AUDIENCE} label="Audience" groupActive={isReportGroup}>
              <NavSubItem label="Competitors" active={isAudComp} />
              <NavSubItem label="Customers" active={isAudCust} />
            </NavGroup>
            <NavGroup icon={ICON_PLAN} label="Plan" groupActive={isPlanGroup}>
              <NavSubItem label="Content" active={isPlanContent} />
              <NavSubItem label="Distribution" active={isPlanDist} />
            </NavGroup>
            <NavItem icon={ICON_PROGRESS} label="Progress" active={activeKey === "history"} />
            <NavItem icon={ICON_SETTINGS} label="Settings" active={activeKey === "settings"} />
          </nav>
          <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 11, padding: "14px 8px 4px", borderTop: "1px solid var(--c-line)" }}>
            <span style={{ width: 34, height: 34, borderRadius: "var(--radius-full)", background: "var(--c-soft)", color: "var(--c-action)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flex: "0 0 auto" }}>{initials}</span>
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3, minWidth: 0 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--c-ink)" }}>{resolvedUser.name}</span>
              <span style={{ fontSize: 12, color: "var(--c-faint)" }}>{resolvedUser.sub}</span>
            </div>
          </div>
        </aside>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <header style={{ background: "var(--c-glass)", backdropFilter: "blur(10px)", borderBottom: "1px solid var(--c-line)", padding: "24px 40px 20px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24 }}>
            <div>
              <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 25, color: "var(--c-ink)", margin: 0, letterSpacing: "-0.01em" }}>{resolvedTitle}</h1>
              <p style={{ fontSize: 13, color: "var(--c-faint)", margin: "5px 0 0", fontFamily: "var(--font-mono)", letterSpacing: "0.01em", whiteSpace: "nowrap" }}>{resolvedSub}</p>
            </div>
            <button style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid var(--c-line)", background: "var(--c-surface)", color: "var(--c-ink)", fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 13.5, padding: "10px 16px", borderRadius: "var(--radius-lg)", cursor: "pointer", whiteSpace: "nowrap" }}>
              {ICON_RESCAN}
              Re-scan now
            </button>
          </header>
          <div style={{ overflow: "auto" }}>
            <div style={{ maxWidth: 1440, width: "100%", margin: "0 auto", padding: "34px 40px 120px" }}>
              {children ?? (
                <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-md)", padding: "40px 28px", color: "var(--c-muted)", fontSize: 14 }}>
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
