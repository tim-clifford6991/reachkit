"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { NumberTicker } from "@/components/motion/number-ticker";
import type { VerifiedScore, RadarAxis } from "@/lib/scan/score-full";

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
const RING_STROKE = 6;
const RING_CIRC = 2 * Math.PI * RING_R; // ≈ 490

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

/** Score → descriptive label for screen-reader & tooltip */
function scoreLabel(total: number): string {
  if (total >= 80) return "Excellent";
  if (total >= 60) return "Good";
  if (total >= 40) return "Fair";
  if (total >= 20) return "Needs Work";
  return "Critical";
}

/** Score → ring colour */
function ringColour(total: number): string {
  if (total >= 70) return "oklch(0.72 0.17 155)"; // success green
  if (total >= 40) return "var(--color-accent)"; // accent blue
  return "oklch(0.78 0.18 70)";                    // warning amber
}

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
  const fraction = total / 100;
  const offset   = RING_CIRC * (1 - fraction);
  const colour   = ringColour(total);
  const ringSize = size === "sm" ? 140 : 200;

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
      {/* Track ring */}
      <circle
        cx={RING_CX}
        cy={RING_CY}
        r={RING_R}
        fill="none"
        stroke="var(--hairline)"
        strokeWidth={RING_STROKE}
      />
      {/* Filled ring */}
      <motion.circle
        cx={RING_CX}
        cy={RING_CY}
        r={RING_R}
        fill="none"
        stroke={colour}
        strokeWidth={RING_STROKE}
        strokeLinecap="round"
        strokeDasharray={RING_CIRC}
        initial={{ strokeDashoffset: RING_CIRC }}
        animate={{ strokeDashoffset: offset }}
        transition={
          animate
            ? { duration: 1.2, ease: [0.25, 0, 0, 1], delay: 0.2 }
            : { duration: 0 }
        }
        transform={`rotate(-90 ${RING_CX} ${RING_CY})`}
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
          fill="oklch(0.70 0.13 66 / 0.20)"
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
          fill="oklch(0.70 0.13 66 / 0.20)"
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
  const colour =
    value >= 70
      ? "oklch(0.72 0.17 155)"
      : value >= 40
      ? "var(--color-accent)"
      : "oklch(0.78 0.18 70)";

  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
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
}

export function DiscoverabilityScore({
  score,
  size = "lg",
  className,
}: DiscoverabilityScoreProps) {
  const prefersReduced = useReducedMotion();
  const shouldAnimate  = !prefersReduced;
  const label = scoreLabel(score.total);
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
              color: ringColour(score.total),
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

      {/* Score label */}
      <div className="text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
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
