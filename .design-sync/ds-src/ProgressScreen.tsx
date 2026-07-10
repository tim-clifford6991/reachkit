/* @mirrors components/app/intel/progress-view.tsx */
import * as React from "react";
import { AppShell } from "./AppShell";
import { Card, Badge } from "./IntelKit";

/**
 * ProgressScreen — the `/app/progress` page: the "Discoverability over time"
 * trend (with the pillar overlay legend + verified-fix markers), the "Why it
 * moved" signal-diff card, and the "What changed" changelog. Composes the shared
 * IntelKit. Mirrors the live progress-view.
 */
export interface ProgressScreenProps {
  _unused?: never;
}

const JM = "var(--font-mono)";
const stateColor = (s: string) => (s === "pass" ? "var(--c-band-findable)" : s === "warn" ? "var(--c-band-fair)" : s === "fail" ? "var(--c-band-invisible)" : "var(--c-faint)");

const WHY = [
  { pillar: "SEO", signal: "Schema markup", from: "fail", to: "pass", delta: "+4.0" },
  { pillar: "Content", signal: "Content depth", from: "warn", to: "pass", delta: "+2.5" },
  { pillar: "Outreach", signal: "Directory presence", from: "fail", to: "warn", delta: "+1.5" },
];
const CHANGES = [
  { date: "Jul 8", label: "Verified: Added FAQ schema to pricing", delta: "+4", up: true },
  { date: "Jul 3", label: "Verified: Claimed G2 + Capterra listings", delta: "+3", up: true },
  { date: "Jun 28", label: "Baseline scan — nudgi.ai", delta: null, up: true },
];

export function ProgressScreen() {
  return (
    <AppShell active="history" headerTitle="Progress" headerSub="Your Discoverability Score over time and what moved it." user={{ name: "Nadia L.", sub: "nudgi.ai · solo founder" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <Card title="Discoverability over time" info="Your Discoverability Score at each scan. Dots mark a verified fix that moved the score.">
          <svg viewBox="0 0 820 240" width="100%" height="220" preserveAspectRatio="none" aria-hidden="true">
            <defs><linearGradient id="rkProgress" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--c-action)" stopOpacity="0.2" /><stop offset="100%" stopColor="var(--c-action)" stopOpacity="0" /></linearGradient></defs>
            {[60, 120, 180].map((y) => <line key={y} x1="0" y1={y} x2="820" y2={y} stroke="var(--c-line)" strokeWidth="1" strokeDasharray="4 6" />)}
            <path d="M0,190 L205,168 L410,150 L615,120 L820,96 L820,240 L0,240 Z" fill="url(#rkProgress)" />
            <path d="M0,190 L205,168 L410,150 L615,120 L820,96" fill="none" stroke="var(--c-action)" strokeWidth="3" />
            {[[205, 168], [615, 120]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="5.5" fill="var(--c-action)" stroke="var(--c-surface)" strokeWidth="2" />)}
          </svg>
          <div style={{ display: "flex", gap: 16, marginTop: 8, fontFamily: JM, fontSize: 11, color: "var(--c-faint)" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: "var(--c-band-findable)" }} /> Content</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: "var(--c-action)" }} /> Outreach</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: "var(--c-band-hard)" }} /> SEO</span>
            <span style={{ marginLeft: "auto" }}>dots = a fix shipped</span>
          </div>
        </Card>

        <Card title="Why it moved" info="Signal-level changes between your two most recent scans — the concrete reasons your score shifted.">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {WHY.map((w) => (
              <div key={w.signal} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <Badge tone="neutral">{w.pillar}</Badge>
                <span style={{ flex: 1, fontSize: 13.5, minWidth: 140 }}>{w.signal}</span>
                <span style={{ fontFamily: JM, fontSize: 12.5 }}><span style={{ color: stateColor(w.from) }}>{w.from}</span> → <span style={{ color: stateColor(w.to) }}>{w.to}</span></span>
                <span style={{ fontFamily: JM, fontSize: 13, fontWeight: 700, color: "var(--c-band-high)", width: 64, textAlign: "right" }}>{w.delta} pts</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="What changed">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {CHANGES.map((c) => (
              <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontFamily: JM, fontSize: 12, color: "var(--c-faint)", width: 54 }}>{c.date}</span>
                <span style={{ flex: 1, fontSize: 13.5 }}>{c.label}</span>
                {c.delta && <Badge tone="green">+{c.delta.replace("+", "")}</Badge>}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
