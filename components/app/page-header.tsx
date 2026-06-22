"use client";

/**
 * PageHeader — the Glassy Bento shell header (Phase 2): a sticky, blurred-glass
 * bar showing the section title + breadcrumb trail, floating over the content as
 * it scrolls. Replaces the plain breadcrumb row and each page's own title block.
 * Sticks to the viewport scroll, so no layout-frame change is required.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { buildBreadcrumbs } from "@/lib/app/nav";

export function PageHeader() {
  const pathname = usePathname();
  const crumbs = buildBreadcrumbs(pathname);
  const title = crumbs[crumbs.length - 1]?.label ?? "Dashboard";
  const parents = crumbs.slice(0, -1);

  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-2.5 border-b px-6 py-3"
      style={{
        background: "var(--glass-tint)",
        backdropFilter: "blur(var(--glass-blur))",
        WebkitBackdropFilter: "blur(var(--glass-blur))",
        borderColor: "var(--glass-border)",
      }}
    >
      {parents.length > 0 && (
        <nav aria-label="Breadcrumb" className="hidden items-center gap-2.5 sm:flex">
          <ol className="flex items-center gap-2.5 font-mono text-[11px]">
            {parents.map((c, i) => (
              <li key={`${c.label}-${i}`} className="flex items-center gap-2.5">
                {c.href ? (
                  <Link href={c.href} className="transition-colors hover:text-(--color-fg)" style={{ color: "var(--color-muted)" }}>
                    {c.label}
                  </Link>
                ) : (
                  <span style={{ color: "var(--color-muted)" }}>{c.label}</span>
                )}
              </li>
            ))}
          </ol>
          <ChevronRight className="size-3" style={{ color: "var(--hairline-strong)" }} aria-hidden />
        </nav>
      )}
      <h1 className="text-sm font-semibold tracking-tight" style={{ color: "var(--color-fg)" }} aria-current="page">
        {title}
      </h1>
    </header>
  );
}
