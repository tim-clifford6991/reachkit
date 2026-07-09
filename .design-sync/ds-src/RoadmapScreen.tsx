import * as React from "react";
import { NavBar } from "./NavBar";
import { Footer } from "./Footer";

/**
 * RoadmapScreen — the public roadmap (`/roadmap`): NavBar, a hero, then Shipped /
 * In progress / Next columns of items, and the footer. Mirrors the ComingSoon-style
 * roadmap surface.
 */
export interface RoadmapScreenProps {
  _unused?: never;
}

const SECTION: React.CSSProperties = { maxWidth: 1000, margin: "0 auto", padding: "0 24px" };
const COLS = [
  { title: "Shipped", tone: "var(--c-band-findable)", items: ["On-site readiness + Market Position score", "Competitor channel teardowns", "Ranked weekly plan with drafts", "Weekly re-scan + progress trend"] },
  { title: "In progress", tone: "var(--c-action)", items: ["Per-user cost tracking", "Customer-demand pockets v2", "Reddit / X draft polish"] },
  { title: "Next", tone: "var(--c-faint)", items: ["Team seats", "Slack digest of your plan", "App Store (iOS/Android) parity"] },
];

export function RoadmapScreen() {
  return (
    <div style={{ background: "var(--c-bg)", fontFamily: "var(--font-sans)", color: "var(--c-ink)" }}>
      <NavBar />
      <div style={{ background: "radial-gradient(900px 360px at 50% -10%, var(--c-soft), transparent 70%)" }}>
        <div style={{ ...SECTION, padding: "56px 24px 32px", textAlign: "center", display: "flex", flexDirection: "column", gap: 12 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(2rem, 4.5vw, 3.2rem)", letterSpacing: "-0.02em", lineHeight: 1.05, margin: 0 }}>Roadmap</h1>
          <p style={{ fontSize: 16, color: "var(--c-muted)", margin: 0 }}>What we've shipped and what's next. Founders vote on priorities.</p>
        </div>
      </div>
      <div style={{ ...SECTION, padding: "16px 24px 64px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          {COLS.map((c) => (
            <div key={c.title} style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-lg)", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: c.tone }} />
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--c-ink)" }}>{c.title}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {c.items.map((it) => (
                  <div key={it} style={{ fontSize: 13.5, color: "var(--c-muted)", lineHeight: 1.4, paddingLeft: 14, position: "relative" }}>
                    <span style={{ position: "absolute", left: 0, color: c.tone }}>·</span>{it}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
}
