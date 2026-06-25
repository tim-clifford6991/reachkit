import * as React from "react";

/**
 * NavBar — ReachKit's marketing top navigation: a sticky glass header with the
 * brand mark (left), flat nav links, and a violet "Analyze my site" CTA. Logged-in
 * mode swaps "Log in" for "Dashboard". Renders fully with no props.
 */
export interface NavBarProps {
  links?: { label: string; href: string }[];
  ctaLabel?: string;
  isLoggedIn?: boolean;
}

const DEFAULT_LINKS: { label: string; href: string }[] = [
  { label: "Product", href: "/how-it-works" },
  { label: "Pricing", href: "/pricing" },
  { label: "Free tools", href: "/tools" },
  { label: "Compare", href: "/compare" },
  { label: "Teardowns", href: "/teardowns" },
];

export function NavBar({ links = DEFAULT_LINKS, ctaLabel = "Analyze my site", isLoggedIn = false }: NavBarProps) {
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 50, background: "var(--c-glass)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderBottom: "1px solid var(--c-line)" }}>
      <nav aria-label="Primary" style={{ maxWidth: 1180, margin: "0 auto", padding: "14px 28px", display: "flex", alignItems: "center", gap: 30 }}>
        <a href="/" aria-label="ReachKit home" style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, textDecoration: "none", color: "var(--c-ink)" }}>
          <svg width={26} height={26} viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="9" fill="#6E56F7" />
            <circle cx="14" cy="14" r="1.7" fill="#fff" />
            <path d="M14 19 A5 5 0 1 1 19 14" stroke="#fff" strokeWidth="1.7" fill="none" strokeLinecap="round" />
            <path d="M14 23 A9 9 0 1 1 23 14" stroke="#C3B2FF" strokeWidth="1.7" fill="none" strokeLinecap="round" />
          </svg>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, letterSpacing: "-0.01em" }}>ReachKit</span>
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {links.map((l) => (
            <a key={l.href} href={l.href} style={{ fontFamily: "var(--font-sans)", fontSize: 14.5, fontWeight: 500, color: "var(--c-muted)", textDecoration: "none" }}>{l.label}</a>
          ))}
        </div>
        <div style={{ flex: "1 1 0%" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <a href={isLoggedIn ? "/app" : "/login"} style={{ fontFamily: "var(--font-sans)", fontSize: 14.5, fontWeight: 600, color: "var(--c-ink)", textDecoration: "none" }}>{isLoggedIn ? "Dashboard" : "Log in"}</a>
          <a href="/scan" style={{ display: "inline-flex", alignItems: "center", fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 14, color: "var(--c-on-dark)", background: "var(--c-action)", borderRadius: "var(--radius-full)", padding: "9px 18px", textDecoration: "none", boxShadow: "0 1px 2px rgba(110, 86, 247, 0.25)" }}>{isLoggedIn ? "New scan" : ctaLabel}</a>
        </div>
      </nav>
    </header>
  );
}
