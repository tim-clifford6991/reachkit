/* @mirrors components/app/setup/setup-overlay.tsx */
import * as React from "react";

/**
 * OnboardingScreen — the first-run setup overlay (`setup-overlay.tsx`): a blurred
 * full-screen dialog with a "Step n of 3 · {label}" progress header and a
 * Sign-out escape, showing the Profile step (name + distribution goal + ICP).
 * Mirrors the live setup overlay (step 1).
 */
export interface OnboardingScreenProps {
  _unused?: never;
}

const SG = "var(--font-display)", JM = "var(--font-mono)";
const STEP = 1, STEPS = ["Profile", "Competitors", "Your data"];
const GOALS = [
  "More signups / installs",
  "Launch on Product Hunt / Hacker News",
  "Rank for key search terms",
  "Find creators & communities to reach",
  "Not sure yet — show me what works",
];

const field: React.CSSProperties = { width: "100%", background: "var(--c-bg)", border: "1px solid var(--c-line)", borderRadius: 10, padding: "10px 12px", fontSize: 14, color: "var(--c-ink)", outline: "none", fontFamily: "var(--font-sans)" };
const label: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "var(--c-ink)", display: "block", marginBottom: 6 };

export function OnboardingScreen() {
  return (
    <div style={{ position: "relative", minHeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: 40, background: "color-mix(in oklab, var(--c-bg2) 88%, transparent)", fontFamily: "var(--font-sans)", color: "var(--c-ink)" }}>
      <form style={{ position: "absolute", top: 22, left: 26 }}><button style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--c-muted)", background: "transparent", border: "1px solid var(--c-line)", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>Sign out</button></form>
      {/* Escapes — blocked, never trapped: switch to another product or jump to Settings. */}
      <div style={{ position: "absolute", top: 22, right: 26, display: "flex", gap: 8 }}>
        <button style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600, color: "var(--c-muted)", background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>Switch product ▾</button>
        <a href="/app/settings" style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600, color: "var(--c-muted)", background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 8, padding: "6px 12px", textDecoration: "none" }}>Settings</a>
      </div>
      <div style={{ width: "min(720px, 100%)", background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-xl)", boxShadow: "0 30px 80px -30px rgba(40,33,84,0.4)", padding: 40 }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: JM, fontSize: 12, color: "var(--c-faint)", marginBottom: 10 }}>Step {STEP} of 3 · {STEPS[STEP - 1]}</div>
          <div style={{ display: "flex", gap: 6 }}>{STEPS.map((_, i) => <span key={i} style={{ width: 26, height: 4, borderRadius: 999, background: i < STEP ? "var(--c-action)" : "var(--c-fill)" }} />)}</div>
        </div>

        <div style={{ fontFamily: JM, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--c-action)" }}>Welcome to ReachKit</div>
        <h1 style={{ fontFamily: SG, fontWeight: 700, fontSize: 28, letterSpacing: "-0.02em", margin: "10px 0 8px" }}>Let&apos;s set up your engine</h1>
        <p style={{ fontSize: 15, lineHeight: 1.5, color: "var(--c-muted)", margin: "0 0 26px", maxWidth: 520 }}>Two quick things so every recommendation is grounded in what you actually want to achieve. Takes about a minute.</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div><label style={label}>What should we call you?</label><input readOnly placeholder="Your name" style={field} /></div>
          <div>
            <label style={label}>What&apos;s your primary distribution goal right now?</label>
            <select style={{ ...field, appearance: "none" }} defaultValue="">
              <option value="" disabled>Choose a focus…</option>
              {GOALS.map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Who&apos;s your ideal customer? (we detected these — edit freely)</label>
            <div style={{ fontSize: 12, color: "var(--c-faint)", margin: "-2px 0 6px" }}>One trait per line. This grounds your competitive and channel analysis.</div>
            <textarea readOnly rows={3} defaultValue={"solo founders\nindie developers\nproductivity enthusiasts"} style={{ ...field, resize: "none", lineHeight: 1.5 }} />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 26 }}>
          <span style={{ fontSize: 12.5, color: "var(--c-faint)" }}>Next: pick your competitors</span>
          <button style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 14, color: "var(--c-on-dark)", background: "var(--c-action)", border: "none", borderRadius: "var(--radius-lg)", padding: "11px 22px", cursor: "pointer" }}>Continue →</button>
        </div>
      </div>
    </div>
  );
}
