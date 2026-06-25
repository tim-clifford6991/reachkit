import * as React from "react";

/**
 * Footer — ReachKit's site footer: brand mark + tagline (left), columns of link
 * groups (right), a legal/copyright row beneath a hairline. Renders fully with
 * no props.
 */
export interface FooterProps {
  tagline?: string;
  columns?: { heading: string; items: { label: string; href: string }[] }[];
  copyright?: string;
}

const DEFAULT_TAGLINE =
  "The discoverability engine for solo founders — a scored report and a weekly, verified action plan in ~90 seconds.";

const DEFAULT_COLUMNS: NonNullable<FooterProps["columns"]> = [
  { heading: "Product", items: [{ label: "Scan your app", href: "/scan" }, { label: "How it works", href: "/how-it-works" }, { label: "Pricing", href: "/pricing" }, { label: "Free tools", href: "/tools" }] },
  { heading: "Resources", items: [{ label: "Teardowns", href: "/teardowns" }, { label: "Compare", href: "/compare" }, { label: "Blog", href: "/blog" }, { label: "Help & docs", href: "/docs" }] },
  { heading: "Company", items: [{ label: "About", href: "/about" }, { label: "Contact", href: "/contact" }, { label: "Affiliates", href: "/affiliates" }, { label: "Log in", href: "/login" }] },
];

const LEGAL = [{ label: "Privacy", href: "/privacy" }, { label: "Terms", href: "/terms" }, { label: "Security", href: "/security" }];

export function Footer({ tagline = DEFAULT_TAGLINE, columns = DEFAULT_COLUMNS, copyright = "© 2026 ReachKit" }: FooterProps) {
  const eyebrow: React.CSSProperties = { margin: "0 0 14px", fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--c-faint)" };
  return (
    <footer aria-label="Site footer" style={{ position: "relative", background: "var(--c-bg2)", borderTop: "1px solid var(--c-line)", fontFamily: "var(--font-sans)", padding: "56px 24px 40px" }}>
      <div style={{ position: "relative", maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 48 }}>
          <div style={{ maxWidth: 320, minWidth: 240, flex: "1 1 260px" }}>
            <a href="/" aria-label="ReachKit home" style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
              <svg width={26} height={26} viewBox="0 0 28 28" fill="none">
                <rect width="28" height="28" rx="9" fill="#6E56F7" />
                <circle cx="14" cy="14" r="1.7" fill="#fff" />
                <path d="M14 19 A5 5 0 1 1 19 14" stroke="#fff" strokeWidth="1.7" fill="none" strokeLinecap="round" />
                <path d="M14 23 A9 9 0 1 1 23 14" stroke="#C3B2FF" strokeWidth="1.7" fill="none" strokeLinecap="round" />
              </svg>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, color: "var(--c-ink)", letterSpacing: "-0.01em" }}>ReachKit</span>
            </a>
            <p style={{ marginTop: 14, fontSize: 13.5, lineHeight: 1.6, color: "var(--c-muted)" }}>{tagline}</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 32, flex: "2 1 420px" }}>
            {columns.map((col) => (
              <nav key={col.heading} aria-label={col.heading}>
                <p style={eyebrow}>{col.heading}</p>
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                  {col.items.map((item) => (
                    <li key={item.label}><a href={item.href} style={{ fontSize: 13.5, color: "var(--c-muted)", textDecoration: "none" }}>{item.label}</a></li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16, marginTop: 48, paddingTop: 28, borderTop: "1px solid var(--c-line)" }}>
          <nav aria-label="Legal links" style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
            {LEGAL.map((item) => (<a key={item.label} href={item.href} style={{ ...eyebrow, margin: 0 }}>{item.label}</a>))}
          </nav>
          <p style={{ ...eyebrow, margin: 0 }}>{copyright}</p>
        </div>
      </div>
    </footer>
  );
}
