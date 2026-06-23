/**
 * HeroScanDemo — the hero proof panel (§22.1), rebuilt 1:1 to the Claude Design
 * mockup (ReachKit.dc.html): a WIDE browser-framed scan-result card sitting
 * below the centered hero copy. Browser chrome → a 280° gauge on the left,
 * pillar bars + the #1 ranked fix on the right.
 *
 * Static, server-rendered, zero client JS above the fold. Entrance is pure CSS
 * (reduced-motion-safe; base styles are the final state). Illustrative sample —
 * clearly framed as a preview, not a claim about a real customer.
 */

import { bandFor } from "@/lib/scan/score-bands";

const SCORE = 47;
const band = bandFor(SCORE); // 47 → "Hard to find" (orange)

// 280° arc geometry (opening at the bottom), matching DiscoverabilityScore.
const R = 70;
const CX = 90;
const CY = 90;
const START = 220;
const SWEEP = 280;
function polar(r: number, deg: number) {
  const rad = (deg - 90) * (Math.PI / 180);
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}
function arc(deg0: number, deg1: number) {
  const a = polar(R, deg0);
  const b = polar(R, deg1);
  const large = deg1 - deg0 > 180 ? 1 : 0;
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}
const TRACK = arc(START, START + SWEEP);
const FILL = arc(START, START + SWEEP * (SCORE / 100));

const PILLARS = [
  { label: "Content", value: 56 },
  { label: "Outreach", value: 29 },
  { label: "SEO", value: 54 },
] as const;

export function HeroScanDemo() {
  return (
    <div
      className="reachkit-hero-demo relative w-full max-w-3xl overflow-hidden rounded-2xl border"
      style={{
        borderColor: "var(--hairline)",
        background: "var(--color-surface)",
        boxShadow: "var(--elevation-xl),var(--edge-highlight)",
      }}
      role="img"
      aria-label="Sample ReachKit report: a Discoverability Score of 47 out of 100 — Hard to find — with pillar sub-scores and the top ranked fix."
    >
      {/* Browser chrome */}
      <div
        className="flex items-center gap-2 border-b px-4 py-2.5"
        style={{ borderColor: "var(--hairline)", background: "var(--color-elevated)" }}
      >
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full" style={{ background: "oklch(0.72 0.16 25)" }} />
          <span className="size-2.5 rounded-full" style={{ background: "oklch(0.82 0.13 80)" }} />
          <span className="size-2.5 rounded-full" style={{ background: "oklch(0.78 0.13 150)" }} />
        </span>
        <span
          className="ml-2 truncate rounded-md px-2.5 py-1 font-mono text-[11px]"
          style={{ background: "var(--fill-subtle)", color: "var(--color-muted)" }}
        >
          app.reachkit.io/report/bloom.io
        </span>
      </div>

      {/* Body */}
      <div className="grid items-center gap-6 p-6 sm:grid-cols-[auto_1fr] sm:gap-8 sm:p-8">
        {/* Gauge */}
        <div className="flex flex-col items-center">
          <div className="relative size-[180px]">
            <svg width="180" height="180" viewBox="0 0 180 180" aria-hidden>
              <path d={TRACK} fill="none" stroke="var(--hairline)" strokeWidth="11" strokeLinecap="round" />
              <path
                className="reachkit-hero-demo-arc"
                d={FILL}
                fill="none"
                stroke={band.color}
                strokeWidth="11"
                strokeLinecap="round"
                pathLength={1}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className="font-mono font-semibold leading-none tabular-nums"
                style={{ fontSize: "2.75rem", color: band.color }}
              >
                {SCORE}
              </span>
              <span className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                / 100
              </span>
            </div>
          </div>
          <span
            className="mt-1 rounded-full px-3 py-1 text-xs font-semibold"
            style={{ background: `color-mix(in oklch, ${band.color} 14%, transparent)`, color: band.color }}
          >
            {band.label}
          </span>
        </div>

        {/* Pillars + top fix */}
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Discoverability Score
          </p>
          <div className="mt-3 space-y-3">
            {PILLARS.map((p, i) => (
              <div key={p.label} className="flex items-center gap-3">
                <span className="w-16 shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {p.label}
                </span>
                <span className="relative h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--hairline)" }}>
                  <span
                    className="reachkit-hero-demo-bar absolute inset-y-0 left-0 rounded-full"
                    style={{ width: `${p.value}%`, background: bandFor(p.value).color, ["--bar-w" as string]: `${p.value}%`, ["--bar-i" as string]: i }}
                  />
                </span>
                <span className="w-6 text-right font-mono text-xs tabular-nums" style={{ color: "var(--color-fg)" }}>
                  {p.value}
                </span>
              </div>
            ))}
          </div>

          {/* #1 ranked fix */}
          <div
            className="reachkit-hero-demo-fix mt-5 flex items-center gap-3 rounded-xl border p-3"
            style={{ borderColor: "var(--hairline)", background: "var(--fill-subtle)" }}
          >
            <span
              className="grid size-7 shrink-0 place-items-center rounded-lg font-mono text-xs font-bold"
              style={{ background: "var(--color-accent-subtle)", color: "var(--color-accent-400)" }}
            >
              1
            </span>
            <span className="flex-1 text-[13px] font-medium leading-snug" style={{ color: "var(--color-fg)" }}>
              Publish 3 “vs competitor” comparison pages
            </span>
            <span
              className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums"
              style={{ background: "var(--color-success-subtle)", color: "var(--color-success)" }}
            >
              +6
            </span>
          </div>
        </div>
      </div>

      {/* CSS-only entrance — reduced-motion-safe (base styles are final state) */}
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .reachkit-hero-demo-arc {
            stroke-dasharray: 1;
            animation: reachkit-hero-arc 1.3s cubic-bezier(0.25, 0, 0, 1) 0.2s both;
          }
          .reachkit-hero-demo-bar {
            animation: reachkit-hero-bar 0.8s cubic-bezier(0.25, 0, 0, 1) both;
            animation-delay: calc(0.5s + var(--bar-i) * 0.12s);
          }
          .reachkit-hero-demo-fix {
            animation: reachkit-hero-fix 0.6s cubic-bezier(0.25, 0, 0, 1) 0.9s both;
          }
          @keyframes reachkit-hero-arc {
            from { stroke-dashoffset: 1; }
            to   { stroke-dashoffset: 0; }
          }
          @keyframes reachkit-hero-bar {
            from { width: 0%; }
            to   { width: var(--bar-w); }
          }
          @keyframes reachkit-hero-fix {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        }
      `}</style>
    </div>
  );
}
