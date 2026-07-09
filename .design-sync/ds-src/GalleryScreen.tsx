import * as React from "react";
import { NavBar } from "./NavBar";
import { ScoreGauge } from "./ScoreGauge";
import { Footer } from "./Footer";

/**
 * GalleryScreen — the public scan gallery (`/gallery`): NavBar, a hero, and a grid
 * of recently-scanned sites each showing its discoverability gauge + band, linking
 * to the public report. Social proof + an SEO surface. Composes ScoreGauge.
 */
export interface GalleryScreenProps {
  _unused?: never;
}

const SECTION: React.CSSProperties = { maxWidth: 1080, margin: "0 auto", padding: "0 24px" };
const SITES = [
  { name: "linear.app", score: 88, band: "Highly discoverable" },
  { name: "notion.so", score: 82, band: "Findable" },
  { name: "cal.com", score: 71, band: "Findable" },
  { name: "resend.com", score: 63, band: "Fair — room to climb" },
  { name: "posthog.com", score: 79, band: "Findable" },
  { name: "bloom.io", score: 41, band: "Hard to find" },
];

export function GalleryScreen() {
  return (
    <div style={{ background: "var(--c-bg)", fontFamily: "var(--font-sans)", color: "var(--c-ink)" }}>
      <NavBar />
      <div style={{ background: "radial-gradient(900px 380px at 50% -10%, var(--c-soft), transparent 70%)" }}>
        <div style={{ ...SECTION, padding: "56px 24px 32px", textAlign: "center", display: "flex", flexDirection: "column", gap: 12 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(2.1rem, 4.5vw, 3.2rem)", letterSpacing: "-0.02em", lineHeight: 1.05, margin: 0 }}>See how findable the tools you know are</h1>
          <p style={{ fontSize: 16, color: "var(--c-muted)", maxWidth: 620, margin: "0 auto", lineHeight: 1.6 }}>Real discoverability scores from public scans. Yours takes under a minute.</p>
        </div>
      </div>
      <div style={{ ...SECTION, padding: "16px 24px 64px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
          {SITES.map((s) => (
            <div key={s.name} style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-lg)", padding: "20px 22px", display: "flex", alignItems: "center", gap: 16, boxShadow: "var(--elevation-md)" }}>
              <ScoreGauge score={s.score} size={78} showBand={false} />
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: "var(--c-ink)" }}>{s.name}</span>
                <span style={{ fontSize: 12, color: "var(--c-muted)" }}>{s.band}</span>
                <span style={{ fontSize: 12, color: "var(--c-action)", fontWeight: 600 }}>View report →</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
}
