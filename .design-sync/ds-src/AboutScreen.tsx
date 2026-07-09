/* @mirrors app/(marketing)/about/page.tsx */
import * as React from "react";
import { NavBar } from "./NavBar";
import { PageHeader } from "./PageHeader";
import { Footer } from "./Footer";

/**
 * AboutScreen — the `/about` page: NavBar, a left-aligned PageHeader ("About" ·
 * "Built for founders who ship, not agencies who bill"), the mission prose (three
 * paragraphs) with the two CTAs, then the footer. Mirrors the live inline page.
 */
export interface AboutScreenProps {
  _unused?: never;
}

const btn = (primary: boolean): React.CSSProperties => ({
  fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 14, borderRadius: 10, padding: "11px 20px", textDecoration: "none",
  color: primary ? "var(--c-on-dark)" : "var(--c-ink)", background: primary ? "var(--c-action)" : "var(--c-surface)", border: primary ? "1px solid transparent" : "1px solid var(--c-line)",
});

export function AboutScreen() {
  return (
    <div style={{ background: "var(--c-surface)", fontFamily: "var(--font-sans)", color: "var(--c-ink)" }}>
      <NavBar />
      <PageHeader eyebrow="About" title="Built for founders who ship, not agencies who bill" />
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 28px 28px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 720 }}>
          <p style={{ fontSize: 17.5, lineHeight: 1.5, color: "var(--c-muted)", margin: 0 }}>Most products don&apos;t fail because they&apos;re bad. They fail because nobody can find them. The people who&apos;d love your app are searching — they just land on someone else&apos;s listing instead of yours.</p>
          <p style={{ fontSize: 17.5, lineHeight: 1.5, color: "var(--c-muted)", margin: 0 }}>ReachKit exists to close that gap. Paste a URL and you get a Discoverability Score, an honest read on who your page actually speaks to, the searches you&apos;re invisible for, and a ranked list of fixes — grounded in your live page, not generic advice. Then a weekly engine keeps you moving and verifies each change actually shipped.</p>
          <p style={{ fontSize: 17.5, lineHeight: 1.5, color: "var(--c-muted)", margin: 0 }}>It&apos;s made by <span style={{ color: "var(--c-ink)", fontWeight: 600 }}>Tim Clifford</span>, a solo founder who got tired of distribution being a black box you either ignore or pay an agency a fortune to manage. The goal is simple: make getting found a thing you can do yourself, a little every week.</p>
        </div>
        <div style={{ marginTop: 32, display: "flex", flexWrap: "wrap", gap: 12 }}>
          <a href="/scan" style={btn(true)}>Scan your product</a>
          <a href="/gallery" style={btn(false)}>Browse the scans</a>
        </div>
      </div>
      <Footer />
    </div>
  );
}
