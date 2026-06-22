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
import { cn } from "@/lib/utils";
import type { Tier } from "@/lib/billing/tiers";
import { APP_NAV, isNavActive } from "@/lib/app/nav";
import { AppSwitcher } from "@/components/app/app-switcher";
import type { AppOption } from "@/lib/app/active-app";

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
  apps: AppOption[];
  activeId: string | null;
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

function IconDashboard() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.25" />
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.25" />
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.25" />
      <rect x="9" y="9" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

/** Resolves an APP_NAV `iconKey` to its inline SVG (no icon-bundle weight). */
const NAV_ICONS: Record<string, React.ReactNode> = {
  dashboard: <IconDashboard />,
  channels: <IconChannels />,
  plays: <IconPlays />,
  feed: <IconFeed />,
  settings: <IconSettings />,
  billing: <IconBilling />,
};

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
          ? "var(--color-accent-subtle)"
          : "var(--fill-subtle)",
        color: isPaid ? "var(--color-accent-400)" : "var(--color-muted)",
        border: `1px solid ${isPaid ? "var(--color-accent-900)" : "var(--hairline)"}`,
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
      ? "var(--color-accent)"
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
      data-active={active ? "" : undefined}
      className={cn(
        "group/nav relative flex items-center gap-3 overflow-hidden rounded-lg px-3 py-2 text-sm",
        "text-(--color-muted) transition-[color,background,box-shadow] duration-200 ease-revolut",
        "hover:bg-[var(--fill-subtle)] hover:text-(--color-fg)",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        // Active: accent-fade gradient pill + hairline ring (premium, not flat).
        "data-active:bg-[image:var(--gradient-accent-fade)] data-active:text-(--color-fg) data-active:ring-1 data-active:ring-[var(--color-accent-900)]"
      )}
    >
      {/* Active accent bar — slides in via opacity */}
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-(--color-accent-500) transition-opacity duration-200",
          active ? "opacity-100" : "opacity-0"
        )}
      />
      <span
        className={cn(
          "shrink-0 transition-colors",
          active
            ? "text-(--color-accent-400)"
            : "text-current group-hover/nav:text-(--color-fg)"
        )}
      >
        {item.icon}
      </span>
      <span className="flex-1 leading-snug">{item.label}</span>
      {item.comingSoon && (
        <span
          className="rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest"
          style={{
            background: "var(--fill-subtle)",
            color: "var(--color-muted)",
            border: "1px solid var(--hairline)",
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
  apps,
  activeId,
}: AppSidebarProps) {
  const pathname = usePathname();

  // Route map is shared with the command palette + breadcrumbs (lib/app/nav.ts);
  // the sidebar just attaches each item's inline icon by key.
  const toNavItem = (item: (typeof APP_NAV)[number]): NavItem => ({
    href: item.href,
    label: item.label,
    icon: NAV_ICONS[item.iconKey],
  });
  const primaryItems = APP_NAV.filter((i) => i.group === "primary").map(toNavItem);
  const utilityItems = APP_NAV.filter((i) => i.group === "utility").map(toNavItem);

  const isActive = (href: string) => isNavActive(href, pathname);

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
      {/* Ambient accent wash at the top — subtle premium depth */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-40"
        style={{ background: "var(--gradient-accent-fade)" }}
      />

      {/* ── App header ──────────────────────────────────────────────────── */}
      <div className="relative z-10 px-4 pb-3 pt-4">
        <p
          className="font-mono text-[10px] uppercase tracking-widest"
          style={{ color: "var(--color-accent-400)" }}
        >
          ReachKit
        </p>
        {apps.length > 1 ? (
          <div className="mt-1.5">
            <AppSwitcher apps={apps} activeId={activeId} />
          </div>
        ) : (
          appName && (
            <p
              className="mt-0.5 truncate text-sm font-semibold"
              style={{ color: "var(--color-fg)" }}
              title={appName}
            >
              {appName}
            </p>
          )
        )}
      </div>

      {/* ── ⌘K palette trigger ──────────────────────────────────────────── */}
      <div className="relative z-10 px-3 pb-2">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("command-palette:open"))}
          aria-label="Open command palette"
          className="flex w-full items-center gap-2 rounded-lg border px-3 py-1.5 text-left text-sm text-(--color-muted) transition-colors hover:bg-[var(--fill-subtle)] hover:text-(--color-fg) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          style={{ borderColor: "var(--hairline)" }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.25" />
            <path d="M13 13l-2.5-2.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
          </svg>
          <span className="flex-1">Search…</span>
          <kbd
            className="rounded border px-1.5 py-0.5 font-mono text-[10px] leading-none"
            style={{ borderColor: "var(--hairline)", color: "var(--color-muted)" }}
          >
            ⌘K
          </kbd>
        </button>
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
      </nav>

      {/* ── Utility nav ──────────────────────────────────────────────────── */}
      <div className="space-y-0.5 px-2 pb-2">
        <Separator className="mx-1 mb-2 w-auto" />
        {utilityItems.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} />
        ))}
      </div>

      {/* ── User identity + sign out ─────────────────────────────────────── */}
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
        <form action="/auth/signout" method="post" className="shrink-0">
          <button
            type="submit"
            aria-label="Sign out"
            title="Sign out"
            className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M6 14H3.5A1.5 1.5 0 0 1 2 12.5v-9A1.5 1.5 0 0 1 3.5 2H6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
              <path d="M10.5 11 14 8l-3.5-3M14 8H6.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
      </div>
    </aside>
  );
}
