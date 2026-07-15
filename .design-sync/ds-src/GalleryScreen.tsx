/* @mirrors app/(marketing)/gallery/page.tsx */
import * as React from "react";
import { NavBar } from "./NavBar";
import { PageHeader } from "./PageHeader";
import { Footer } from "./Footer";

/**
 * GalleryScreen — the `/gallery` page: NavBar, a centred PageHeader
 * ("Discoverability analyses" · "Every scan is public") with two buttons, the
 * "Public scans" count heading + a search box, and a grid of public scan cards
 * (favicon + host + score, "Discoverability scan: {host}", blurb, CTA). Mirrors
 * the live page (which lists real DB-backed scans; sample data shown here).
 */
export interface GalleryScreenProps {
  _unused?: never;
}

const JM = "var(--font-mono)", SG = "var(--font-display)";
const favicon = (d: string) => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=64`;
const bandColor = (s: number) => (s < 35 ? "var(--c-band-invisible)" : s < 55 ? "var(--c-band-hard)" : s < 70 ? "var(--c-band-fair)" : "var(--c-band-findable)");
const blurb = (host: string) => `A discoverability scan of ${host} — the score, the positioning gap, and the fixes that move it.`;

const SCANS = [
  { host: "linear.app", score: 88 }, { host: "notion.so", score: 82 }, { host: "cal.com", score: 71 },
  { host: "posthog.com", score: 79 }, { host: "resend.com", score: 63 }, { host: "bloom.io", score: 41 },
];

const btn = (primary: boolean): React.CSSProperties => ({
  fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 14, borderRadius: 10, padding: "11px 20px", textDecoration: "none",
  color: primary ? "var(--c-on-dark)" : "var(--c-ink)", background: primary ? "var(--c-action)" : "var(--c-surface)", border: primary ? "1px solid transparent" : "1px solid var(--c-line)",
});

export function GalleryScreen() {
  return (
    <div style={{ background: "var(--c-bg)", fontFamily: "var(--font-sans)", color: "var(--c-ink)" }}>
      <NavBar />
      <PageHeader center padding="70px 28px 36px" eyebrow="Discoverability analyses" title="Every scan is public" subhead="Every site we scan gets a permanent, public discoverability report — the score, the positioning gap, and the fixes that move it. Browse them, or run your own.">
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12, marginTop: 24 }}>
          <a href="/scan" style={btn(true)}>Scan your site free</a>
          <a href="/how-it-works" style={btn(false)}>How it works</a>
        </div>
      </PageHeader>
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "44px 28px 64px" }}>
        <div style={{ fontFamily: JM, fontSize: 12.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-faint)" }}>Public scans</div>
        <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 28, letterSpacing: "-0.02em", margin: "8px 0 20px" }}>{SCANS.length} public scans</h2>
        <input readOnly placeholder="Search scans by domain…" aria-label="Search scans by domain" style={{ width: "100%", maxWidth: 420, border: "1px solid var(--c-line)", borderRadius: "var(--radius-lg)", background: "var(--c-surface)", padding: "10px 14px", fontSize: 14, color: "var(--c-ink)", outline: "none", marginBottom: 22 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 }}>
          {SCANS.map((s) => (
            <a key={s.host} href={`/scan/${s.host}`} style={{ display: "flex", flexDirection: "column", gap: 10, border: "1px solid var(--c-line)", borderRadius: 16, padding: 20, background: "var(--c-surface)", textDecoration: "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={favicon(s.host)} alt="" width={22} height={22} style={{ borderRadius: 5, boxShadow: "0 0 0 1px var(--c-line)" }} />
                <span style={{ flex: 1, fontFamily: JM, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--c-faint)" }}>{s.host}</span>
                <span style={{ fontFamily: JM, fontSize: 15, fontWeight: 700, color: bandColor(s.score) }}>{s.score}<span style={{ fontSize: 11, color: "var(--c-faint)" }}>/100</span></span>
              </div>
              <h3 style={{ fontFamily: SG, fontWeight: 700, fontSize: 16, margin: 0 }}>Discoverability scan: {s.host}</h3>
              <p style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--c-muted)", margin: 0 }}>{blurb(s.host)}</p>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--c-action)" }}>View the scan →</span>
            </a>
          ))}
        </div>
      </section>
      <Footer />
    </div>
  );
}
