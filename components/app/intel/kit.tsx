"use client";

/**
 * Intel design kit — THE single, consistent component set for every intel
 * dashboard (Supply / Demand / Synthesis / Plans). Built strictly in the ReachKit
 * design-system idiom (.design-sync/conventions.md): inline styles reading `--c-*`
 * tokens, native elements, Space Grotesk / JetBrains Mono fonts, tint chips, and
 * the signature 270° gauge. NO shadcn primitives, NO recharts, NO foreign token
 * vocab — one approach for cards, stats, badges, charts, tables, tabs, drilldowns.
 */
import * as React from "react";
import { useState } from "react";
import { bandFor, arcPath, GAUGE_SWEEP, type Band } from "@/components/app/intel/bands";

export { bandFor, type Band };

const SG = "var(--font-display)", JM = "var(--font-mono)", PJ = "var(--font-sans)";
const CARD: React.CSSProperties = { background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-xl)", boxShadow: "rgba(20,19,26,0.03) 0px 1px 2px" };
const ELLIPSIS: React.CSSProperties = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

// ---------------------------------------------------------------------------
// Badge — canonical tones (ds-src/Badge.tsx)
// ---------------------------------------------------------------------------
export type Tone = "violet" | "neutral" | "green" | "amber" | "red" | "blue" | "orange";
const TINT: Record<Tone, { bg: string; fg: string }> = {
  violet: { bg: "var(--c-soft)", fg: "var(--c-action)" },
  neutral: { bg: "var(--c-fill)", fg: "var(--c-muted)" },
  green: { bg: "var(--c-tint-green)", fg: "#1f9d5b" },
  amber: { bg: "var(--c-tint-amber)", fg: "#c98a12" },
  red: { bg: "var(--c-tint-red)", fg: "#e5484d" },
  blue: { bg: "var(--c-tint-blue)", fg: "#3b6fe0" },
  orange: { bg: "var(--c-tint-orange)", fg: "#e0731c" },
};
export const priorityTone = (p: string): Tone => (p === "high" ? "red" : p === "medium" ? "amber" : "neutral");
export const effortTone = (e: string): Tone => (e === "low" ? "green" : e === "high" ? "red" : "amber");
export const intentTone = (i: string): Tone => { const v = (i || "").toLowerCase(); return v.startsWith("transaction") ? "green" : v.startsWith("commercial") ? "violet" : "neutral"; };

export function Badge({ tone = "violet", children, style }: { tone?: Tone; children: React.ReactNode; style?: React.CSSProperties }) {
  const c = TINT[tone];
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: c.bg, color: c.fg, fontFamily: PJ, fontWeight: 700, fontSize: 11.5, padding: "3px 9px", borderRadius: "var(--radius-xs)", lineHeight: 1.2, whiteSpace: "nowrap", ...style }}>{children}</span>;
}

