/* @mirrors app/(marketing)/teardowns/[slug]/page.tsx */
import * as React from "react";
import { NavBar } from "./NavBar";
import { TeardownCard } from "./TeardownCard";
import { Footer } from "./Footer";

/**
 * TeardownsScreen — the public teardowns hub (`/teardowns`): NavBar, a hero, and a
 * grid of TeardownCard index cards (each a discoverability teardown of a known app,
 * with its score + the sharpest gap). SEO + credibility surface. Composes TeardownCard.
 */
export interface TeardownsScreenProps {
  _unused?: never;
}

const SECTION: React.CSSProperties = { maxWidth: 1080, margin: "0 auto", padding: "0 24px" };
const TEARDOWNS = [
  { appName: "Plausible Analytics", platform: "web" as const, score: 52, blurb: "Competes for the crowded 'Google Analytics alternative' query; its least-contested audience — teams deleting a cookie banner — is barely spoken to." },
  { appName: "Bear", platform: "ios" as const, score: 44, blurb: "Beautiful notes app buried under 'markdown editor' — the buyers searching 'distraction-free writing app' never see it." },
  { appName: "Fathom", platform: "web" as const, score: 68, blurb: "Strong referral footprint from Zoom's marketplace, but thin on comparison content vs Otter — a fast keyword win." },
  { appName: "Cron", platform: "ios" as const, score: 57, blurb: "Post-acquisition rename to Notion Calendar left a trail of stale SERPs pointing at the old brand." },
];

export function TeardownsScreen() {
  return (
    <div style={{ background: "var(--c-bg)", fontFamily: "var(--font-sans)", color: "var(--c-ink)" }}>
      <NavBar />
      <div style={{ background: "radial-gradient(900px 380px at 50% -10%, var(--c-soft), transparent 70%)" }}>
        <div style={{ ...SECTION, padding: "56px 24px 32px", textAlign: "center", display: "flex", flexDirection: "column", gap: 12 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(2.1rem, 4.5vw, 3.2rem)", letterSpacing: "-0.02em", lineHeight: 1.05, margin: 0 }}>Discoverability teardowns</h1>
          <p style={{ fontSize: 16, color: "var(--c-muted)", maxWidth: 620, margin: "0 auto", lineHeight: 1.6 }}>How real products get found — the score, the sharpest gap, and the fix. Then run yours.</p>
        </div>
      </div>
      <div style={{ ...SECTION, padding: "16px 24px 64px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {TEARDOWNS.map((t) => (
            <TeardownCard key={t.appName} appName={t.appName} platform={t.platform} score={t.score} blurb={t.blurb} />
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
}
