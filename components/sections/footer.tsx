/**
 * Footer — §21.1 marketing section
 *
 * Nav columns + legal links (/privacy /terms /imprint) + brand + attribution.
 * Content-as-props: column structure, legal links, brand name.
 *
 * Pure server component. Dark-first, on design tokens.
 */

import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FooterNavItem {
  label: string;
  href: string;
}

export interface FooterNavColumn {
  heading: string;
  items: readonly FooterNavItem[];
}

export interface FooterContent {
  brand: string;
  tagline?: string;
  columns: readonly FooterNavColumn[];
  legal: readonly FooterNavItem[];
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
  const { brand, tagline, columns, legal, copyright, attribution } = content;

  return (
    <footer
      className="border-t px-[--spacing-content-x] py-12"
      style={{ borderColor: "oklch(1 0 0 / 0.08)" }}
      aria-label="Site footer"
    >
      <div className="mx-auto max-w-[var(--spacing-content-max)]">
        {/* Top row: brand + columns */}
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-12">
          {/* Brand column */}
          <div className="col-span-2 sm:col-span-1">
            <p
              className="mb-2 font-mono text-sm font-semibold tracking-tight"
              style={{ color: "var(--color-fg)" }}
            >
              {brand}
            </p>
            {tagline && (
              <p
                className="text-xs leading-relaxed"
                style={{ color: "var(--color-muted)" }}
              >
                {tagline}
              </p>
            )}
          </div>

          {/* Nav columns */}
          {columns.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <p
                className="mb-3 font-mono text-[10px] uppercase tracking-widest"
                style={{ color: "var(--color-muted)" }}
              >
                {col.heading}
              </p>
              <ul className="flex flex-col gap-2">
                {col.items.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="text-xs transition-colors duration-150"
                      style={{ color: "var(--color-muted)" }}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Bottom row: legal + copyright */}
        <div
          className="mt-10 flex flex-col items-start gap-4 border-t pt-8 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: "oklch(1 0 0 / 0.07)" }}
        >
          {/* Legal links */}
          <nav aria-label="Legal links" className="flex flex-wrap gap-4">
            {legal.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="font-mono text-[10px] uppercase tracking-wider transition-colors duration-150"
                style={{ color: "var(--color-muted)" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Copyright + attribution */}
          <div className="flex flex-col gap-1 text-right">
            {copyright && (
              <p
                className="font-mono text-[10px] uppercase tracking-wider"
                style={{ color: "var(--color-muted)", opacity: 0.6 }}
              >
                {copyright}
              </p>
            )}
            {attribution && (
              <p
                className="font-mono text-[9px] uppercase tracking-wider"
                style={{ color: "var(--color-muted)", opacity: 0.4 }}
              >
                {attribution}
              </p>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
