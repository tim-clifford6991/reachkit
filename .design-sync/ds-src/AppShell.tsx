/* @mirrors components/app/captured/app-shell.tsx */
import * as React from "react";

/**
 * AppShell — ReachKit's dashboard chrome: a fixed left sidebar (brand mark, the
 * app switcher, grouped icon+label nav with an active pill, a side card, and the
 * user footer with Sign out) + a header (title + subtitle + "Re-scan now")
 * wrapping a content slot. Nav mirrors the live shell: "Dashboard"; a grouped
 * "Audience" (Competitors, Customers); "Plan" with an action-count badge;
 * "History"; "Settings". The item/group matching `active` gets the violet
 * `--c-soft` / `--c-action` pill. Purely presentational — no click handling,
 * no internal state. Renders fully with no props.
 *
 * Reconciled 2026-07-15 after the card was found drifted: it said "Progress"
 * (renamed "History" in WS4) and omitted the app switcher, the side card and
 * Sign out entirely. It read GREEN throughout, because mirror-lock only watches
 * whether the LIVE file moved and `--bless` re-pins without verifying anything.
 * The label-drift gate (scripts/lib/ds-labels.mjs) now compares this card's
 * RENDERED text against the live component's labels, so that can't recur.
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
   * | "audCust" | "actions" (Plan) | "history" (Progress) | "settings".
   * Selecting a sub-item (e.g. "audComp") also highlights its parent group.
   */
  active?: string;
  user?: { name: string; sub: string };
  headerTitle?: string;
  headerSub?: string;
  /** Tracked product shown in the app switcher. */
  appName?: string;
  appInitial?: string;
  /** Plan label under the product name in the switcher. */
  plan?: string;
  /** Side card above the user footer (next auto-scan / upgrade nudge). */
  sideCardTitle?: string;
  sideCardSub?: string;
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

