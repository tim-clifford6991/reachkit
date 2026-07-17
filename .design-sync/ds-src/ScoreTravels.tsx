/* @mirrors components/sections/captured/landing-html.ts */
import * as React from "react";

/**
 * ScoreTravels — the landing's violet "the score travels" band: the shareable
 * score-card pitch ("Post this week's score. Then post the one that beats it.")
 * on the left and a dark branded score card (47 · Hard to find · bloom.io) on the
 * right. Mirrors the score-card CTA section of the live landing (`landing-html.ts`).
 */
export interface ScoreTravelsProps {
  _unused?: never;
}

const SG = "var(--font-display)", JM = "var(--font-mono)";

export function ScoreTravels() {
  return (
    <section style={{ maxWidth: 1180, margin: "0 auto", padding: "0 28px 70px" }}>
      <div style={{ borderRadius: 22, background: "var(--c-action)", padding: "clamp(24px, 6vw, 48px)", color: "var(--c-on-dark)", boxShadow: "0 24px 60px -22px rgba(110,86,247,0.6)", display: "grid", gridTemplateColumns: "1fr auto", gap: "clamp(24px, 4vw, 40px)", alignItems: "center" }}>
        <div>
          <div style={{ fontFamily: JM, fontSize: 13, color: "var(--c-soft)", marginBottom: 14 }}>THE SCORE TRAVELS</div>
          <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 34, letterSpacing: "-0.02em", margin: 0, maxWidth: 440 }}>Post this week&apos;s score. Then post the one that beats it.</h2>
          <p style={{ fontSize: 16, color: "var(--c-soft)", margin: "14px 0 24px", maxWidth: 440 }}>Every scan generates a branded score card built for the timeline. Your score history is the record of your marketing actually working — share the climb.</p>
          <button style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 15, color: "var(--c-action)", background: "var(--c-surface)", border: "none", borderRadius: 11, padding: "13px 24px", cursor: "pointer" }}>Get my score card →</button>
        </div>
        <div style={{ background: "var(--c-dark)", borderRadius: 16, padding: 26, width: "100%", maxWidth: 280, boxShadow: "0 20px 40px -16px rgba(0,0,0,0.5)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <svg width="20" height="20" viewBox="0 0 28 28"><rect width="28" height="28" rx="9" fill="var(--c-action)" /><circle cx="14" cy="14" r="1.7" fill="#fff" /><path d="M14 19 A5 5 0 1 1 19 14" stroke="#fff" strokeWidth="1.7" fill="none" strokeLinecap="round" /><path d="M14 23 A9 9 0 1 1 23 14" stroke="#C3B2FF" strokeWidth="1.7" fill="none" strokeLinecap="round" /></svg>
            <span style={{ fontFamily: SG, fontWeight: 700, fontSize: 13, color: "var(--c-on-dark)" }}>ReachKit</span>
          </div>
          <div style={{ fontFamily: JM, fontWeight: 700, fontSize: 60, color: "var(--c-on-dark)", lineHeight: 1 }}>47</div>
          <div style={{ display: "inline-flex", background: "color-mix(in oklab, var(--c-band-hard) 22%, var(--c-dark))", color: "var(--c-band-hard)", fontWeight: 700, fontSize: 12, padding: "4px 10px", borderRadius: 7, marginTop: 8, fontFamily: SG }}>Hard to find</div>
          <div style={{ fontSize: 12.5, color: "var(--c-on-dark-muted)", marginTop: 14 }}>bloom.io · top fix: ship comparison pages</div>
        </div>
      </div>
    </section>
  );
}
