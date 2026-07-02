import * as React from "react";
import { bandFor } from "./bands";

export interface ScoreGaugeProps {
  /** Discoverability score, 0–100. */
  score: number;
  /** Diameter in px. */
  size?: number;
  /** Show the band label pill under the gauge. */
  showBand?: boolean;
}

/** Maps a band key to its `--c-tint-*` background token (mirrors the reference template's `band()` helper). */
const BAND_TINT: Record<string, string> = {
  invisible: "var(--c-tint-red)",
  hard: "var(--c-tint-orange)",
  fair: "var(--c-tint-amber)",
  findable: "var(--c-tint-green)",
  high: "var(--c-tint-green)",
};

/**
 * The signature ReachKit gauge — a 270° ring that fills to the score, coloured by
 * its discoverability band, with the number centred. Used in the report hero,
 * dashboard, and share card. Geometry (232 viewBox, r=92, 18px stroke, 135°
 * rotation, 0.75-circumference sweep) matches the reference dashboard template.
 */
export function ScoreGauge({ score, size = 200, showBand = true }: ScoreGaugeProps) {
  const s = Math.max(0, Math.min(100, score));
  const band = bandFor(s);
  const colorVar = `var(--c-band-${band.key})`;
  const tintVar = BAND_TINT[band.key] ?? "var(--c-tint-red)";

  const cx = 116, cy = 116, r = 92, sw = 18;
  const circumference = 2 * Math.PI * r;
  const span = 0.75 * circumference; // 270° of the ring
  const fill = (s / 100) * span;

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <div style={{ position: "relative", width: size, height: size, flex: "0 0 auto" }}>
        <svg viewBox="0 0 232 232" width={size} height={size} style={{ display: "block" }}>
          <g transform={`rotate(135 ${cx} ${cy})`} fill="none" strokeWidth={sw} strokeLinecap="round">
            <circle cx={cx} cy={cy} r={r} stroke="var(--c-fill)" strokeDasharray={`${span.toFixed(1)} ${circumference.toFixed(1)}`} />
            <circle cx={cx} cy={cy} r={r} stroke={colorVar} strokeDasharray={`${fill.toFixed(1)} ${circumference.toFixed(1)}`} />
          </g>
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <b style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: size * 0.2955, color: "var(--c-ink)", lineHeight: 1 }}>{s}</b>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: size * 0.0739, color: "var(--c-faint)" }}>/ 100</span>
        </div>
      </div>
      {showBand && (
        <span style={{ display: "inline-flex", alignItems: "center", fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 13, padding: "5px 14px", borderRadius: "var(--radius-full)", background: tintVar, color: colorVar }}>
          {band.label}
        </span>
      )}
    </div>
  );
}