function NavItem({ icon, label, active, badge }: { icon: React.ReactNode; label: string; active: boolean; badge?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderRadius: "var(--radius-lg)", fontSize: 14.5, fontWeight: 600, ...pill(active) }}>
      {icon}
      {label}
      {badge != null && (
        <span style={{ marginLeft: "auto", background: "var(--c-action)", color: "var(--c-on-dark)", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 7 }}>{badge}</span>
      )}
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
  appName = "nudgi.ai",
  appInitial = "N",
  plan = "Growth",
  sideCardTitle = "Next auto-scan in 4 days",
  sideCardSub = "Weekly tracking keeps your score current.",
  children,
}: AppShellProps) {
  const activeKey = active ?? "dashboard";
  const resolvedUser = user ?? { name: userName ?? "Nadia L.", sub: userRole ?? "nudgi.ai · solo founder" };
  const resolvedTitle = headerTitle ?? title ?? "Dashboard";
  const resolvedSub = headerSub ?? subtitle ?? "Your score, your edge, and this week's highest-leverage move — at a glance.";
  const initials = resolvedUser.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "RK";

  const isAudComp = activeKey === "audComp";
  const isAudCust = activeKey === "audCust";
  const isReportGroup = activeKey === "report" || isAudComp || isAudCust;
  const isPlan = activeKey === "actions" || activeKey === "plan";

  return (
    <div style={{ fontFamily: "var(--font-sans)", color: "var(--c-ink)", minHeight: 560 }}>
      <div style={{ display: "grid", gridTemplateColumns: "248px 1fr", minHeight: 560, background: "var(--c-bg2)" }}>
        <aside style={{ background: "var(--c-surface)", borderRight: "1px solid var(--c-line)", display: "flex", flexDirection: "column", padding: "22px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "6px 8px 24px" }}>
            <svg viewBox="0 0 28 28" style={{ width: 30, height: 30, flex: "0 0 auto" }}>
              <rect width="28" height="28" rx="9" fill="var(--c-action)" />
              <circle cx="14" cy="14" r="1.7" fill="#fff" />
              <path d="M14 19 A5 5 0 1 1 19 14" stroke="#fff" strokeWidth="1.7" fill="none" strokeLinecap="round" />
              <path d="M14 23 A9 9 0 1 1 23 14" stroke="#C3B2FF" strokeWidth="1.7" fill="none" strokeLinecap="round" />
            </svg>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 19, color: "var(--c-ink)", letterSpacing: "-0.01em" }}>ReachKit</span>
          </div>
          {/* App switcher — the live shell's product selector sits between the
              brand and the nav. This card omitted it entirely, which is why the
              multi-app model was invisible in the DS. */}
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 8px", marginBottom: 14, border: "1px solid var(--c-line)", borderRadius: "var(--radius-lg)", background: "var(--c-surface)" }}>
            <span style={{ flex: "0 0 auto", width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg, var(--c-action), #9A88FF)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: "var(--font-display)" }}>{appInitial}</span>
            <div style={{ flex: "1 1 0%", minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--c-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{appName}</div>
              <div style={{ fontSize: 11.5, color: "var(--c-faint)" }}>{plan}</div>
            </div>
            <span style={{ flex: "0 0 auto", color: "var(--c-faint)", fontSize: 11 }}>▾</span>
          </div>
          <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <NavItem icon={ICON_DASHBOARD} label="Dashboard" active={activeKey === "dashboard"} />
            <NavGroup icon={ICON_AUDIENCE} label="Audience" groupActive={isReportGroup}>
              <NavSubItem label="Competitors" active={isAudComp} />
              <NavSubItem label="Customers" active={isAudCust} />
            </NavGroup>
            <NavItem icon={ICON_PLAN} label="Plan" active={isPlan} badge={3} />
            {/* "History" — renamed from "Progress" in WS4. The card kept saying
                "Progress" for weeks because mirror-lock only watches whether the
                LIVE file moved, and a bless re-pins without verifying. */}
            <NavItem icon={ICON_PROGRESS} label="History" active={activeKey === "history"} />
            <NavItem icon={ICON_SETTINGS} label="Settings" active={activeKey === "settings"} />
          </nav>
          {/* Side card — the live shell shows the next-auto-scan (paid) or an
              upgrade CTA above the user footer. */}
          <div style={{ marginTop: "auto" }}>
            <div style={{ background: "linear-gradient(150deg, var(--c-dark), var(--c-dark2))", borderRadius: 13, padding: 15, color: "#fff", marginBottom: 10 }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14.5 }}>{sideCardTitle}</div>
              <div style={{ fontSize: 12, color: "#B7B4C4", marginTop: 5 }}>{sideCardSub}</div>
            </div>
          </div>
          {/* User footer — mirrors the live sidebar footer 1:1, including the
              labelled Sign out (WS6) that this card previously omitted, and the
              2026-07-15 layout fix: the identity block TRUNCATES (a long
              userName has no natural break) while Sign out never shrinks, so the
              name gives way instead of colliding with the control. */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 8px", borderTop: "1px solid var(--c-line2)" }}>
            <span style={{ flexShrink: 0, width: 30, height: 30, borderRadius: "var(--radius-full)", background: "var(--c-soft)", color: "var(--c-action)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>{initials}</span>
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3, flex: "1 1 0%", minWidth: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--c-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{resolvedUser.name}</span>
              <span style={{ fontSize: 11.5, color: "var(--c-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{resolvedUser.sub}</span>
            </div>
            <span style={{ display: "inline-flex", flexShrink: 0, alignItems: "center", gap: 6, color: "var(--c-faint)", fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 600, lineHeight: 1, whiteSpace: "nowrap" }}>
              <span style={{ fontSize: 14 }}>⏻</span>Sign out
            </span>
          </div>
        </aside>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <header style={{ background: "var(--c-glass)", backdropFilter: "blur(10px)", borderBottom: "1px solid var(--c-line)", padding: "24px 40px 20px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24 }}>
            <div>
              <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 25, color: "var(--c-ink)", margin: 0, letterSpacing: "-0.01em" }}>{resolvedTitle}</h1>
              <p style={{ fontSize: 13.5, color: "var(--c-muted)", margin: "6px 0 0", maxWidth: 640 }}>{resolvedSub}</p>
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
