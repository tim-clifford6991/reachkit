import * as React from "react";
import { NavBar } from "./NavBar";
import { Footer } from "./Footer";

/**
 * ToolsScreen — the public free-tools hub (`/tools`): NavBar, a hero, and a grid of
 * free single-purpose tools (each a top-of-funnel SEO surface), then the footer.
 */
export interface ToolsScreenProps {
  _unused?: never;
}

const SECTION: React.CSSProperties = { maxWidth: 1080, margin: "0 auto", padding: "0 24px" };
const TOOLS = [
  { name: "Discoverability score", desc: "Paste a URL, get your findability score in under a minute." },
  { name: "Meta tag checker", desc: "Title, description, Open Graph & Twitter cards — graded." },
  { name: "Keyword gap finder", desc: "See the terms your competitors rank for and you don't." },
  { name: "Schema validator", desc: "Check your JSON-LD structured data is present and valid." },
  { name: "SERP preview", desc: "See exactly how your page looks in Google results." },
  { name: "Alt-text auditor", desc: "Find images missing alt text hurting your accessibility + SEO." },
];

export function ToolsScreen() {
  return (
    <div style={{ background: "var(--c-bg)", fontFamily: "var(--font-sans)", color: "var(--c-ink)" }}>
      <NavBar />
      <div style={{ background: "radial-gradient(900px 360px at 50% -10%, var(--c-soft), transparent 70%)" }}>
        <div style={{ ...SECTION, padding: "56px 24px 32px", textAlign: "center", display: "flex", flexDirection: "column", gap: 12 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(2rem, 4.5vw, 3.2rem)", letterSpacing: "-0.02em", lineHeight: 1.05, margin: 0 }}>Free tools</h1>
          <p style={{ fontSize: 16, color: "var(--c-muted)", maxWidth: 600, margin: "0 auto", lineHeight: 1.6 }}>Quick, no-login checks. Each one rolls up into your full discoverability score.</p>
        </div>
      </div>
      <div style={{ ...SECTION, padding: "16px 24px 64px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {TOOLS.map((t) => (
            <div key={t.name} style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-lg)", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: "var(--c-ink)" }}>{t.name}</span>
              <span style={{ fontSize: 13.5, color: "var(--c-muted)", lineHeight: 1.5 }}>{t.desc}</span>
              <span style={{ fontSize: 12.5, color: "var(--c-action)", fontWeight: 600, marginTop: 4 }}>Try it free →</span>
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
}
