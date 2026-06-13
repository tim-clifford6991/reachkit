"use client";

/**
 * AppSidebar — persistent sidebar for the /(app) shell.
 *
 * Four-question nav + Score + Plays + Feed + Settings + Billing.
 * Uses Next.js Link for View Transition-compatible navigation.
 * React 19.2 Activity state is managed by the layout.
 *
 * Receives pre-fetched data as props (layout fetches server-side).
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import type { Tier } from "@/lib/billing/tiers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AppSidebarProps {
  email: string;
  initials: string;
  tier: Tier;
  appName: string | null;
  appScore: number | null;
  hasApp: boolean;
}

// ---------------------------------------------------------------------------
// Nav item shape
// ---------------------------------------------------------------------------

interface NavItem {
  href: string;
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  comingSoon?: boolean;
}

// ---------------------------------------------------------------------------
// Icons — inline SVG to avoid any extra icon bundle weight
// ---------------------------------------------------------------------------

function IconOffer() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.25" />
      <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.25" />
      <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.25" />
      <path d="M11.5 9v6M8.5 12h6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

function IconAudience() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.25" />
      <path d="M2 13c0-2.761 2.686-5 6-5s6 2.239 6 5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

function IconChannels() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="3" cy="8" r="1.75" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="13" cy="4" r="1.75" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="13" cy="12" r="1.75" stroke="currentColor" strokeWidth="1.25" />
      <path d="M4.7 7.2L11.3 4.8M4.7 8.8L11.3 11.2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

function IconPlays() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.25" />
      <path d="M5 5h6M5 8h4M5 11h5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

function IconFeed() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2 13a9 9 0 019-9" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <path d="M2 9a5 5 0 015-5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <circle cx="3" cy="13" r="1" fill="currentColor" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.25" />
      <path
        d="M8 1.5v1.1M8 13.4v1.1M1.5 8h1.1M13.4 8h1.1M3.1 3.1l.78.78M12.12 12.12l.78.78M12.9 3.1l-.78.78M3.88 12.12l-.78.78"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconBilling() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.25" />
      <path d="M1.5 7h13" stroke="currentColor" strokeWidth="1.25" />
      <path d="M4 10h3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Tier badge
// ---------------------------------------------------------------------------

function TierBadge({ tier }: { tier: Tier }) {
  const label = tier === "growth" ? "Growth" : tier === "solo" ? "Solo" : "Free";
  const isPaid = tier !== "free";

  return (
    <span
      className="rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider"
      style={{
        background: isPaid
          ? "oklch(0.60 0.18 255 / 0.15)"
          : "oklch(1 0 0 / 0.06)",
        color: isPaid ? "var(--color-accent-400)" : "var(--color-muted)",
        border: `1px solid ${isPaid ? "var(--color-accent-900)" : "oklch(1 0 0 / 0.08)"}`,
      }}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Score mini-display for sidebar
// ---------------------------------------------------------------------------

function SidebarScore({ score }: { score: number }) {
  const color =
    score >= 70
      ? "oklch(0.72 0.17 155)"
      : score >= 40
      ? "oklch(0.60 0.18 255)"
      : "oklch(0.78 0.18 70)";

  return (
    <div className="flex items-center gap-2 px-3 py-2.5">
      <div
        className="flex size-8 shrink-0 items-center justify-center rounded-full"
        style={{
          background: `${color.replace(")", " / 0.12)")}`,
          border: `1.5px solid ${color.replace(")", " / 0.3)")}`,
        }}
      >
        <span
          className="font-mono text-[11px] font-semibold tabular-nums leading-none"
          style={{ color }}
        >
          {score}
        </span>
      </div>
      <div>
        <p className="text-xs font-medium" style={{ color: "var(--color-fg)" }}>
          Score
        </p>
        <p className="font-mono text-[10px]" style={{ color: "var(--color-muted)" }}>
          /100
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nav link
// ---------------------------------------------------------------------------

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className="group/nav relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2"
      style={{
        background: active ? "var(--color-elevated)" : "transparent",
        color: active ? "var(--color-fg)" : "var(--color-muted)",
        borderLeft: active
          ? "2px solid var(--color-accent-500)"
          : "2px solid transparent",
      }}
      onMouseEnter={(e) => {
        if (!active)
          (e.currentTarget as HTMLElement).style.color = "var(--color-fg)";
      }}
      onMouseLeave={(e) => {
        if (!active)
          (e.currentTarget as HTMLElement).style.color = "var(--color-muted)";
      }}
    >
      <span
        className="shrink-0"
        style={{
          color: active ? "var(--color-accent-400)" : "currentColor",
        }}
      >
        {item.icon}
      </span>
      <span className="flex-1 leading-snug">{item.label}</span>
      {item.comingSoon && (
        <span
          className="rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest"
          style={{
            background: "oklch(1 0 0 / 0.04)",
            color: "var(--color-muted)",
            border: "1px solid oklch(1 0 0 / 0.07)",
          }}
        >
          soon
        </span>
      )}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AppSidebar({
  email,
  initials,
  tier,
  appName,
  appScore,
  hasApp: _hasApp,
}: AppSidebarProps) {
  const pathname = usePathname();

  // Build nav items
  const questionItems: NavItem[] = [
    {
      href: "/app/offer",
      label: "What you offer",
      sublabel: "Q1",
      icon: <IconOffer />,
    },
    {
      href: "/app/audience",
      label: "Who it's for",
      sublabel: "Q2",
      icon: <IconAudience />,
    },
    {
      href: "/app/channels",
      label: "Where they are",
      sublabel: "Q3",
      icon: <IconChannels />,
    },
  ];

  const primaryItems: NavItem[] = [
    {
      href: "/app",
      label: "Dashboard",
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.25" />
          <rect x="9" y="1.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.25" />
          <rect x="1.5" y="9" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.25" />
          <rect x="9" y="9" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.25" />
        </svg>
      ),
    },
    {
      href: "/app/plays",
      label: "This week's plays",
      icon: <IconPlays />,
      comingSoon: true,
    },
    {
      href: "/app/feed",
      label: "Signal feed",
      icon: <IconFeed />,
      comingSoon: true,
    },
  ];

  const utilityItems: NavItem[] = [
    {
      href: "/app/settings",
      label: "Settings",
      icon: <IconSettings />,
    },
    {
      href: "/app/billing",
      label: "Billing",
      icon: <IconBilling />,
      comingSoon: true,
    },
  ];

  const isActive = (href: string) => {
    if (href === "/app") return pathname === "/app";
    return pathname.startsWith(href);
  };

  return (
    <aside
      className="flex w-60 shrink-0 flex-col border-r"
      style={{
        background: "var(--sidebar)",
        borderColor: "var(--sidebar-border)",
        minHeight: "100svh",
        position: "sticky",
        top: 0,
        height: "100svh",
        overflowY: "auto",
      }}
      aria-label="App navigation"
    >
      {/* ── App header ──────────────────────────────────────────────────── */}
      <div className="px-4 pb-3 pt-4">
        <p
          className="font-mono text-[10px] uppercase tracking-widest"
          style={{ color: "var(--color-muted)" }}
        >
          ReachKit
        </p>
        {appName && (
          <p
            className="mt-0.5 truncate text-sm font-semibold"
            style={{ color: "var(--color-fg)" }}
            title={appName}
          >
            {appName}
          </p>
        )}
      </div>

      {/* ── Score mini-display ────────────────────────────────────────────── */}
      {appScore !== null && (
        <>
          <SidebarScore score={appScore} />
          <Separator className="mx-3 mb-1 w-auto" />
        </>
      )}

      {/* ── Primary nav ──────────────────────────────────────────────────── */}
      <nav className="flex-1 space-y-0.5 px-2 pt-2" aria-label="Primary navigation">
        {primaryItems.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} />
        ))}

        {/* Questions sub-group */}
        <div className="pb-1 pt-3">
          <p
            className="mb-1 px-3 font-mono text-[9px] uppercase tracking-widest"
            style={{ color: "var(--color-muted)" }}
          >
            Four questions
          </p>
          {questionItems.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </div>
      </nav>

      {/* ── Utility nav ──────────────────────────────────────────────────── */}
      <div className="space-y-0.5 px-2 pb-2">
        <Separator className="mx-1 mb-2 w-auto" />
        {utilityItems.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} />
        ))}
      </div>

      {/* ── User identity ────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2.5 border-t px-3 py-3"
        style={{ borderColor: "var(--sidebar-border)" }}
      >
        <Avatar initials={initials} size="sm" aria-label={email} />
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-xs"
            style={{ color: "var(--color-fg)" }}
            title={email}
          >
            {email}
          </p>
          <TierBadge tier={tier} />
        </div>
      </div>
    </aside>
  );
}
