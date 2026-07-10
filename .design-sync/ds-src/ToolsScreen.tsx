/* @mirrors app/(marketing)/tools/page.tsx */
import * as React from "react";
import { NavBar } from "./NavBar";
import { PageHeader } from "./PageHeader";
import { Footer } from "./Footer";

/**
 * ToolsScreen — the `/tools` free-tools hub: NavBar, a centred PageHeader ("Free
 * tools" · "Free tools to help you get found"), a grid of the four free checker
 * cards (each with a "Free" pill and its own CTA), then the footer. Mirrors the
 * live inline page.
 */
export interface ToolsScreenProps {
  _unused?: never;
}

const TOOLS = [
  { title: "Discoverability Score", blurb: "Paste any App Store URL or website and get a 0–100 score across 18 signals — search, AI answers, content, competitors — plus your biggest gaps. Free, no account.", cta: "Run a free scan →", href: "/scan" },
  { title: "On-page SEO checker", blurb: "Check the 8 on-page signals search engines read first: title tag, meta description, structured data, canonical, headings, social tags, content depth and alt text.", cta: "Check a page →", href: "/tools/on-page-check" },
  { title: "AI visibility check", blurb: "Can ChatGPT, Claude and Perplexity actually see your product? Test llms.txt, robots.txt rules for AI crawlers, structured data, and whether your proposition is machine-readable.", cta: "Test AI visibility →", href: "/tools/ai-visibility-check" },
  { title: "Meta & social preview", blurb: "See exactly how your page renders as a Google result, an X card and a LinkedIn share — from your real title, description and og:image tags — plus what's missing.", cta: "Preview a URL →", href: "/tools/meta-preview" },
];

export function ToolsScreen() {
  return (
    <div style={{ background: "var(--c-bg)", fontFamily: "var(--font-sans)", color: "var(--c-ink)" }}>
      <NavBar />
      <PageHeader center padding="70px 28px 24px" eyebrow="Free tools" title="Free tools to help you get found" subhead="Single-purpose checkers that run on your live site — no signup, no email. Each one covers a slice of the full 18-signal Discoverability Score." />
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "8px 28px 64px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 }}>
          {TOOLS.map((t) => (
            <a key={t.title} href={t.href} style={{ display: "flex", flexDirection: "column", gap: 12, border: "1px solid var(--c-tint-violet-line)", borderRadius: 16, padding: 24, background: "var(--c-surface)", textDecoration: "none" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: "var(--c-ink)" }}>{t.title}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.04em", color: "var(--c-action)", background: "var(--c-soft)", borderRadius: 999, padding: "3px 9px" }}>Free</span>
              </div>
              <p style={{ flex: 1, fontSize: 14, lineHeight: 1.55, color: "var(--c-muted)", margin: 0 }}>{t.blurb}</p>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--c-action)" }}>{t.cta}</span>
            </a>
          ))}
        </div>
      </section>
      <Footer />
    </div>
  );
}
