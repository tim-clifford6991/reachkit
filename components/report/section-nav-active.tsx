"use client";

/**
 * SectionNav (interactive) — the sticky report jump-nav with scroll-spy.
 *
 * Highlights the section currently in the top band of the viewport using a tiny
 * IntersectionObserver (same dependency-free pattern as how-it-works-scroll.tsx).
 * The pure `buildSectionNavItems` lives in ./section-nav (server-safe + tested);
 * this is re-exported from there so import sites stay unchanged.
 */

import { useEffect, useState } from "react";
import type { SectionNavItem } from "./section-nav";

export function SectionNav({ items }: { items: SectionNavItem[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (items.length < 3) return;
    const ids = items.map((i) => i.id);
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;

    const visible = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id);
          else visible.delete(e.target.id);
        }
        // Active = the first nav item (in document order) currently in the band.
        const next = ids.find((id) => visible.has(id));
        if (next) setActiveId(next);
      },
      // Band: ignore the top 15% (under the sticky nav) and bottom 75%, so the
      // "active" section is the one near the top of the readable area.
      { rootMargin: "-15% 0px -75% 0px", threshold: 0 },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [items]);

  if (items.length < 3) return null;

  return (
    <nav
      aria-label="Report sections"
      className="sticky top-2 z-20 -mx-1 overflow-x-auto rounded-full border px-1.5 py-1.5 backdrop-blur"
      style={{
        borderColor: "var(--hairline)",
        background: "color-mix(in oklch, var(--color-surface) 80%, transparent)",
      }}
    >
      <ul className="flex w-max items-center gap-1">
        {items.map((it) => {
          const active = it.id === activeId;
          return (
            <li key={it.id}>
              <a
                href={`#${it.id}`}
                aria-current={active ? "location" : undefined}
                onClick={() => setActiveId(it.id)}
                className="inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors hover:bg-[var(--fill-subtle)]"
                style={{
                  color: active ? "var(--color-fg)" : "var(--color-muted)",
                  background: active ? "var(--fill-subtle)" : "transparent",
                }}
              >
                {it.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
