import * as React from "react";
import { NavBar } from "./NavBar";
import { Footer } from "./Footer";

/**
 * AboutScreen — the public About page (`/about`): NavBar, a hero, the mission prose,
 * and the "why we built it" note, then the footer. A standard marketing content page.
 */
export interface AboutScreenProps {
  _unused?: never;
}

const SECTION: React.CSSProperties = { maxWidth: 720, margin: "0 auto", padding: "0 24px" };

export function AboutScreen() {
  return (
    <div style={{ background: "var(--c-bg)", fontFamily: "var(--font-sans)", color: "var(--c-ink)" }}>
      <NavBar />
      <div style={{ background: "radial-gradient(900px 360px at 50% -10%, var(--c-soft), transparent 70%)" }}>
        <div style={{ ...SECTION, padding: "56px 24px 24px", textAlign: "center" }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(2rem, 4.5vw, 3.2rem)", letterSpacing: "-0.02em", lineHeight: 1.05, margin: 0 }}>The distribution system for solo founders</h1>
        </div>
      </div>
      <div style={{ ...SECTION, padding: "24px 24px 64px", display: "flex", flexDirection: "column", gap: 20, fontSize: 16.5, lineHeight: 1.7, color: "var(--c-muted)" }}>
        <p style={{ margin: 0 }}>Great products die undiscovered every day. Not because they're bad — because being <em>findable</em> is a full-time job the founder never has time for.</p>
        <p style={{ margin: 0 }}>ReachKit scans your live site the way a customer's search would, scores how discoverable you are across Content, Outreach and SEO, and turns the gaps into a small, ranked weekly plan — with the drafts written for you. No dashboards to babysit. No auto-posting that gets you shadow-banned. Just the next right move.</p>
        <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-lg)", padding: "20px 24px", color: "var(--c-ink)", fontSize: 15.5 }}>
          <strong style={{ fontFamily: "var(--font-display)" }}>Why we built it:</strong> we watched too many indie tools with real customers lose to worse products that were simply easier to find. ReachKit is the unfair advantage we wished we'd had.
        </div>
      </div>
      <Footer />
    </div>
  );
}
