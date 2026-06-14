/**
 * Footer — §21.1 marketing section.
 *
 * Brand block (mark + tagline + social) on the left, up to four nav columns on
 * the right, then a legal + copyright row. Content-as-props. Server component.
 */

import Link from "next/link";

import { LogoMark } from "@/components/brand/logo";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FooterNavItem {
  label: string;
  href: string;
  /** External links open in a new tab. */
  external?: boolean;
}

export interface FooterNavColumn {
  heading: string;
  items: readonly FooterNavItem[];
}

export type FooterSocialIcon = "x" | "github" | "rss";

export interface FooterSocialLink {
  label: string;
  href: string;
  icon: FooterSocialIcon;
}

export interface FooterContent {
  brand: string;
  tagline?: string;
  columns: readonly FooterNavColumn[];
  legal: readonly FooterNavItem[];
  social?: readonly FooterSocialLink[];
  copyright?: string;
  attribution?: string;
}

export interface FooterProps {
  content: FooterContent;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Footer({ content }: FooterProps) {
  const { brand, tagline, columns, legal, social, copyright, attribution } = content;

  return (
    <footer
      className="relative border-t px-(--spacing-content-x) py-14"
      style={{ borderColor: "var(--hairline)" }}
      aria-label="Site footer"
    >
      {/* Subtle accent fade rising from the top border */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-32"
        style={{ background: "var(--gradient-accent-fade)" }}
      />
      <div className="relative mx-auto max-w-[var(--spacing-content-max)]">
        {/* Top: brand + columns */}
        <div className="flex flex-col gap-12 lg:flex-row lg:justify-between lg:gap-16">
          {/* Brand block */}
          <div className="max-w-xs">
            <Link href="/" className="flex items-center gap-2.5" aria-label="ReachKit home">
              <LogoMark size={24} />
              <span
                className="text-base font-semibold"
                style={{ fontFamily: "var(--font-display)", color: "var(--color-fg)" }}
              >
                {brand}
              </span>
            </Link>
            {tagline && (
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{tagline}</p>
            )}
            {social && social.length > 0 && (
              <div className="mt-5 flex items-center gap-2">
                {social.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="grid size-9 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <SocialIcon icon={s.icon} />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Nav columns */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:gap-12">
            {columns.map((col) => (
              <nav key={col.heading} aria-label={col.heading}>
                <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/80">
                  {col.heading}
                </p>
                <ul className="flex flex-col gap-2.5">
                  {col.items.map((item) => (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        {/* Bottom: legal + copyright */}
        <div
          className="mt-12 flex flex-col items-start gap-4 border-t pt-8 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: "var(--hairline)" }}
        >
          <nav aria-label="Legal links" className="flex flex-wrap gap-4">
            {legal.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex flex-col gap-1 sm:text-right">
            {copyright && (
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                {copyright}
              </p>
            )}
            {attribution && (
              <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/50">
                {attribution}
              </p>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Social icons (inline SVG — no icon-lib weight in the marketing bundle)
// ---------------------------------------------------------------------------

function SocialIcon({ icon }: { icon: FooterSocialIcon }) {
  if (icon === "x") {
    return (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
        <path d="M12.6 1.5h2.3l-5 5.7 5.9 7.8h-4.6l-3.6-4.7-4.1 4.7H1.1l5.4-6.1L0.8 1.5h4.7l3.3 4.3 3.8-4.3Zm-.8 12.4h1.3L4.3 2.8H2.9l8.9 11.1Z" />
      </svg>
    );
  }
  if (icon === "github") {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.5 7.5 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
      </svg>
    );
  }
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M3 3a1 1 0 0 0 0 2 8 8 0 0 1 8 8 1 1 0 1 0 2 0A10 10 0 0 0 3 3Zm0 4a1 1 0 0 0 0 2 4 4 0 0 1 4 4 1 1 0 1 0 2 0 6 6 0 0 0-6-6Zm.5 4.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" />
    </svg>
  );
}
