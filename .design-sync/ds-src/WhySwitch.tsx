/* @mirrors components/sections/captured/landing-html.ts */
import * as React from "react";

/**
 * WhySwitch — the landing's "honest comparison" matrix: ReachKit vs a chatbot
 * prompt vs an SEO suite across five capabilities, ReachKit's column highlighted
 * with green "Yes" cells. Mirrors the comparison section of the live landing
 * (`landing-html.ts`).
 */
export interface WhySwitchProps {
  _unused?: never;
}

const SG = "var(--font-display)";
const COLS = "1.6fr 1fr 1fr 1fr";
const ROWS: { label: string; cells: [string, string, string] }[] = [
  { label: "Reads your live page", cells: ["Yes", "Hallucinates", "Crawls only"] },
  { label: "One clear score", cells: ["Yes", "No", "200 metrics"] },
  { label: "Ranked, drafted fixes", cells: ["Yes", "Generic", "You triage"] },
  { label: "Verifies the fix shipped", cells: ["Yes", "No", "No"] },
  { label: "Built for one founder", cells: ["Yes", "—", "For agencies"] },
];

export function WhySwitch() {
  return (
    <section style={{ maxWidth: 1080, margin: "0 auto", padding: "70px 28px 20px" }}>
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", color: "var(--c-action)", textTransform: "uppercase" }}>Why switch</div>
        <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 34, letterSpacing: "-0.03em", margin: "12px 0 0" }}>The honest comparison</h2>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: "var(--c-muted)", maxWidth: 520, margin: "12px auto 0" }}>Data tools hand you numbers. ReachKit hands you the decision.</p>
      </div>
      <div style={{ border: "1px solid var(--c-line)", borderRadius: 16, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: COLS, background: "var(--c-bg2)", borderBottom: "1px solid var(--c-line2)" }}>
          <div style={{ padding: "18px 22px" }} />
          <div style={{ padding: "18px 16px", textAlign: "center", background: "var(--c-soft)" }}><div style={{ fontFamily: SG, fontWeight: 700, fontSize: 16, color: "var(--c-action)" }}>ReachKit</div></div>
          <div style={{ padding: "18px 16px", textAlign: "center" }}><div style={{ fontWeight: 600, fontSize: 14, color: "var(--c-muted)" }}>A chatbot prompt</div></div>
          <div style={{ padding: "18px 16px", textAlign: "center" }}><div style={{ fontWeight: 600, fontSize: 14, color: "var(--c-muted)" }}>An SEO suite</div></div>
        </div>
        {ROWS.map((r) => (
          <div key={r.label} style={{ display: "grid", gridTemplateColumns: COLS, borderBottom: "1px solid var(--c-fill)", alignItems: "center" }}>
            <div style={{ padding: "15px 22px", fontSize: 14.5, fontWeight: 600, color: "var(--c-muted)" }}>{r.label}</div>
            <div style={{ padding: "15px 16px", textAlign: "center", background: "var(--c-soft)", fontSize: 14, fontWeight: 700, color: "var(--c-band-findable)" }}>{r.cells[0]}</div>
            <div style={{ padding: "15px 16px", textAlign: "center", fontSize: 14, color: "var(--c-faint)" }}>{r.cells[1]}</div>
            <div style={{ padding: "15px 16px", textAlign: "center", fontSize: 14, color: "var(--c-faint)" }}>{r.cells[2]}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
