import * as React from "react";
import { bandFor, arcPath, GAUGE_SWEEP } from "./bands";

export interface ScoreGaugeProps {
  /** Discoverability score, 0–100. */
  score: number;
  /** Diameter in px. */
  size?: number;
  /** Show the band label pill under the gauge. */
  showBand?: boolean;
}

/**
 * The signature ReachKit gauge — a 270° arc that fills to the score, coloured by
 * its discoverability band, with the number centred. Used in the report hero,
 * dashboard, and share card.
 */
export function ScoreGauge({ score, size = 200, showBand = true }: ScoreGaugeProps) {
  const s = Math.max(0, Math.min(100, score));
  const band = bandFor(s);
  const cx = 100, cy = 100, r = 78, sw = 15;
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <svg width={size} height={size} viewBox="0 0 200 200" style={{ display: "block" }}>
        <path d={arcPath(cx, cy, r, GAUGE_SWEEP)} fill="none" stroke="var(--c-fill)" strokeWidth={sw} strokeLinecap="round" />
        <path d={arcPath(cx, cy, r, (GAUGE_SWEEP * s) / 100)} fill="none" stroke={band.color} strokeWidth={sw} strokeLinecap="round" />
        <text x="100" y="106" textAnchor="middle" style={{ font: "700 42px var(--font-mono), monospace", fill: "var(--c-ink)" }}>{s}</text>
        <text x="100" y="126" textAnchor="middle" style={{ font: "600 11px var(--font-mono), monospace", fill: "var(--c-faint)", letterSpacing: "1px" }}>/ 100</text>
      </svg>
      {showBand && (
        <span style={{ display: "inline-flex", alignItems: "center", background: `${band.color}1f`, color: band.color, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, padding: "5px 13px", borderRadius: "var(--radius-sm)" }}>
          {band.label}
        </span>
      )}
    </div>
  );
}
