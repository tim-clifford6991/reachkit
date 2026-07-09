import * as React from "react";
import { NavBar } from "./NavBar";
import { ScanningRing } from "./ScanningRing";

/**
 * ScanningScreen — the scan-in-progress state (`/scan/[id]` while the pipeline
 * runs): the marketing NavBar over a centred ScanningRing with the domain being
 * scanned and the live staged progress (collect → findings → score) streamed off
 * the SSE. Composes NavBar + ScanningRing. Renders fully with no props.
 */
export interface ScanningScreenProps {
  domain?: string;
}

const JM = "var(--font-mono)";
const STAGES = [
  { label: "Fetched your live page", done: true },
  { label: "Scored Content, Outreach & SEO", done: true },
  { label: "Finding your competitors", done: false, active: true },
  { label: "Mining customer demand", done: false },
  { label: "Building your ranked plan", done: false },
];

export function ScanningScreen({ domain = "nudgi.ai" }: ScanningScreenProps) {
  return (
    <div style={{ background: "var(--c-bg)", minHeight: 620, fontFamily: "var(--font-sans)", color: "var(--c-ink)" }}>
      <NavBar />
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "56px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 22, textAlign: "center" }}>
        <ScanningRing />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 24, letterSpacing: "-0.01em", margin: 0 }}>Scanning {domain}</h1>
          <p style={{ fontSize: 14, color: "var(--c-muted)", margin: 0 }}>Under a minute — hang tight while we map how findable you are.</p>
        </div>

        <div style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 10, marginTop: 6, textAlign: "left" }}>
          {STAGES.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700,
                background: s.done ? "var(--c-band-findable)" : s.active ? "var(--c-soft)" : "var(--c-fill)",
                color: s.done ? "#fff" : "var(--c-action)",
                border: s.active ? "1.5px solid var(--c-action)" : "none" }}>{s.done ? "✓" : s.active ? "•" : ""}</span>
              <span style={{ fontSize: 14, fontWeight: s.active ? 600 : 500, color: s.done ? "var(--c-ink)" : s.active ? "var(--c-action)" : "var(--c-faint)" }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
