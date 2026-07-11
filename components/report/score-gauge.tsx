/**
 * ScoreGauge — THE canonical score dial, extracted from the results screen
 * (components/report/captured/results-screen.tsx) so every funnel surface shows
 * the exact same gauge geometry + band colors the report shows seconds later
 * (no "gauge whiplash").
 *
 * Geometry (identical to results-screen.tsx): center 100,100 · r 88.5 ·
 * 280° sweep starting at 40° (gap at the bottom-right), 15px round-capped
 * stroke. Band label/colors mirror the results screen's mockup ramp.
 *
 * Server-safe: no "use client", no hooks — usable from RSCs and client
 * components alike (per the RSC rule, helpers must NOT live in kit.tsx).
 */

import { bandFor } from "@/lib/scan/score-bands";

const CX = 100, CY = 100, R = 88.5, START = 40, SWEEP = 280;

function pt(deg: number) {
  const r = (deg * Math.PI) / 180;
  return [CX + R * Math.cos(r), CY + R * Math.sin(r)] as const;
}

function arc(fromDeg: number, toDeg: number) {
  const [x1, y1] = pt(fromDeg);
  const [x2, y2] = pt(toDeg);
  const large = toDeg - fromDeg > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/**
 * Band → {label, fg, bg} for the gauge hero. Labels come from SCORE_BANDS
 * (single source of truth — the long conversion variant where one exists);
 * fg/bg keep the exact mockup hex ramp so the shipped visuals don't move.
 * FOLLOW-UP: unify fg onto the --c-band-* tokens (needs a render-diff pass).
 */
const GAUGE_VIZ: Record<string, { fg: string; bg: string }> = {
  invisible: { fg: "#E5484D", bg: "var(--c-tint-red)" },
  hard: { fg: "#E0731C", bg: "var(--c-tint-orange)" },
  fair: { fg: "#C98A12", bg: "var(--c-tint-amber)" },
  findable: { fg: "#1F9D5B", bg: "var(--c-tint-green)" },
  high: { fg: "#0E7A48", bg: "var(--c-tint-green)" },
};
export function gaugeBand(score: number) {
  const b = bandFor(score);
  const viz = GAUGE_VIZ[b.key] ?? { fg: "#C98A12", bg: "var(--c-tint-amber)" };
  return { label: b.longLabel ?? b.label, fg: viz.fg, bg: viz.bg };
}

export function ScoreGauge({
  score,
  size = 200,
  showBand = true,
  sub,
}: {
  score: number;
  /** Rendered square size in px (viewBox stays 200×200 → identical geometry). */
  size?: number;
  /** Show the band-label chip under the dial. */
  showBand?: boolean;
  /** Optional caption under the band chip. */
  sub?: string;
}) {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  const band = gaugeBand(s);
  const frac = s / 100;
  const track = arc(START, START + SWEEP);
  const fill = arc(START, START + SWEEP * Math.max(0.001, frac));

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        style={{ display: "block", ["viewTransitionName" as string]: "score-circle" }}
        role="img"
        aria-label={`Discoverability score ${s} of 100 — ${band.label}`}
      >
        <path d={track} fill="none" stroke="var(--c-fill)" strokeWidth="15" strokeLinecap="round" />
        {s > 0 && <path d={fill} fill="none" stroke={band.fg} strokeWidth="15" strokeLinecap="round" />}
        <text x="100" y="107.2" textAnchor="middle" style={{ font: "700 40px var(--font-mono), monospace", fill: "var(--c-ink)" }}>{s}</text>
        <text x="100" y="126.2" textAnchor="middle" style={{ font: "600 11px var(--font-mono), monospace", fill: "var(--c-faint)", letterSpacing: 1 }}>/ 100</text>
      </svg>
      {showBand && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: band.bg, color: band.fg, fontWeight: 700, fontSize: 13, padding: "5px 13px", borderRadius: 8, marginTop: 8, fontFamily: "var(--font-display)" }}>
          {band.label}
        </div>
      )}
      {sub && <div style={{ fontSize: 12, color: "var(--c-faint)", marginTop: 8, fontFamily: "var(--font-sans)" }}>{sub}</div>}
    </div>
  );
}
