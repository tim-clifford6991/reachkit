/**
 * Footer — §21.1 marketing section.
 *
 * Brand block (mark + tagline + social) on the left, up to four nav columns on
 * the right, then a legal + copyright row. Content-as-props. Server component.
 *
 * Design idiom: intel-kit — inline styles + `--c-*` tokens, Space Grotesk /
 * Plus Jakarta Sans / JetBrains Mono (no Tailwind, no `--color-*` tokens).
 */

import type * as React from "react";
import Link from "next/link";

import { LogoMark } from "@/components/brand/logo";

const SG = "var(--font-display)", PJ = "var(--font-sans)", JM = "var(--font-mono)";

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
// Shared styles
// ---------------------------------------------------------------------------

const NAV_LINK: React.CSSProperties = {
  fontFamily: PJ,
  fontSize: 13.5,
  color: "var(--c-muted)",
  textDecoration: "none",
};

const MONO_LABEL: React.CSSProperties = {
  fontFamily: JM,
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--c-faint)",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Footer({ content }: FooterProps) {
  const { brand, tagline, columns, legal, social, copyright, attribution } = content;

  return (
    <footer
      style={{ position: "relative", borderTop: "1px solid var(--c-line)", padding: "56px var(--spacing-content-x, 24px)", background: "var(--c-surface)", fontFamily: PJ }}
      aria-label="Site footer"
    >
      {/* Subtle violet fade rising from the top border */}
      <div
        aria-hidden="true"
        style={{ pointerEvents: "none", position: "absolute", insetInline: 0, top: 0, height: 128, background: "linear-gradient(180deg, color-mix(in oklab, var(--c-action) 4%, transparent), transparent)" }}
      />
      <div style={{ position: "relative", margin: "0 auto", maxWidth: "var(--spacing-content-max, 1200px)" }}>
        {/* Top: brand + columns */}
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 48 }}>
          {/* Brand block */}
          <div style={{ maxWidth: 320 }}>
            <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none" }} aria-label="ReachKit home">
              <LogoMark size={24} />
              <span style={{ fontFamily: SG, fontSize: 16, fontWeight: 700, color: "var(--c-ink)" }}>
                {brand}
              </span>
            </Link>
            {tagline && (
              <p style={{ margin: "12px 0 0", fontSize: 13.5, lineHeight: 1.6, color: "var(--c-muted)" }}>{tagline}</p>
            )}
            {social && social.length > 0 && (
              <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 8 }}>
                {social.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    style={{ display: "grid", width: 36, height: 36, placeItems: "center", borderRadius: "50%", border: "1px solid var(--c-line)", color: "var(--c-muted)" }}
                  >
                    <SocialIcon icon={s.icon} />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Nav columns */}
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(columns.length, 4)}, minmax(120px, 1fr))`, gap: "32px 48px", flex: "1 1 480px", maxWidth: 720 }}>
            {columns.map((col) => (
              <nav key={col.heading} aria-label={col.heading}>
                <p style={{ ...MONO_LABEL, margin: "0 0 12px" }}>{col.heading}</p>
                <ul style={{ display: "flex", flexDirection: "column", gap: 10, margin: 0, padding: 0, listStyle: "none" }}>
                  {col.items.map((item) => (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        style={NAV_LINK}
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
        <div style={{ marginTop: 48, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16, borderTop: "1px solid var(--c-line)", paddingTop: 32 }}>
          <nav aria-label="Legal links" style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            {legal.map((item) => (
              <Link key={item.label} href={item.href} style={{ ...MONO_LABEL, letterSpacing: "0.08em", color: "var(--c-muted)", textDecoration: "none" }}>
                {item.label}
              </Link>
            ))}
          </nav>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {copyright && (
              <p style={{ ...MONO_LABEL, letterSpacing: "0.08em", margin: 0 }}>{copyright}</p>
            )}
            {attribution && (
              <p style={{ ...MONO_LABEL, fontSize: 9, letterSpacing: "0.08em", color: "color-mix(in oklab, var(--c-faint) 65%, transparent)", margin: 0 }}>
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
