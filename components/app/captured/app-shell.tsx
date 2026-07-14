"use client";

/**
 * AppShell — the Claude Design app chrome (sidebar + sticky header), converted
 * to React 1:1 from the Phase-0 capture (exact inline styles). Wraps the app
 * routes; nav active state + header title derive from the current path. Wired to
 * live data via props (app name, tier, score-version, user, actions count).
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AppSwitcher, type SwitcherApp } from "./app-switcher-menu";
import { CheckoutButton } from "@/components/app/checkout-button";
import { ThemeToggle } from "@/components/theme-toggle";

const SG = "Space Grotesk", PJ = "Plus Jakarta Sans", JM = "JetBrains Mono";

interface NavLeaf { label: string; href: string; }
interface NavItem extends NavLeaf { badge?: boolean; icon: React.ReactNode; }
interface NavGroup { label: string; badge?: boolean; icon: React.ReactNode; children: NavLeaf[]; }

// Sidebar order: Dashboard, Audience (group), Plan (group), Progress, Settings.
const NAV: (NavItem | NavGroup)[] = [
  { label: "Dashboard", href: "/app/dashboard", icon: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></svg>
  ) },
  { label: "Audience", icon: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3" /><path d="M2 21a7 7 0 0 1 14 0" /><path d="M16 3.5a3 3 0 0 1 0 5.5M22 21a6.5 6.5 0 0 0-4-6" /></svg>
  ), children: [
    { label: "Competitors", href: "/app/audience/competitors" },
    { label: "Customers", href: "/app/audience/customers" },
  ] },
  { label: "Plan", badge: true, href: "/app/plan", icon: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3 8-8" /><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" /></svg>
  ) },
  { label: "History", href: "/app/progress", icon: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 17 9 11 13 15 21 6" /><polyline points="14 6 21 6 21 13" /></svg>
  ) },
  { label: "Settings", href: "/app/settings", icon: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 7.5 19.4l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3 12.6V12a2 2 0 0 1 4 0v.09c.7.32 1.5.13 2-.41" /></svg>
  ) },
];

function isGroup(n: NavItem | NavGroup): n is NavGroup {
  return "children" in n;
}

const TITLES: Record<string, string> = {
  "/app/dashboard": "Dashboard",
  "/app/audience/competitors": "Competitors", "/app/audience/customers": "Customers",
  "/app/progress": "History",
  "/app/settings": "Settings", "/app/billing": "Billing",
  "/app/audience": "Audience", "/app/plan": "Plan",
};

// Per-page description shown natively as the header subtitle — one consistent
// place for every page's one-line intro (replaces the floating per-view headers).
const DESCRIPTIONS: Record<string, string> = {
  "/app/dashboard": "Your score, your edge, and this week's highest-leverage move — at a glance.",
  "/app/audience/competitors": "How you and your rivals get found — channels, scores, and the gaps.",
  "/app/audience/customers": "Who your buyer is, what they search, and where they ask.",
  "/app/plan": "Your whole plan on a calendar — what to do today, what's next, and what's already verified. Click any action for its full analysis.",
  "/app/progress": "Your Discoverability Score over time and what moved it.",
};

// Off-nav subpages → the primary nav section they live under + their breadcrumb
// label. This keeps the correct top-level tab highlighted (e.g. Billing is a
// Settings subpage, not Dashboard) and drives the header breadcrumb.
const SUBPAGES: Record<string, { parent: string; label: string }> = {
  "/app/billing": { parent: "/app/settings", label: "Billing" },
};

// Flat list of every leaf href (top-level items + group children), used for
// longest-prefix active-route matching. Also maps each child href back to its
// group, so the header can render "Group / Leaf" breadcrumbs for group children.
const LEAF_HREFS: string[] = NAV.flatMap((n) => (isGroup(n) ? n.children.map((c) => c.href) : [n.href]));
const CHILD_TO_GROUP: Record<string, { label: string; firstHref: string }> = Object.fromEntries(
  NAV.filter(isGroup).flatMap((g) => {
    const firstHref = g.children[0]?.href ?? "";
    return g.children.map((c) => [c.href, { label: g.label, firstHref }]);
  })
);

export interface SideCard {
  title: string;
  sub: string;
  /** When `checkoutPlan` is set the CTA POSTs Stripe checkout directly (one
   *  click); `href` then only serves as the error fallback. */
  cta?: { label: string; href: string; checkoutPlan?: "solo" | "growth" };
  /** "trial" tints the card violet-accented; "scan" keeps the dark look. */
  tone?: "trial" | "scan";
}

export interface AppShellProps {
  appName: string;
  plan: string;
  appInitial: string;
  actionsCount: number;
  sideCard: SideCard | null;
  apps: SwitcherApp[];
  activeAppId: string | null;
  canAddApp: boolean;
  /** When at the plan's app limit: the plan that unlocks another slot (direct
   *  checkout). null (e.g. already Growth) keeps the billing-page link. */
  addAppUpgradePlan?: "growth" | null;
  userName: string;
  userRole: string;
  userInitials: string;
  lastScannedLabel: string;
  scoreVersion: string;
  children: React.ReactNode;
}

