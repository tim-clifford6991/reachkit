/* @mirrors components/sections/footer.tsx */
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
  attribution?: string;
}

const DEFAULT_TAGLINE =
  "The discoverability engine for solo founders — a scored report and a weekly, verified action plan in under a minute.";

const DEFAULT_COLUMNS: NonNullable<FooterProps["columns"]> = [
  { heading: "Product", items: [{ label: "Scan your app", href: "/scan" }, { label: "How it works", href: "/how-it-works" }, { label: "Pricing", href: "/pricing" }, { label: "Free tools", href: "/tools" }, { label: "Roadmap", href: "/roadmap" }] },
  { heading: "Resources", items: [{ label: "Gallery", href: "/gallery" }] },
  { heading: "Compare", items: [{ label: "vs Ahrefs", href: "/compare/ahrefs" }, { label: "vs Semrush", href: "/compare/semrush" }, { label: "vs SparkToro", href: "/compare/sparktoro" }, { label: "vs ChatGPT", href: "/compare/chatgpt" }, { label: "All comparisons", href: "/compare" }] },
  { heading: "Company", items: [{ label: "About", href: "/about" }, { label: "Contact", href: "/contact" }, { label: "Affiliates", href: "/affiliates" }, { label: "Log in", href: "/login" }] },
];

const LEGAL = [{ label: "Privacy", href: "/privacy" }, { label: "Terms", href: "/terms" }, { label: "Imprint", href: "/imprint" }];

const SOCIAL: { label: string; d: string }[] = [
  { label: "ReachKit on X", d: "M12.6 1.5h2.3l-5 5.7 5.9 7.8h-4.6l-3.6-4.7-4.1 4.7H1.1l5.4-6.1L0.8 1.5h4.7l3.3 4.3 3.8-4.3Zm-.8 12.4h1.3L4.3 2.8H2.9l8.9 11.1Z" },
  { label: "ReachKit on GitHub", d: "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.5 7.5 0 0 1 4 0c1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" },
  { label: "Teardowns RSS feed", d: "M3 3a1 1 0 0 0 0 2 8 8 0 0 1 8 8 1 1 0 1 0 2 0A10 10 0 0 0 3 3Zm0 4a1 1 0 0 0 0 2 4 4 0 0 1 4 4 1 1 0 1 0 2 0 6 6 0 0 0-6-6Zm.5 4.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" },
];

export function Footer({ tagline = DEFAULT_TAGLINE, columns = DEFAULT_COLUMNS, copyright = "© 2026 ReachKit", attribution = "Built for founders who ship" }: FooterProps) {
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
            <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 8 }}>
              {SOCIAL.map((s) => (
                <a key={s.label} href="#" aria-label={s.label} style={{ display: "grid", width: 36, height: 36, placeItems: "center", borderRadius: "50%", border: "1px solid var(--c-line)", color: "var(--c-muted)" }}>
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d={s.d} /></svg>
                </a>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "32px 40px", flex: "1 1 320px", minWidth: 0, maxWidth: 720 }}>
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
          <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
            <p style={{ ...eyebrow, margin: 0 }}>{copyright}</p>
            {attribution && <p style={{ ...eyebrow, margin: 0, fontSize: 9, color: "color-mix(in oklab, var(--c-faint) 65%, transparent)" }}>{attribution}</p>}
          </div>
        </div>
      </div>
    </footer>
  );
}
