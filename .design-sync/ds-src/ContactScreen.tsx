import * as React from "react";
import { NavBar } from "./NavBar";
import { Footer } from "./Footer";

/**
 * ContactScreen — the public Contact page (`/contact`): NavBar, a hero, and the
 * ways to reach the team (email, X/Twitter), then the footer. A standard content page.
 */
export interface ContactScreenProps {
  _unused?: never;
}

const SECTION: React.CSSProperties = { maxWidth: 640, margin: "0 auto", padding: "0 24px" };
const WAYS = [
  { label: "Email", value: "hi@reachkit.app", note: "Fastest — we reply within a day." },
  { label: "X / Twitter", value: "@reachkit", note: "DMs open for quick questions." },
  { label: "Feedback", value: "roadmap board", note: "Vote on what we build next." },
];

export function ContactScreen() {
  return (
    <div style={{ background: "var(--c-bg)", fontFamily: "var(--font-sans)", color: "var(--c-ink)" }}>
      <NavBar />
      <div style={{ background: "radial-gradient(900px 360px at 50% -10%, var(--c-soft), transparent 70%)" }}>
        <div style={{ ...SECTION, padding: "56px 24px 24px", textAlign: "center", display: "flex", flexDirection: "column", gap: 12 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(2rem, 4.5vw, 3.2rem)", letterSpacing: "-0.02em", lineHeight: 1.05, margin: 0 }}>Talk to us</h1>
          <p style={{ fontSize: 16, color: "var(--c-muted)", margin: 0 }}>A real founder reads every message.</p>
        </div>
      </div>
      <div style={{ ...SECTION, padding: "24px 24px 64px", display: "flex", flexDirection: "column", gap: 12 }}>
        {WAYS.map((w) => (
          <div key={w.label} style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-lg)", padding: "18px 22px", display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-faint)" }}>{w.label}</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: "var(--c-action)" }}>{w.value}</span>
              <span style={{ fontSize: 12.5, color: "var(--c-muted)" }}>{w.note}</span>
            </div>
          </div>
        ))}
      </div>
      <Footer />
    </div>
  );
}
