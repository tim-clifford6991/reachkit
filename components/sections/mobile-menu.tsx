"use client";

/**
 * MobileMenu — hamburger + dropdown for the marketing nav below the sm
 * breakpoint, where the inline links are hidden. Lightweight (no drawer lib):
 * a button toggling a full-width panel under the nav.
 */

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

interface NavLink {
  label: string;
  href: string;
}

export function MobileMenu({ links }: { links: readonly NavLink[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="grid size-9 place-items-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {open ? <X className="size-4" /> : <Menu className="size-4" />}
      </button>

      {open && (
        <>
          {/* click-away */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 top-16 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute inset-x-0 top-full z-50 flex flex-col gap-1 border-b p-3 backdrop-blur-xl"
            style={{ background: "var(--glass-tint)", borderColor: "var(--hairline)" }}
          >
            {[...links, { label: "Log in", href: "/login" }].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-4 py-3 text-base font-medium transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                style={{ color: "var(--color-fg)" }}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