// A group's header row + its indented child links. Local `useState` controls
// expand/collapse, defaulting open (including whenever a child is active).
function NavGroupRow({ group, pathname, actionsCount }: { group: NavGroup; pathname: string; actionsCount: number }) {
  const hasActiveChild = group.children.some((c) => pathname === c.href);
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "9px 11px", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: hasActiveChild ? 600 : 500, color: hasActiveChild ? "var(--c-action)" : "var(--c-muted)", background: hasActiveChild ? "var(--c-soft)" : "transparent", border: "none", textAlign: "left", fontFamily: PJ }}
      >
        {group.icon}{group.label}
        {group.badge && actionsCount > 0 && (
          <span style={{ marginLeft: "auto", background: "var(--c-action)", color: "#fff", fontFamily: JM, fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 7 }}>{actionsCount}</span>
        )}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: group.badge && actionsCount > 0 ? 6 : "auto", flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 1, marginTop: 2 }}>
          {group.children.map((c) => {
            const active = pathname === c.href;
            return (
              <Link key={c.href} href={c.href} style={{ display: "block", padding: "8px 11px 8px 38px", borderRadius: 10, cursor: "pointer", fontSize: 13.5, fontWeight: active ? 600 : 500, color: active ? "var(--c-action)" : "var(--c-muted)", background: active ? "var(--c-soft)" : "transparent", textDecoration: "none" }}>
                {c.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AppShell(p: AppShellProps) {
  const pathname = usePathname() || "/app";
  const sub = SUBPAGES[pathname];
  const activeLeaf =
    [...LEAF_HREFS].sort((a, b) => b.length - a.length).find((href) => pathname === href || pathname.startsWith(href + "/")) ?? "/app/dashboard";
  const groupCrumb = CHILD_TO_GROUP[activeLeaf];
  // activeHref drives which top-level sidebar row is highlighted: a group child
  // resolves to nothing here (the group itself highlights via hasActiveChild),
  // top-level leaves resolve directly.
  const activeHref = sub?.parent ?? activeLeaf;
  const title = sub?.label ?? TITLES[activeLeaf] ?? "Dashboard";

  return (
    <div style={{ fontFamily: `${PJ}, sans-serif`, color: "var(--c-ink)", minHeight: "100vh" }}>
      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", minHeight: "100vh", background: "var(--c-bg2)" }}>
        {/* Sidebar */}
        <aside style={{ background: "var(--c-surface)", borderRight: "1px solid var(--c-line2)", display: "flex", flexDirection: "column", padding: "18px 14px", position: "sticky", top: 0, height: "100vh" }}>
          {/* Brand → always returns to the dashboard home. Link straight to
              /app/dashboard, NOT /app: /app server-redirects there, and a client
              soft-nav to a redirecting route aborts its in-flight RSC stream →
              "Connection closed" caught by the (app) error boundary. */}
          <Link href="/app/dashboard" style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px 18px", textDecoration: "none", color: "inherit" }}>
            <svg width="26" height="26" viewBox="0 0 28 28"><rect width="28" height="28" rx="9" fill="#6E56F7" /><circle cx="14" cy="14" r="1.7" fill="#fff" /><path d="M14 19 A5 5 0 1 1 19 14" stroke="#fff" strokeWidth="1.7" fill="none" strokeLinecap="round" /><path d="M14 23 A9 9 0 1 1 23 14" stroke="#C3B2FF" strokeWidth="1.7" fill="none" strokeLinecap="round" /></svg>
            <span style={{ fontFamily: SG, fontWeight: 700, fontSize: 17 }}>ReachKit</span>
          </Link>
          {/* Product switcher — functional dropdown (swap / add app) */}
          <AppSwitcher
            apps={p.apps}
            activeId={p.activeAppId}
            appName={p.appName}
            appInitial={p.appInitial}
            plan={p.plan}
            canAddApp={p.canAddApp}
            addAppUpgradePlan={p.addAppUpgradePlan ?? null}
          />
          {/* Nav */}
          <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {NAV.map((n) => {
              if (isGroup(n)) {
                return <NavGroupRow key={n.label} group={n} pathname={pathname} actionsCount={p.actionsCount} />;
              }
              const active = n.href === activeHref;
              return (
                <Link key={n.href} href={n.href} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 11px", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: active ? 600 : 500, color: active ? "var(--c-action)" : "var(--c-muted)", background: active ? "var(--c-soft)" : "transparent", textDecoration: "none" }}>
                  {n.icon}{n.label}
                  {n.badge && p.actionsCount > 0 && (
                    <span style={{ marginLeft: "auto", background: "var(--c-action)", color: "#fff", fontFamily: JM, fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 7 }}>{p.actionsCount}</span>
                  )}
                </Link>
              );
            })}
          </nav>
          <div style={{ flex: "1 1 0%" }} />
          {/* Side card — trial countdown (free-trial users) or next auto-scan
              (paid). Hidden for free non-trial users. */}
          {p.sideCard && (
            <div style={{ background: "linear-gradient(150deg, var(--c-dark), var(--c-dark2))", borderRadius: 13, padding: 15, color: "#fff", marginBottom: 10 }}>
              <div style={{ fontFamily: SG, fontWeight: 700, fontSize: 14.5 }}>{p.sideCard.title}</div>
              <div style={{ fontSize: 12, color: "#B7B4C4", margin: p.sideCard.cta ? "5px 0 11px" : "5px 0 0" }}>{p.sideCard.sub}</div>
              {p.sideCard.cta && (p.sideCard.cta.checkoutPlan ? (
                <CheckoutButton plan={p.sideCard.cta.checkoutPlan} fallbackHref={p.sideCard.cta.href} style={{ display: "block", width: "100%", textAlign: "center", fontFamily: PJ, fontWeight: 600, fontSize: 12.5, background: "var(--c-action)", color: "#fff", border: "none", borderRadius: 8, padding: 8 }}>{p.sideCard.cta.label}</CheckoutButton>
              ) : (
                <Link href={p.sideCard.cta.href} style={{ display: "block", textAlign: "center", fontFamily: PJ, fontWeight: 600, fontSize: 12.5, background: "var(--c-action)", color: "#fff", border: "none", borderRadius: 8, padding: 8, cursor: "pointer", textDecoration: "none" }}>{p.sideCard.cta.label}</Link>
              ))}
            </div>
          )}
          {/* User footer */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, borderTop: "1px solid var(--c-line2)" }}>
            <span style={{ width: 30, height: 30, borderRadius: "50%", background: "#E7E2FF", color: "var(--c-action)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>{p.userInitials}</span>
            <div style={{ flex: "1 1 0%", minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{p.userName}</div>
              <div style={{ fontSize: 11.5, color: "var(--c-faint)" }}>{p.userRole}</div>
            </div>
            {/* POST (not a GET link) — the route is POST-only, and a GET link
                would let prefetch/hover sign the user out. */}
            <form action="/auth/signout" method="post" style={{ display: "flex" }}>
              <button type="submit" title="Sign out" style={{ color: "var(--c-faint)", cursor: "pointer", fontSize: 15, background: "none", border: "none", padding: 0, lineHeight: 1 }}>⏻</button>
            </form>
          </div>
        </aside>

        {/* Content column */}
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <header style={{ background: "var(--c-glass)", backdropFilter: "blur(10px)", borderBottom: "1px solid var(--c-line2)", padding: "15px 28px", display: "flex", alignItems: "center", gap: 18, position: "sticky", top: 0, zIndex: 20 }}>
            <div>
              {sub ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Link href={sub.parent} style={{ fontFamily: SG, fontWeight: 700, fontSize: 20, letterSpacing: "-0.01em", color: "var(--c-faint)", textDecoration: "none" }}>{TITLES[sub.parent]}</Link>
                  <span style={{ color: "var(--c-faint)", fontSize: 16, fontWeight: 400 }}>/</span>
                  <h1 style={{ fontFamily: SG, fontWeight: 700, fontSize: 20, letterSpacing: "-0.01em", margin: 0 }}>{sub.label}</h1>
                </div>
              ) : groupCrumb ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Link href={groupCrumb.firstHref} style={{ fontFamily: SG, fontWeight: 700, fontSize: 20, letterSpacing: "-0.01em", color: "var(--c-faint)", textDecoration: "none" }}>{groupCrumb.label}</Link>
                  <span style={{ color: "var(--c-faint)", fontSize: 16, fontWeight: 400 }}>/</span>
                  <h1 style={{ fontFamily: SG, fontWeight: 700, fontSize: 20, letterSpacing: "-0.01em", margin: 0 }}>{title}</h1>
                </div>
              ) : (
                <h1 style={{ fontFamily: SG, fontWeight: 700, fontSize: 20, letterSpacing: "-0.01em", margin: 0 }}>{title}</h1>
              )}
              <div style={{ fontSize: 12.5, color: "var(--c-faint)", marginTop: 1 }}>{DESCRIPTIONS[activeLeaf] ?? `${p.lastScannedLabel} · ${p.appName} · score ${p.scoreVersion}`}</div>
            </div>
            <div style={{ flex: "1 1 0%" }} />
            <ThemeToggle className="size-8" />
          </header>
          {/* Template content area — the ONLY place app pages get spacing/width.
              Every /app page renders body-only here (no own padding/margins/max-
              width) so all tabs share identical structure; the sticky header
              above is the single page header. */}
          <div style={{ overflow: "auto" }}>
            <div style={{ maxWidth: 1440, width: "100%", margin: "0 auto", padding: "28px 32px 64px" }}>{p.children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
