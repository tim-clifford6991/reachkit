"use client";

/**
 * NavLinks — the tiny client half of MarketingNav: highlights the current
 * page's link (usePathname + aria-current="page") with the kit's violet
 * active pill (--c-soft is documented as the "active nav" tint). Nested paths
 * count (/compare/ahrefs marks Compare). Kept minimal so MarketingNav stays a
 * server component and the (marketing) first-load budget holds.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavLink {
  label: string;
  href: string;
}

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks({ links }: { links: readonly NavLink[] }) {
  const pathname = usePathname();

  return (
    <div className="hidden items-center gap-6 sm:flex">
      {links.map((l) => {
        const active = isActivePath(pathname, l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`transition-colors ${active ? "" : "hover:text-[var(--c-ink)]"} ${focusRing}`}
            style={{
              fontSize: 14.5,
              fontWeight: active ? 600 : 500,
              color: active ? "var(--c-action)" : "var(--c-muted)",
              background: active ? "var(--c-soft)" : "transparent",
              borderRadius: 999,
              // Negative margin cancels the pill padding so link text keeps
              // the exact same position whether active or not (no layout shift).
              padding: "5px 11px",
              margin: "-5px -11px",
            }}
          >
            {l.label}
          </Link>
        );
      })}
    </div>
  );
}
