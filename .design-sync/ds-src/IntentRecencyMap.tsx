/* @mirrors components/app/intel/intent-recency-map.tsx */
import * as React from "react";

/**
 * IntentRecencyMap — "where they hang out": a canvas dot-plot of buyer
 * threads, x = buyer intent (low ← → high), y = a gentle jitter purely to
 * separate overlapping dots (a beeswarm), colour = surface, a ring marks
 * high-intent (>= .8) threads. Clicking a dot opens that thread in the
 * EvidenceDrawer. Recency (thread `publishedAt`) is NOT plotted — it's
 * unavailable for the vast majority of the Reddit-scoped demand set (Reddit
 * 403s server-side, DataForSEO SERP returns no timestamps), so a recency
 * axis piled almost every dot into one degenerate column. Where a date IS
 * known it still surfaces in the evidence drawer, just not on the map.
 *
 * The live component draws to a real `<canvas>` (devicePixelRatio-aware,
 * redrawn on resize + theme change) — the Claude Design sandbox pre-renders
 * every card to STATIC markup (`renderToStaticMarkup`, no client JS runs),
 * so a `<canvas>` here would paint nothing. This mirror instead renders a
 * representative static SVG of the same plot (fixed sample points, no
 * interactivity) so the card is visually honest about what the map looks
 * like, plus the same axis captions + surface legend as the live component.
 */
const PALETTE = ["#6E56F7", "#1f9d5b", "#e0731c", "#3b6fe0", "#c98a12", "#e5484d"];

// Fixed sample points laid out as a beeswarm along the intent axis (x),
// mirroring the live component's bin-and-stack jitter — dots cluster near
// their true intent value and fan out vertically only to avoid overlap.
const SAMPLE: { x: number; y: number; r: number; high: boolean; colour: string; surface: string }[] = [
  { x: 60, y: 50, r: 4, high: false, colour: PALETTE[0], surface: "r/SaaS" },
  { x: 95, y: 36, r: 4, high: false, colour: PALETTE[1], surface: "r/startups" },
  { x: 95, y: 64, r: 4, high: false, colour: PALETTE[2], surface: "r/Entrepreneur" },
  { x: 150, y: 50, r: 4, high: false, colour: PALETTE[3], surface: "r/marketing" },
  { x: 230, y: 44, r: 4, high: false, colour: PALETTE[0], surface: "r/SaaS" },
  { x: 260, y: 50, r: 6, high: true, colour: PALETTE[1], surface: "r/startups" },
  { x: 260, y: 68, r: 4, high: false, colour: PALETTE[2], surface: "r/Entrepreneur" },
  { x: 300, y: 50, r: 6, high: true, colour: PALETTE[0], surface: "r/SaaS" },
];

const SURFACES = ["r/SaaS", "r/startups", "r/Entrepreneur", "r/marketing"];
const COLOUR_FOR: Record<string, string> = { "r/SaaS": PALETTE[0], "r/startups": PALETTE[1], "r/Entrepreneur": PALETTE[2], "r/marketing": PALETTE[3] };

export function IntentRecencyMap() {
  const W = 340, H = 100, PAD = 10;
  return (
    <div>
      <div style={{ position: "relative", width: "100%", border: "1px solid var(--c-line)", borderRadius: "var(--radius-lg)", background: "var(--c-surface)" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ display: "block", width: "100%", height: "auto" }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <line key={`v${i}`} x1={PAD + ((W - PAD * 2) * i) / 4} y1={PAD} x2={PAD + ((W - PAD * 2) * i) / 4} y2={H - PAD} stroke="var(--c-line)" strokeWidth={1} />
          ))}
          <line x1={PAD} y1={H / 2} x2={W - PAD} y2={H / 2} stroke="var(--c-line)" strokeWidth={1} />
          {SAMPLE.map((p, i) => (
            <g key={i}>
              {p.high && <circle cx={p.x} cy={p.y} r={p.r + 3} fill="none" stroke={p.colour} strokeWidth={1.5} />}
              <circle cx={p.x} cy={p.y} r={p.r} fill={p.colour} stroke="var(--c-surface)" strokeWidth={1} />
            </g>
          ))}
        </svg>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--c-faint)", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        <span>lower intent</span>
        <span>higher intent →</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 10 }}>
        {SURFACES.map((s) => (
          <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--c-muted)" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: COLOUR_FOR[s], flexShrink: 0 }} />
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
