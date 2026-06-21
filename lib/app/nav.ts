/**
 * Single source of truth for the authenticated app's navigation.
 *
 * Pure data + helpers (no JSX) so the sidebar, command palette, and breadcrumbs
 * all share one route map. Icons are referenced by `iconKey` and resolved at the
 * render site (keeps this module server/client/test-safe and icon-bundle-free).
 */

export type NavGroup = "primary" | "utility";

export interface AppNavItem {
  href: string;
  label: string;
  group: NavGroup;
  /** Resolved to an icon at the render site (see app-sidebar icon map). */
  iconKey: string;
  /** Short hint surfaced in the command palette. */
  hint?: string;
}

export const APP_NAV: readonly AppNavItem[] = [
  { href: "/app", label: "Dashboard", group: "primary", iconKey: "dashboard", hint: "Your four-question report" },
  { href: "/app/channels", label: "Market Report", group: "primary", iconKey: "channels", hint: "Competitors, channels & playbook" },
  { href: "/app/plays", label: "This week's plays", group: "primary", iconKey: "plays", hint: "Your weekly action queue" },
  { href: "/app/feed", label: "Signal feed", group: "primary", iconKey: "feed", hint: "Weekly market changes" },
  { href: "/app/settings", label: "Settings", group: "utility", iconKey: "settings" },
  { href: "/app/billing", label: "Billing", group: "utility", iconKey: "billing" },
] as const;

/**
 * Is `href` the active nav target for `pathname`? The dashboard root matches
 * exactly; every other item matches by prefix so nested pages stay highlighted.
 * (Mirrors the original inline logic in app-sidebar.tsx.)
 */
export function isNavActive(href: string, pathname: string): boolean {
  if (href === "/app") return pathname === "/app";
  return pathname.startsWith(href);
}

export interface Breadcrumb {
  label: string;
  /** Omitted for the current (last) crumb. */
  href?: string;
}

function titleCase(segment: string): string {
  return segment
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Breadcrumb trail for an `/app/*` pathname. Always rooted at Dashboard; the
 * current page is the trailing crumb (no href). Known sections use their
 * `APP_NAV` label, unknown ones fall back to a title-cased segment.
 */
export function buildBreadcrumbs(pathname: string): Breadcrumb[] {
  if (pathname === "/app" || pathname === "") {
    return [{ label: "Dashboard" }];
  }

  const known = APP_NAV.find((i) => i.href === pathname && i.href !== "/app");
  const lastSegment = pathname.split("/").filter(Boolean).pop() ?? "";
  const label = known?.label ?? titleCase(lastSegment);

  return [{ label: "Dashboard", href: "/app" }, { label }];
}
