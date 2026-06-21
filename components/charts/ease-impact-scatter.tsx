"use client";

/**
 * EaseImpactScatter — the distribution playbook plotted on an Ease × Impact grid
 * (ChannelIntel UX). Each play is a point at (ease, impact); the dot size encodes
 * the composite score (impact × ease × (1−competition)) and colour encodes kind.
 * Quadrants make prioritization scannable at a glance — "quick wins" land top-right.
 *
 * Client component: hover/focus reveals a tooltip with the play's title + triad.
 * Pure inline SVG (no chart library); square viewBox keeps dots circular.
 */

import { useState } from "react";
import type { PlanItem } from "@/lib/scan/gap";

const KIND_COLOR: Record<string, string> = {
  channel: "var(--color-accent-400)",
  seo: "var(--color-success)",
  community: "var(--chart-2)",
  demand: "var(--chart-3)",
};
const KIND_LABEL: Record<string, string> = {
  channel: "Channel",
  seo: "SEO",
  community: "Community",
  demand: "Demand",
};
const colorFor = (k: string) => KIND_COLOR[k] ?? "var(--color-accent-400)";

// Plot region inside the 0..100 viewBox (margin leaves room for quadrant labels).
const MIN = 14;
const MAX = 94;
const MID = (MIN + MAX) / 2;
const span = MAX - MIN;
const mapX = (ease: number) => MIN + ease * span;
const mapY = (impact: number) => MAX - impact * span; // invert: high impact = top

export function EaseImpactScatter({ items }: { items: PlanItem[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (items.length === 0) return null;

  const pts = items.map((it, i) => ({
    it,
    i,
    x: mapX(it.ease),
    y: mapY(it.impact),
    r: 1.8 + it.score * 3.5,
  }));
  const active = hover != null ? pts.find((p) => p.i === hover) ?? null : null;
  const kinds = Array.from(new Set(items.map((i) => i.kind)));

  return (
    <div className="mb-4">
      <div className="relative mx-auto aspect-square w-full max-w-[320px]">
        <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-label="Plays plotted by ease and impact">
          {/* frame + quadrant guides */}
          <rect x={MIN} y={MIN} width={span} height={span} fill="none" stroke="var(--hairline)" strokeWidth={0.4} />
          <line x1={MIN} y1={MID} x2={MAX} y2={MID} stroke="var(--hairline)" strokeWidth={0.4} />
          <line x1={MID} y1={MIN} x2={MID} y2={MAX} stroke="var(--hairline)" strokeWidth={0.4} />

          {/* quadrant labels */}
          <text x={MAX - 1} y={MIN + 3.5} textAnchor="end" fontSize={3} fontFamily="var(--font-mono)" fill="var(--color-muted)">QUICK WINS</text>
          <text x={MIN + 1} y={MIN + 3.5} textAnchor="start" fontSize={3} fontFamily="var(--font-mono)" fill="var(--color-muted)">BIG BETS</text>
          <text x={MAX - 1} y={MAX - 1.5} textAnchor="end" fontSize={3} fontFamily="var(--font-mono)" fill="var(--color-muted)">FILL-INS</text>
          <text x={MIN + 1} y={MAX - 1.5} textAnchor="start" fontSize={3} fontFamily="var(--font-mono)" fill="var(--color-muted)">LOW PRIORITY</text>

          {/* axis hints */}
          <text x={MID} y={99} textAnchor="middle" fontSize={3} fontFamily="var(--font-mono)" fill="var(--color-muted)">EASE →</text>
          <text x={3.5} y={MID} textAnchor="middle" fontSize={3} fontFamily="var(--font-mono)" fill="var(--color-muted)" transform={`rotate(-90 3.5 ${MID})`}>IMPACT →</text>

          {/* points (largest first so small dots stay clickable on top) */}
          {[...pts].sort((a, b) => b.r - a.r).map((p) => (
            <circle
              key={p.i}
              cx={p.x}
              cy={p.y}
              r={p.r}
              fill={colorFor(p.it.kind)}
              fillOpacity={hover === p.i ? 0.95 : 0.6}
              stroke={colorFor(p.it.kind)}
              strokeWidth={hover === p.i ? 0.9 : 0}
              tabIndex={0}
              role="button"
              aria-label={`${p.it.title}: impact ${Math.round(p.it.impact * 100)}, ease ${Math.round(p.it.ease * 100)}, competition ${Math.round(p.it.competition * 100)}`}
              onMouseEnter={() => setHover(p.i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(p.i)}
              onBlur={() => setHover(null)}
              style={{ cursor: "pointer" }}
            />
          ))}
        </svg>

        {/* tooltip — positioned over the hovered point (viewBox unit == container %) */}
        {active && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border px-2.5 py-1.5 shadow-[var(--elevation-sm)]"
            style={{ left: `${active.x}%`, top: `${active.y}%`, marginTop: "-6px", borderColor: "var(--hairline)", background: "var(--color-elevated)" }}
          >
            <p className="whitespace-nowrap text-xs font-medium" style={{ color: "var(--color-fg)" }}>{active.it.title}</p>
            <p className="mt-0.5 font-mono text-[10px] tabular-nums" style={{ color: "var(--color-muted)" }}>
              Impact {Math.round(active.it.impact * 100)} · Ease {Math.round(active.it.ease * 100)} · Comp {Math.round(active.it.competition * 100)}
            </p>
          </div>
        )}
      </div>

      {/* legend */}
      <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1">
        {kinds.map((k) => (
          <span key={k} className="flex items-center gap-1.5 font-mono text-[10px]" style={{ color: "var(--color-muted)" }}>
            <span className="size-2 rounded-full" style={{ background: colorFor(k) }} />
            {KIND_LABEL[k] ?? k}
          </span>
        ))}
      </div>
    </div>
  );
}
