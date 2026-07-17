/* @mirrors components/sections/captured/landing-html.ts */
import * as React from "react";

/**
 * ActionEngine — the landing's dark "verified action engine" band: a two-column
 * layout with the pitch (headline "It doesn't just tell you. It checks your
 * work." + three proof points) on the left and a "This week's queue" mock (done /
 * verifying / predicted items) on the right. Mirrors the dark section of the live
 * landing (`landing-html.ts`).
 */
export interface ActionEngineProps {
  _unused?: never;
}

const SG = "var(--font-display)", JM = "var(--font-mono)";
const PANEL = "color-mix(in oklab, var(--c-dark), black 22%)";
const ITEM = "color-mix(in oklab, var(--c-dark), black 8%)";
const BORDER = "color-mix(in oklab, white 9%, transparent)";
const ACCENT = "color-mix(in oklab, var(--c-action), white 32%)";
const GREEN = "color-mix(in oklab, var(--c-band-findable), white 24%)";
const AMBER = "color-mix(in oklab, var(--c-band-fair), white 22%)";

const POINTS = [
  "Every insight cites a real extracted field",
  "Same URL → same score. Deterministic, not vibes.",
  "Built for one founder, not an agency floor",
];

export function ActionEngine() {
  return (
    <section style={{ background: "var(--c-dark)", color: "var(--c-on-dark)" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "70px 28px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 54, alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", color: ACCENT, textTransform: "uppercase" }}>The verified action engine</div>
          <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 38, letterSpacing: "-0.03em", lineHeight: 1.1, margin: "14px 0 0" }}>It doesn&apos;t just tell you.<br />It checks your work.</h2>
          <p style={{ fontSize: 16.5, lineHeight: 1.6, color: "var(--c-on-dark-muted)", margin: "18px 0 0", maxWidth: 440 }}>
            Mark a fix done and ReachKit re-reads your live page to confirm it actually shipped. Only then does your score move. That&apos;s what makes the number worth trusting: it&apos;s hard to move, so every point you gain is provable progress — not vanity.
          </p>
          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
            {POINTS.map((p) => (
              <div key={p} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 15, color: "var(--c-on-dark)" }}><span style={{ color: GREEN }}>✓</span> {p}</div>
            ))}
          </div>
        </div>
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: "var(--c-on-dark-muted)" }}>This week&apos;s queue</span>
            <span style={{ fontFamily: JM, fontSize: 12, color: ACCENT }}>refreshes in 4 days</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, background: ITEM, borderRadius: 10, padding: "12px 14px" }}>
              <span style={{ width: 18, height: 18, borderRadius: 999, background: "var(--c-band-findable)", color: "var(--c-on-dark)", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>✓</span>
              <span style={{ flex: 1, fontSize: 13.5, color: "var(--c-on-dark)", textDecoration: "line-through", opacity: 0.65 }}>Add FAQ schema to pricing</span>
              <span style={{ fontFamily: JM, fontSize: 12, color: GREEN }}>verified +4</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, background: ITEM, borderRadius: 10, padding: "12px 14px" }}>
              <span style={{ width: 18, height: 18, borderRadius: 999, border: "2px solid var(--c-action)", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--c-action)" }} /></span>
              <span style={{ flex: 1, fontSize: 13.5, color: "var(--c-on-dark)" }}>Claim G2 + Capterra listings</span>
              <span style={{ fontFamily: JM, fontSize: 12, color: AMBER }}>verifying…</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, background: ITEM, borderRadius: 10, padding: "12px 14px" }}>
              <span style={{ width: 18, height: 18, borderRadius: 999, border: `2px solid ${BORDER}` }} />
              <span style={{ flex: 1, fontSize: 13.5, color: "var(--c-on-dark)" }}>Publish 3 comparison pages</span>
              <span style={{ fontFamily: JM, fontSize: 12, color: "var(--c-on-dark-muted)" }}>predicted +6</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
