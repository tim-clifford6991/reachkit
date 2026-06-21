"use client";

/**
 * EaseImpactScatter — the distribution playbook plotted on an Ease × Impact grid
 * (ChannelIntel UX). Each play is a point at (ease, impact); the dot size encodes
 * the composite score (impact × ease × (1−competition)) and colour encodes kind.
 * Quadrants make prioritization scannable at a glance — "quick wins" land top-right.
 *
 * Client component: hover/focus shows a tooltip; clicking a dot expands a detail
 * card below the chart, and the legend doubles as a per-kind filter. Pure inline
 * SVG (no chart library); square viewBox keeps dots circular.
 */

import { useState } from "react";
import type { PlanItem } from "@/lib/scan/gap";
import { quadrantOf } from "@/lib/scan/gap/quadrant";

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
  const [selected, setSelected] = useState<number | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  if (items.length === 0) return null;

  const kinds = Array.from(new Set(items.map((i) => i.kind)));
  const pts = items.map((it, i) => ({
    it,
    i,
    x: mapX(it.ease),
    y: mapY(it.impact),
    r: 1.8 + it.score * 3.5,
    shown: !hidden.has(it.kind),
  }));
  const active = hover != null ? pts.find((p) => p.i === hover) ?? null : null;
  const chosen = selected != null ? pts.find((p) => p.i === selected) ?? null : null;

  const toggleSelect = (i: number) => setSelected((s) => (s === i ? null : i));
  const toggleKind = (k: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      // Never filter everything out — toggling the last visible kind resets.
      return next.size >= kinds.length ? new Set() : next;
    });

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
          {[...pts].sort((a, b) => b.r - a.r).map((p) => {
            const isSel = selected === p.i;
            return (
              <circle
                key={p.i}
                cx={p.x}
                cy={p.y}
                r={p.r}
                fill={colorFor(p.it.kind)}
                fillOpacity={!p.shown ? 0.1 : hover === p.i || isSel ? 0.95 : 0.6}
                stroke={colorFor(p.it.kind)}
                strokeWidth={isSel ? 1.4 : hover === p.i ? 0.9 : 0}
                tabIndex={p.shown ? 0 : -1}
                role="button"
                aria-pressed={isSel}
                aria-label={`${p.it.title}: impact ${Math.round(p.it.impact * 100)}, ease ${Math.round(p.it.ease * 100)}, competition ${Math.round(p.it.competition * 100)}`}
                onMouseEnter={() => p.shown && setHover(p.i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => p.shown && setHover(p.i)}
                onBlur={() => setHover(null)}
                onClick={() => p.shown && toggleSelect(p.i)}
                onKeyDown={(e) => {
                  if (p.shown && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    toggleSelect(p.i);
                  }
                }}
                style={{ cursor: p.shown ? "pointer" : "default", pointerEvents: p.shown ? "auto" : "none" }}
              />
            );
          })}
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

      {/* legend — doubles as a per-kind filter (click to toggle) */}
      <div className="mt-3 flex flex-wrap justify-center gap-x-2 gap-y-1">
        {kinds.map((k) => {
          const off = hidden.has(k);
          return (
            <button
              key={k}
              type="button"
              onClick={() => toggleKind(k)}
              aria-pressed={!off}
              className="flex items-center gap-1.5 rounded-full px-1.5 py-0.5 font-mono text-[10px] transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              style={{ color: "var(--color-muted)", opacity: off ? 0.4 : 1, textDecoration: off ? "line-through" : "none" }}
            >
              <span className="size-2 rounded-full" style={{ background: colorFor(k) }} />
              {KIND_LABEL[k] ?? k}
            </button>
          );
        })}
      </div>

      {/* selected detail card — click a dot to expand */}
      {chosen && (
        <div className="mt-3 rounded-lg border px-4 py-3" style={{ borderColor: "var(--hairline)", background: "var(--fill-subtle)" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="size-2 shrink-0 rounded-full" style={{ background: colorFor(chosen.it.kind) }} />
                <p className="truncate text-sm font-medium" style={{ color: "var(--color-fg)" }}>{chosen.it.title}</p>
              </div>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--color-accent-400)" }}>
                {quadrantOf(chosen.it.ease, chosen.it.impact)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="Close play detail"
              className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          {chosen.it.why && (
            <p className="mt-1.5 text-xs leading-relaxed" style={{ color: "var(--color-muted)" }}>{chosen.it.why}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] tabular-nums" style={{ color: "var(--color-muted)" }}>
            <span>Impact {Math.round(chosen.it.impact * 100)}</span>
            <span>Ease {Math.round(chosen.it.ease * 100)}</span>
            <span>Competition {Math.round(chosen.it.competition * 100)}</span>
            <span style={{ color: "var(--color-fg)" }}>Score {Math.round(chosen.it.score * 100)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
