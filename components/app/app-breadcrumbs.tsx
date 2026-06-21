"use client";

/**
 * AppBreadcrumbs — the app shell's trail, driven by the shared route map
 * (lib/app/nav → buildBreadcrumbs). Hidden on the dashboard root (single crumb).
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { buildBreadcrumbs } from "@/lib/app/nav";

export function AppBreadcrumbs() {
  const pathname = usePathname();
  const crumbs = buildBreadcrumbs(pathname);
  if (crumbs.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className="px-6 pt-4">
      <ol className="flex items-center gap-1.5 font-mono text-[11px]">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={`${c.label}-${i}`} className="flex items-center gap-1.5">
              {i > 0 && (
                <ChevronRight
                  className="size-3"
                  style={{ color: "var(--hairline-strong)" }}
                  aria-hidden
                />
              )}
              {c.href && !last ? (
                <Link
                  href={c.href}
                  className="transition-colors hover:text-(--color-fg)"
                  style={{ color: "var(--color-muted)" }}
                >
                  {c.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? "page" : undefined}
                  style={{ color: last ? "var(--color-fg)" : "var(--color-muted)" }}
                >
                  {c.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
