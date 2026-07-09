import * as React from "react";
import { NavBar } from "./NavBar";
import { Footer } from "./Footer";

/**
 * LegalScreen — the shared template for the legal content pages (`/privacy`,
 * `/terms`): NavBar, a document title + last-updated line, prose sections with
 * headings, and the footer. One template covers both legal routes.
 */
export interface LegalScreenProps {
  /** "Privacy Policy" | "Terms of Service". */
  title?: string;
  updated?: string;
}

const SECTION: React.CSSProperties = { maxWidth: 720, margin: "0 auto", padding: "0 24px" };
const SECTIONS = [
  { h: "1. What we collect", p: "The URL you submit, the public page content and public SEO signals we scan, and your account email. We never ask for access to your analytics, ad accounts, or private data." },
  { h: "2. How we use it", p: "To produce your discoverability score, competitor and demand analysis, and weekly plan, and to send the account emails you opt into. We do not sell your data." },
  { h: "3. Third parties", p: "We use DataForSEO and Tavily for public web signals, Anthropic for analysis, Stripe for billing, and Supabase for storage. Each processes only what's needed for its function." },
  { h: "4. Your rights", p: "Export or delete your data any time from Settings, or by emailing hi@reachkit.app. Deletion removes your scans, plan, and account within 30 days." },
];

export function LegalScreen({ title = "Privacy Policy", updated = "9 July 2026" }: LegalScreenProps) {
  return (
    <div style={{ background: "var(--c-bg)", fontFamily: "var(--font-sans)", color: "var(--c-ink)" }}>
      <NavBar />
      <div style={{ ...SECTION, padding: "48px 24px 64px", display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, borderBottom: "1px solid var(--c-line)", paddingBottom: 18 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(1.9rem, 4vw, 2.6rem)", letterSpacing: "-0.02em", margin: 0 }}>{title}</h1>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--c-faint)" }}>Last updated {updated}</span>
        </div>
        {SECTIONS.map((s) => (
          <div key={s.h} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, color: "var(--c-ink)", margin: 0 }}>{s.h}</h2>
            <p style={{ fontSize: 15.5, lineHeight: 1.7, color: "var(--c-muted)", margin: 0 }}>{s.p}</p>
          </div>
        ))}
      </div>
      <Footer />
    </div>
  );
}
