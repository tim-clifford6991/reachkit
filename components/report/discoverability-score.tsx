"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { NumberTicker } from "@/components/motion/number-ticker";
import type { VerifiedScore, RadarAxis } from "@/lib/scan/score-full";
import { bandFor } from "@/lib/scan/score-bands";

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * DiscoverabilityScore — The signature centrepiece visual (§20.3 rule 5)
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────┐
 *   │  [Radial progress ring + score number]           │
 *   │  [7-axis SVG radar — 3 active, 4 locked/grey]    │
 *   │  [3 subscore bars: Content / Outreach / SEO]     │
 *   └──────────────────────────────────────────────────┘
 *
 * Reduced-motion:
 *   - No sweep animation on the radial ring (renders at final dash-offset)
 *   - No count-up in NumberTicker (deferred to that component's own guard)
 *   - No stagger on subscores
 *
 * View Transitions:
 *   The outer ring element carries view-transition-name="score-circle" so
 *   the shared-element morph works when navigating from scan → report.
 *   Convention: this is the ONLY component that owns this VT name. E2/E3
 *   pages must render <DiscoverabilityScore> (not a clone) to get the morph.
 *
 * Props:
 *   score — a VerifiedScore from lib/scan/score-full.ts
 *   size  — "sm" (compact, for scan-in-progress) | "lg" (default, report page)
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Radial ring dimensions (same for sm / lg — we scale via CSS) */
const RING_SIZE = 200;
const RING_CX   = RING_SIZE / 2;
const RING_CY   = RING_SIZE / 2;
const RING_R    = 78;

/** Radar polygon dimensions */
const RADAR_SIZE   = 260;
const RADAR_CX     = RADAR_SIZE / 2;
const RADAR_CY     = RADAR_SIZE / 2;
const RADAR_RADIUS = 90; // max polygon radius

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert polar (radius, angle in degrees, cx, cy) → {x, y} */
function polar(r: number, deg: number, cx: number, cy: number) {
  const rad = (deg - 90) * (Math.PI / 180); // -90° so 0° is top
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

/** Build a polygon points string from {x,y}[] */
function toPoints(pts: { x: number; y: number }[]): string {
  return pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

/**
 * Build an SVG arc path from startDeg→endDeg (deg measured clockwise from top,
 * matching `polar`). Used for the speedometer-style gauge.
 */
function arcPath(r: number, startDeg: number, endDeg: number, cx: number, cy: number) {
  const start = polar(r, startDeg, cx, cy);
  const end = polar(r, endDeg, cx, cy);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  // sweep-flag 1 = clockwise (increasing deg), matching `polar`'s orientation.
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

/** Gauge geometry: a 280° arc opening at the bottom (per ReachKit.dc.html). */
const GAUGE_START = 220;
const GAUGE_SWEEP = 280;

// Band label + ring colour now come from the canonical lib/scan/score-bands.

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Radial progress ring with optional sweep animation */
function RadialRing({
  total,
  animate,
  size = "lg",
}: {
  total: number;
  animate: boolean;
  size?: "sm" | "lg";
}) {
  const fraction = Math.max(0, Math.min(1, total / 100));
  const colour   = bandFor(total).color;
  const ringSize = size === "sm" ? 140 : 200;
  const stroke   = size === "sm" ? 8 : 10;
  const d = arcPath(RING_R, GAUGE_START, GAUGE_START + GAUGE_SWEEP, RING_CX, RING_CY);

  return (
    <svg
      width={ringSize}
      height={ringSize}
      viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
      aria-hidden="true"
      /*
       * View Transitions shared-element: score-circle.
       * Convention documented in globals.css — do not add this name elsewhere.
       */
      style={{ viewTransitionName: "score-circle" } as React.CSSProperties}
    >
      {/* Track arc */}
      <path
        d={d}
        fill="none"
        stroke="var(--hairline)"
        strokeWidth={stroke}
        strokeLinecap="round"
      />
      {/* Filled arc — reveals `fraction` of the 280° sweep from the start. */}
      <motion.path
        d={d}
        fill="none"
        stroke={colour}
        strokeWidth={stroke}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={1}
        initial={{ strokeDashoffset: 1 }}
        animate={{ strokeDashoffset: 1 - fraction }}
        transition={
          animate
            ? { duration: 1.2, ease: [0.25, 0, 0, 1], delay: 0.2 }
            : { duration: 0 }
        }
      />
    </svg>
  );
}

/** 7-axis radar chart — pure SVG, no recharts dependency */
function RadarChart({ axes, animate }: { axes: RadarAxis[]; animate: boolean }) {
  const n = axes.length;
  if (n === 0) return null;

  const angleStep = 360 / n;

  // Grid rings: 3 concentric (25%, 50%, 75%)
  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  // Axis endpoints
  const axisPoints = axes.map((_, i) =>
    polar(RADAR_RADIUS, i * angleStep, RADAR_CX, RADAR_CY)
  );

  // Active polygon — only ASSESSED axes contribute. An active-but-unmeasured axis
  // (content/outreach on a first scan) sits at 0 like the locked ones, so the
  // polygon reflects what we actually verified rather than penalising un-measurement.
  const activePoints = axes.map((ax, i) => {
    const r = ax.active && ax.assessed ? (ax.value / 100) * RADAR_RADIUS : 0;
    return polar(r, i * angleStep, RADAR_CX, RADAR_CY);
  });

  // Full-scale polygon outline for locked axes (so locked slots are visible as grey)
  const fullPoints = axes.map((_, i) =>
    polar(RADAR_RADIUS * 0.6, i * angleStep, RADAR_CX, RADAR_CY)
  );

  return (
    <svg
      width={RADAR_SIZE}
      height={RADAR_SIZE}
      viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`}
      aria-hidden="true"
    >
      {/* Grid rings */}
      {gridLevels.map((level) => {
        const pts = axes.map((_, i) =>
          polar(RADAR_RADIUS * level, i * angleStep, RADAR_CX, RADAR_CY)
        );
        return (
          <polygon
            key={level}
            points={toPoints(pts)}
            fill="none"
            stroke="var(--fill-subtle)"
            strokeWidth={1}
          />
        );
      })}

      {/* Axis spokes */}
      {axisPoints.map((pt, i) => (
        <line
          key={i}
          x1={RADAR_CX}
          y1={RADAR_CY}
          x2={pt.x}
          y2={pt.y}
          stroke="var(--hairline)"
          strokeWidth={1}
        />
      ))}

      {/* Locked axes grey fill (shows the "potential" the active axes don't fill) */}
      <polygon
        points={toPoints(fullPoints)}
        fill="var(--fill-subtle)"
        stroke="var(--fill-subtle)"
        strokeWidth={1}
        strokeDasharray="3 3"
      />

      {/* Active data polygon */}
      {animate ? (
        <motion.polygon
          points={toPoints(activePoints)}
          fill="var(--color-accent-subtle)"
          stroke="var(--color-accent)"
          strokeWidth={1.5}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.4, ease: [0.25, 0, 0, 1] }}
          style={{ transformOrigin: `${RADAR_CX}px ${RADAR_CY}px` }}
        />
      ) : (
        <polygon
          points={toPoints(activePoints)}
          fill="var(--color-accent-subtle)"
          stroke="var(--color-accent)"
          strokeWidth={1.5}
        />
      )}

      {/* Axis dots + labels */}
      {axes.map((ax, i) => {
        const dot  = axisPoints[i] ?? { x: RADAR_CX, y: RADAR_CY };
        // Labels slightly outside the dots
        const label = polar(
          RADAR_RADIUS + 18,
          i * angleStep,
          RADAR_CX,
          RADAR_CY
        );
        const textAnchor =
          Math.abs(label.x - RADAR_CX) < 4
            ? "middle"
            : label.x < RADAR_CX
            ? "end"
            : "start";

        return (
          <g key={ax.axis}>
            <circle
              cx={dot.x}
              cy={dot.y}
              r={2.5}
              fill={ax.assessed ? "var(--color-accent)" : "var(--hairline-strong)"}
            />
            <text
              x={label.x}
              y={label.y}
              textAnchor={textAnchor}
              dominantBaseline="middle"
              fontSize={9}
              fontFamily="var(--font-mono)"
              fill={ax.assessed ? "var(--color-fg)" : "var(--color-muted)"}
            >
              {ax.axis}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Single subscore row */
function SubScoreRow({
  label,
  value,
  assessed = true,
  animate,
  delay,
}: {
  label: string;
  value: number;
  assessed?: boolean;
  animate: boolean;
  delay: number;
}) {
  // An axis we didn't measure this scan reads as "not measured" — never a 0 bar
  // (which would wrongly imply the surface is empty, e.g. Stripe's content/outreach).
  if (!assessed) {
    return (
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="flex-1 font-mono text-[10px] italic text-muted-foreground/70">
          not measured in free scan
        </span>
      </div>
    );
  }
  // Tie each pillar bar to the same band ramp as the score itself.
  const colour = bandFor(value).color;

  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-[var(--hairline)]">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: colour }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={
            animate
              ? { duration: 0.7, delay, ease: [0.25, 0, 0, 1] }
              : { duration: 0 }
          }
        />
      </div>
      <span
        className="w-7 text-right font-mono text-xs tabular-nums text-foreground"
        aria-hidden="true"
      >
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export interface DiscoverabilityScoreProps {
  score: VerifiedScore;
  size?: "sm" | "lg";
  className?: string;
  /**
   * Score change vs the previous scan. `undefined` hides the row (callers that
   * don't have history), `null` shows a "Baseline" tag (first scan), a number
   * shows a direction-colored delta badge.
   */
  delta?: number | null;
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) {
    return (
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Baseline
      </span>
    );
  }
  if (delta === 0) {
    return <span className="text-xs text-muted-foreground">No change since last scan</span>;
  }
  const up = delta > 0;
  return (
    <span
      className="text-xs font-medium tabular-nums"
      style={{ color: up ? "var(--color-success)" : "var(--color-danger)" }}
    >
      {up ? "▲ +" : "▼ −"}
      {Math.abs(delta)} since last scan
    </span>
  );
}

export function DiscoverabilityScore({
  score,
  size = "lg",
  className,
  delta,
}: DiscoverabilityScoreProps) {
  const prefersReduced = useReducedMotion();
  const shouldAnimate  = !prefersReduced;
  const band = bandFor(score.total);
  const label = band.label;
  const assessedFor = (axis: string) =>
    score.radar.find((a) => a.axis === axis)?.assessed ?? true;

  return (
    <div
      data-slot="discoverability-score"
      data-size={size}
      className={[
        "flex flex-col items-center gap-6",
        size === "sm" ? "gap-4" : "gap-6",
        className ?? "",
      ].join(" ")}
      role="region"
      aria-label={`Discoverability score: ${score.total} out of 100 — ${label}`}
    >
      {/* ── Radial ring + score number ─────────────────────────────────── */}
      <div className="relative flex items-center justify-center">
        <RadialRing total={score.total} animate={shouldAnimate} size={size} />

        {/* Score number centred inside the ring */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-mono font-semibold leading-none tabular-nums"
            style={{
              fontSize: size === "sm" ? "1.75rem" : "2.5rem",
              color: band.color,
            }}
          >
            <NumberTicker value={score.total} />
          </span>
          <span
            className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
            aria-hidden="true"
          >
            /100
          </span>
        </div>
      </div>

      {/* Band label (plain English, band-colored) + delta */}
      <div className="space-y-1 text-center">
        <p className="text-sm font-medium" style={{ color: band.color }}>
          {label}
        </p>
        {delta !== undefined && <DeltaBadge delta={delta} />}
      </div>

      {/* ── Radar chart (only in lg) ────────────────────────────────────── */}
      {size === "lg" && (
        <div className="opacity-90">
          <RadarChart axes={score.radar} animate={shouldAnimate} />
        </div>
      )}

      {/* ── Subscore breakdown bars ──────────────────────────────────────── */}
      <div className="w-full max-w-[220px] space-y-2">
        <SubScoreRow
          label="Content"
          value={score.breakdown.content}
          assessed={assessedFor("Content")}
          animate={shouldAnimate}
          delay={0.3}
        />
        <SubScoreRow
          label="Outreach"
          value={score.breakdown.outreach}
          assessed={assessedFor("Outreach")}
          animate={shouldAnimate}
          delay={0.5}
        />
        <SubScoreRow
          label="SEO"
          value={score.breakdown.seo}
          assessed={assessedFor("SEO/ASO")}
          animate={shouldAnimate}
          delay={0.7}
        />
      </div>

      {/* Basis badge */}
      <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">
        {score.basis} score
      </p>
    </div>
  );
}
