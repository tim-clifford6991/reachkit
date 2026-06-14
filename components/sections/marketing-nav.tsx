/**
 * MarketingNav — sticky top navigation for the marketing surface.
 *
 * Lean (modeled on Plausible / Fathom / SparkToro): a few flat links + one
 * small "Resources" dropdown (pure CSS hover/focus — no JS), the theme toggle,
 * Log in, and a primary CTA. Collapses to a hamburger below the sm breakpoint.
 */

import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { Wordmark } from "@/components/brand/logo";
import { MobileMenu } from "./mobile-menu";

const LINKS = [
  { label: "How it works", href: "/how-it-works" },
  { label: "Teardowns", href: "/teardowns" },
  { label: "Pricing", href: "/pricing" },
] as const;

const RESOURCES = [
  { label: "Blog", href: "/blog" },
  { label: "Free tools", href: "/tools" },
  { label: "Changelog", href: "/changelog" },
  { label: "Help & docs", href: "/docs" },
] as const;

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

export function MarketingNav() {
  return (
    <header
      className="sticky top-0 z-50 backdrop-blur-xl"
      style={{ background: "var(--glass-tint)", borderBottom: "1px solid var(--hairline)" }}
    >
      <nav
        className="mx-auto flex h-16 max-w-[var(--spacing-content-max)] items-center justify-between gap-4 px-(--spacing-content-x)"
        aria-label="Primary"
      >
        {/* Wordmark */}
        <Link href="/" className={`rounded-lg ${focusRing}`} aria-label="ReachKit home">
          <Wordmark />
        </Link>

        {/* Center links */}
        <div className="hidden items-center gap-1 sm:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-full px-3.5 py-2 text-sm font-medium transition-colors hover:bg-secondary ${focusRing}`}
              style={{ color: "var(--color-muted)" }}
            >
              {l.label}
            </Link>
          ))}

          {/* Resources dropdown — CSS hover/focus, no JS */}
          <div className="group relative">
            <button
              type="button"
              aria-haspopup="true"
              className={`inline-flex items-center gap-1 rounded-full px-3.5 py-2 text-sm font-medium transition-colors hover:bg-secondary group-hover:bg-secondary ${focusRing}`}
              style={{ color: "var(--color-muted)" }}
            >
              Resources
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden className="mt-px transition-transform group-hover:rotate-180">
                <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {/* pt-2 bridges the hover gap so the menu doesn't flicker shut */}
            <div className="invisible absolute left-0 top-full pt-2 opacity-0 transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
              <div
                className="flex min-w-48 flex-col gap-0.5 rounded-xl border p-1.5 shadow-[var(--elevation-lg),var(--edge-highlight)] backdrop-blur-xl"
                style={{ background: "var(--glass-tint)", borderColor: "var(--hairline)" }}
              >
                {RESOURCES.map((r) => (
                  <Link
                    key={r.href}
                    href={r.href}
                    className={`rounded-lg px-3 py-2 text-sm transition-colors hover:bg-secondary ${focusRing}`}
                    style={{ color: "var(--color-fg)" }}
                  >
                    {r.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <ThemeToggle />
          <Link
            href="/login"
            className={`hidden rounded-full px-3.5 py-2 text-sm font-medium transition-colors hover:bg-secondary sm:inline-flex ${focusRing}`}
            style={{ color: "var(--color-fg)" }}
          >
            Log in
          </Link>
          <Link
            href="/scan"
            className={`inline-flex items-center rounded-full px-4 py-2.5 text-sm font-semibold shadow-[var(--elevation-glow)] transition-transform hover:-translate-y-px active:translate-y-0 motion-reduce:transform-none ${focusRing}`}
            style={{ background: "var(--color-accent)", color: "var(--color-accent-fg)" }}
          >
            Scan my app
          </Link>
          <MobileMenu links={[...LINKS, ...RESOURCES]} />
        </div>
      </nav>
    </header>
  );
}
