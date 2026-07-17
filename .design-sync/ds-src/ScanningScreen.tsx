/* @mirrors components/scan/captured-scanning.tsx */
import * as React from "react";

/**
 * ScanningScreen — the scan-in-progress screen (/scan/[id] while scanning):
 * a centred spinner ring with a live percent, "Scanning {host}" headline, a
 * subhead, and the step-log card (the real narrative: loading homepage →
 * reading hero → counting CTAs → reviews → rivals → positioning → compare →
 * score → snapshot). Mirrors `components/scan/captured-scanning.tsx`.
 *
 * `pct` is PASSED IN, not derived. The live component used to compute
 * `done / steps.length` here — that froze the ring for the whole 22.4s synth
 * call on a free scan and the 47.1s market pass on a deep one, and showed 100%
 * with a third of the scan still to run. It is now time-based with the checklist
 * as a forward-only ratchet (components/scan/scan-narrative.ts → scanProgressPct),
 * and this screen just renders the number.
 *
 * `refreshing` is the re-scan/deepen variant: the app already shows a score, so
 * the copy says so instead of implying a first run.
 */
export interface ScanningScreenProps {
  host?: string;
  steps?: { state: "done" | "active" | "pending"; label: string }[];
  /** 0–100. 100 means DONE — the in-flight ceiling is 95. */
  pct?: number;
  /** Re-scan/deepen over an app that already has a score on screen. */
  refreshing?: boolean;
}

const SG = "var(--font-display)", JM = "var(--font-mono)";

const CSS = `
@keyframes rk-spin { to { transform: rotate(360deg); } }
@keyframes rk-pulse { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
`;

const DEFAULT_STEPS: NonNullable<ScanningScreenProps["steps"]> = [
  { state: "done", label: "Loading your homepage" },
  { state: "done", label: "Reading your hero & value prop" },
  { state: "done", label: "Counting your CTAs — found 6" },
  { state: "done", label: "Reading 12 reviews" },
  { state: "active", label: "Sizing up 4 rivals" },
  { state: "pending", label: "Mapping your positioning" },
  { state: "pending", label: "Comparing how you stack up" },
  { state: "pending", label: "Scoring your discoverability" },
  { state: "pending", label: "Building your snapshot" },
];

export function ScanningScreen({ host = "bloom.io", steps = DEFAULT_STEPS, pct = 58, refreshing = false }: ScanningScreenProps) {
  return (
    <main style={{ minHeight: 620, display: "flex", alignItems: "center", justifyContent: "center", padding: 40, background: "radial-gradient(900px 500px at 50% 30%, var(--c-soft), var(--c-bg))", fontFamily: "var(--font-sans)", color: "var(--c-ink)" }}>
      <style>{CSS}</style>
      <div style={{ width: "min(560px, 92vw)", textAlign: "center", padding: 32 }}>
        <div style={{ position: "relative", width: 120, height: 120, margin: "0 auto 28px" }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: 999, border: "3px solid var(--c-tint-violet-line)" }} />
          <div style={{ position: "absolute", inset: 0, borderRadius: 999, border: "3px solid", borderColor: "var(--c-action) transparent transparent", animation: "rk-spin 1s linear infinite" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: JM, fontWeight: 700, fontSize: 26, color: "var(--c-action)" }}>{pct}%</div>
        </div>
        <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 26, letterSpacing: "-0.02em", margin: 0 }}>{refreshing ? "Refreshing" : "Scanning"} {host}</h2>
        <p style={{ fontSize: 15, color: "var(--c-faint)", margin: "8px 0 28px" }}>{refreshing ? "Your current score stays below while this runs…" : "Reading your page the way a customer’s search does…"}</p>
        <div style={{ textAlign: "left", background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 14, padding: 10, boxShadow: "0 10px 30px -12px rgba(40,33,84,0.18)", display: "flex", flexDirection: "column" }}>
          {steps.map((s) => {
            const on = s.state === "done" || s.state === "active";
            return (
              <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderRadius: 10, background: s.state === "active" ? "var(--c-soft)" : "transparent", opacity: s.state === "pending" ? 0.4 : 1 }}>
                <span style={{ width: 20, height: 20, borderRadius: 999, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: on ? "var(--c-action)" : "var(--c-line)" }}>
                  {s.state === "done" && <span style={{ color: "var(--c-on-dark)", fontSize: 12, fontWeight: 700 }}>✓</span>}
                  {s.state === "active" && <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--c-surface)", animation: "rk-pulse 1s ease infinite" }} />}
                </span>
                <span style={{ flex: 1, fontSize: 14, fontWeight: on ? 600 : 500, color: on ? "var(--c-ink)" : "var(--c-faint)" }}>{s.label}</span>
                {s.state === "active" && <span style={{ fontFamily: JM, fontSize: 12, color: "var(--c-action)" }}>…</span>}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