// ---------------------------------------------------------------------------
// Card — the standard panel (settings-main idiom)
// ---------------------------------------------------------------------------
export function Card({ title, meta, info, children, style }: { title?: React.ReactNode; meta?: React.ReactNode; info?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <section style={{ ...CARD, padding: "20px 22px", ...style }}>
      {(title || meta) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
          {title && <h2 style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: SG, fontWeight: 700, fontSize: 15, color: "var(--c-ink)", margin: 0 }}>{title}{info && <InfoDot text={info} />}</h2>}
          {meta && <span style={{ fontSize: 12, color: "var(--c-faint)", flexShrink: 0 }}>{meta}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Violet gradient hero panel (settings "Plan" / dashboard "next action" idiom). */
export function HeroCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <section style={{ background: "linear-gradient(120deg, var(--c-tint-violet), var(--c-soft))", border: "1px solid var(--c-tint-violet-line)", borderRadius: "var(--radius-xl)", padding: "20px 22px", ...style }}>{children}</section>;
}

export function Eyebrow({ children, color = "var(--c-faint)" }: { children: React.ReactNode; color?: string }) {
  return <div style={{ fontFamily: JM, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color }}>{children}</div>;
}

function InfoDot({ text }: { text: string }) {
  return <span title={text} tabIndex={0} style={{ display: "inline-flex", width: 15, height: 15, alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-full)", background: "var(--c-fill)", color: "var(--c-faint)", fontSize: 9, fontWeight: 700, cursor: "help" }}>i</span>;
}

// ---------------------------------------------------------------------------
// Kpi / KpiRow (ds-src/KpiCard.tsx)
// ---------------------------------------------------------------------------
export function KpiRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>{children}</div>;
}

export function Kpi({ label, value, sub, color }: { label: string; value: React.ReactNode; sub?: React.ReactNode; color?: string }) {
  return (
    <div style={{ ...CARD, borderRadius: "var(--radius-lg)", padding: "18px 20px 16px" }}>
      <div style={{ fontFamily: JM, fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--c-faint)" }}>{label}</div>
      <div style={{ fontFamily: JM, fontWeight: 700, fontSize: 34, lineHeight: 1.05, letterSpacing: "-0.02em", color: color ?? "var(--c-ink)", marginTop: 8 }}>{value}</div>
      {sub != null && <div style={{ fontFamily: PJ, fontSize: 12.5, color: "var(--c-muted)", marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gauge — the signature 270° dial (ds-src/ScoreGauge.tsx)
// ---------------------------------------------------------------------------
export function Gauge({ score, sub, size = 184 }: { score: number; sub?: string; size?: number }) {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  const band = bandFor(s);
  const cx = 100, cy = 100, r = 78, sw = 15;
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <svg width={size} height={size} viewBox="0 0 200 200" style={{ display: "block" }} role="img" aria-label={`Score ${s} of 100`}>
        <path d={arcPath(cx, cy, r, GAUGE_SWEEP)} fill="none" stroke="var(--c-fill)" strokeWidth={sw} strokeLinecap="round" />
        <path d={arcPath(cx, cy, r, (GAUGE_SWEEP * s) / 100)} fill="none" stroke={band.color} strokeWidth={sw} strokeLinecap="round" />
        <text x="100" y="106" textAnchor="middle" style={{ font: "700 42px var(--font-mono), monospace", fill: "var(--c-ink)" }}>{s}</text>
        <text x="100" y="126" textAnchor="middle" style={{ font: "600 11px var(--font-mono), monospace", fill: "var(--c-faint)", letterSpacing: "1px" }}>/ 100</text>
      </svg>
      <span style={{ display: "inline-flex", alignItems: "center", background: `${band.color}1f`, color: band.color, fontFamily: SG, fontWeight: 700, fontSize: 13, padding: "5px 13px", borderRadius: "var(--radius-sm)" }}>{band.label}</span>
      {sub && <div style={{ fontSize: 12, color: "var(--c-faint)" }}>{sub}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Charts — inline SVG / div, in the same token idiom
// ---------------------------------------------------------------------------
export const PALETTE = ["var(--c-action)", "#46a758", "#e0b341", "#3b6fe0", "#e0731c", "var(--c-faint)"];

export interface Segment { label: string; value: number; color: string }

export function Donut({ segments, centerLabel, centerSub, size = 132, thickness = 16 }: { segments: Segment[]; centerLabel?: string; centerSub?: string; size?: number; thickness?: number }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const cx = size / 2, r = (size - thickness) / 2, c = 2 * Math.PI * r;
  const fractions = segments.map((s) => s.value / total);
  const offsets = fractions.map((_, i) => -fractions.slice(0, i).reduce((a, b) => a + b, 0) * c);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="chart">
        <g transform={`rotate(-90 ${cx} ${cx})`}>
          <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--c-fill)" strokeWidth={thickness} />
          {segments.map((seg, i) => fractions[i]! <= 0 ? null : (
            <circle key={i} cx={cx} cy={cx} r={r} fill="none" stroke={seg.color} strokeWidth={thickness} strokeDasharray={`${(fractions[i]! * c).toFixed(2)} ${(c - fractions[i]! * c).toFixed(2)}`} strokeDashoffset={offsets[i]!.toFixed(2)} />
          ))}
        </g>
        {centerLabel && <text x={cx} y={cx - 1} textAnchor="middle" dominantBaseline="middle" style={{ font: `700 ${size * 0.19}px var(--font-mono)`, fill: "var(--c-ink)" }}>{centerLabel}</text>}
        {centerSub && <text x={cx} y={cx + size * 0.13} textAnchor="middle" dominantBaseline="middle" style={{ font: `${size * 0.07}px var(--font-mono)`, fill: "var(--c-faint)" }}>{centerSub}</text>}
      </svg>
      <ul style={{ minWidth: 0, flex: 1, margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
        {segments.map((seg, i) => (
          <li key={i} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, fontSize: 12 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, minWidth: 0 }}>
              <span style={{ width: 8, height: 8, borderRadius: "var(--radius-full)", background: seg.color, flexShrink: 0 }} />
              <span style={{ color: "var(--c-muted)", ...ELLIPSIS }}>{seg.label}</span>
            </span>
            <span style={{ fontFamily: JM, color: "var(--c-faint)", flexShrink: 0 }}>{Math.round((seg.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface BarDatum { label: string; value: number; color?: string }
export function HBars({ data, format }: { data: BarDatum[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 150, flexShrink: 0, fontSize: 12, color: "var(--c-muted)", textAlign: "right", ...ELLIPSIS }}>{d.label}</span>
          <div style={{ flex: 1, height: 16, background: "var(--c-fill)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
            <div style={{ width: `${Math.max(2, (d.value / max) * 100)}%`, height: "100%", background: d.color ?? "var(--c-action)", borderRadius: "var(--radius-sm)" }} />
          </div>
          <span style={{ width: 52, flexShrink: 0, fontFamily: JM, fontSize: 11.5, color: "var(--c-faint)", textAlign: "right" }}>{format ? format(d.value) : d.value}</span>
        </div>
      ))}
    </div>
  );
}

/** A single inline intensity/progress bar. */
export function Bar({ value, max = 100, color = "var(--c-action)", height = 7 }: { value: number; max?: number; color?: string; height?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return <div style={{ height, background: "var(--c-fill)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: "var(--radius-sm)" }} /></div>;
}

export interface QuadrantItem { ease: number; impact: number; color: string; label: string }
export function Quadrant({ items, legend }: { items: QuadrantItem[]; legend?: { color: string; label: string }[] }) {
  const MIN = 14, MAX = 92, span = MAX - MIN, mid = (MIN + MAX) / 2;
  const mapX = (e: number) => MIN + e * span, mapY = (i: number) => MAX - i * span;
  const lbl = (x: number, y: number, t: string, anchor: string) => <text x={x} y={y} textAnchor={anchor} style={{ font: "600 3.4px var(--font-mono)", fill: "var(--c-faint)", letterSpacing: "0.04em" }}>{t}</text>;
  return (
    <div>
      <svg viewBox="0 0 106 100" width="100%" style={{ display: "block", maxWidth: 440, margin: "0 auto" }}>
        <line x1={mid} y1={MIN - 4} x2={mid} y2={MAX + 4} stroke="var(--c-line)" strokeWidth="0.4" strokeDasharray="1.5 1.5" />
        <line x1={MIN - 4} y1={mid} x2={MAX + 4} y2={mid} stroke="var(--c-line)" strokeWidth="0.4" strokeDasharray="1.5 1.5" />
        {lbl(MIN - 2, MIN, "BIG BETS", "start")}{lbl(MAX + 2, MIN, "QUICK WINS", "end")}
        {lbl(MIN - 2, MAX + 4, "LOW PRIORITY", "start")}{lbl(MAX + 2, MAX + 4, "FILL-INS", "end")}
        <text x={mid} y={99} textAnchor="middle" style={{ font: "600 3.2px var(--font-mono)", fill: "var(--c-faint)" }}>EASE →</text>
        <text x={MIN - 9} y={mid} textAnchor="middle" transform={`rotate(-90 ${MIN - 9} ${mid})`} style={{ font: "600 3.2px var(--font-mono)", fill: "var(--c-faint)" }}>IMPACT →</text>
        {items.map((it, i) => <circle key={i} cx={mapX(it.ease)} cy={mapY(it.impact)} r="2.6" fill={it.color} opacity="0.9"><title>{it.label}</title></circle>)}
      </svg>
      {legend && <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 8, justifyContent: "center" }}>{legend.map((l, i) => <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--c-muted)" }}><span style={{ width: 8, height: 8, borderRadius: "var(--radius-full)", background: l.color }} />{l.label}</span>)}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DataTable — generic grid table (ds-src/SearchGapTable.tsx idiom)
// ---------------------------------------------------------------------------
export function DataTable({ cols, head, rows }: { cols: string; head: React.ReactNode[]; rows: React.ReactNode[][] }) {
  return (
    <div style={{ ...CARD, borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: cols, padding: "11px 16px", borderBottom: "1px solid var(--c-line)", fontFamily: PJ, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", color: "var(--c-faint)", textTransform: "uppercase", background: "var(--c-fill)" }}>
        {head.map((h, i) => <span key={i}>{h}</span>)}
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: cols, padding: "11px 16px", borderBottom: i < rows.length - 1 ? "1px solid var(--c-fill)" : "none", alignItems: "center", fontFamily: PJ, fontSize: 13.5, color: "var(--c-ink)" }}>
          {r.map((cell, j) => <span key={j} style={{ minWidth: 0 }}>{cell}</span>)}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabs (ds-src/Tabs.tsx, interactive)
// ---------------------------------------------------------------------------
export function Tabs({ tabs, active, onChange }: { tabs: string[]; active: number; onChange: (i: number) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "stretch", gap: 4, borderBottom: "1px solid var(--c-line)" }}>
      {tabs.map((tab, i) => {
        const on = i === active;
        return <button key={i} type="button" onClick={() => onChange(i)} style={{ position: "relative", padding: "10px 14px", marginBottom: -1, background: "transparent", border: "none", borderBottom: `2px solid ${on ? "var(--c-action)" : "transparent"}`, color: on ? "var(--c-action)" : "var(--c-muted)", fontFamily: PJ, fontSize: 14, fontWeight: on ? 600 : 500, cursor: "pointer", lineHeight: 1.2 }}>{tab}</button>;
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expand — inline drilldown (replaces the modal; one consistent reveal pattern)
// ---------------------------------------------------------------------------
export function Expand({ label, children, defaultOpen }: { label: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: PJ, fontSize: 12.5, fontWeight: 600, color: "var(--c-action)" }}>{label} {open ? "▾" : "▸"}</button>
      {open && <div style={{ marginTop: 10 }}>{children}</div>}
    </div>
  );
}

export function EvidenceLink({ href, children, style }: { href: string; children: React.ReactNode; style?: React.CSSProperties }) {
  if (!href) return <span style={style}>{children}</span>;
  return <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "var(--c-action)", textDecoration: "none", fontWeight: 500, ...style }}>{children} <span style={{ fontSize: "0.85em" }}>↗</span></a>;
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return <button type="button" onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }} style={{ flexShrink: 0, background: "none", border: "1px solid var(--c-line)", borderRadius: "var(--radius-sm)", padding: "4px 10px", fontFamily: PJ, fontSize: 11, color: "var(--c-muted)", cursor: "pointer" }}>{copied ? "Copied ✓" : label}</button>;
}

/** Primary violet action button (settings idiom). */
export function ActionButton({ href, onClick, children }: { href?: string; onClick?: () => void; children: React.ReactNode }) {
  const style: React.CSSProperties = { display: "inline-block", background: "var(--c-action)", color: "var(--c-on-dark)", fontFamily: PJ, fontWeight: 600, fontSize: 13, padding: "9px 16px", borderRadius: "var(--radius-lg)", border: "none", cursor: "pointer", textDecoration: "none" };
  return href ? <a href={href} style={style}>{children}</a> : <button type="button" onClick={onClick} style={style}>{children}</button>;
}
