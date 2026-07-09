import * as React from "react";
import { Button } from "./Button";
import { BrandMark } from "./BrandMark";

/**
 * OnboardingScreen — the setup overlay (`setup-overlay.tsx`) shown over /app until
 * setup completes. Three steps: Profile → Competitors → Calculating. This card shows
 * the Competitors step (step 2 of 3): the discovered rivals the founder confirms or
 * deselects before the deep gather runs. A slim "Step n of 3" progress header sits on
 * top. Composes Button + BrandMark. Renders fully with no props.
 */
export interface OnboardingScreenProps {
  _unused?: never;
}

const JM = "var(--font-mono)";
const RIVALS = [
  { name: "otter.ai", host: "otter.ai", on: true },
  { name: "Fireflies", host: "fireflies.ai", on: true },
  { name: "Fathom", host: "fathom.video", on: true },
  { name: "Grain", host: "grain.com", on: false },
  { name: "tl;dv", host: "tldv.io", on: false },
];

export function OnboardingScreen() {
  return (
    <div style={{ position: "relative", minHeight: 620, background: "var(--c-bg2)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "var(--font-sans)" }}>
      {/* backdrop */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(22,20,31,0.42)" }} />
      {/* modal */}
      <div style={{ position: "relative", width: "100%", maxWidth: 560, background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-xl)", boxShadow: "var(--elevation-lg)", padding: "26px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
        {/* progress header */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <BrandMark size={22} />
            <span style={{ fontFamily: JM, fontSize: 11.5, fontWeight: 700, letterSpacing: "0.04em", color: "var(--c-muted)" }}>STEP 2 OF 3 · CONFIRM COMPETITORS</span>
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ flex: 1, height: 4, borderRadius: 3, background: i <= 2 ? "var(--c-action)" : "var(--c-fill)" }} />
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, letterSpacing: "-0.01em", margin: 0 }}>These look like your competitors</h2>
          <p style={{ fontSize: 14, color: "var(--c-muted)", margin: 0, lineHeight: 1.5 }}>We found these from your category. Keep the real rivals — we'll analyse how each one gets found.</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {RIVALS.map((r) => (
            <label key={r.host} style={{ display: "flex", alignItems: "center", gap: 12, border: `1px solid ${r.on ? "var(--c-action)" : "var(--c-line)"}`, background: r.on ? "var(--c-soft)" : "var(--c-surface)", borderRadius: "var(--radius-md)", padding: "11px 14px", cursor: "pointer" }}>
              <span style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${r.on ? "var(--c-action)" : "var(--c-line)"}`, background: r.on ? "var(--c-action)" : "transparent", color: "#fff", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{r.on ? "✓" : ""}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--c-ink)" }}>{r.name}</span>
              <span style={{ fontFamily: JM, fontSize: 12, color: "var(--c-faint)" }}>{r.host}</span>
            </label>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Button variant="primary">Analyse 3 competitors →</Button>
          <span style={{ fontSize: 12, color: "var(--c-faint)" }}>You can change these any time.</span>
        </div>
      </div>
    </div>
  );
}
