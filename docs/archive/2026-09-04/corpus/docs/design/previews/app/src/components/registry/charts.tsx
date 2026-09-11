/**
 * The closed chart inventory — components.md §3, BP-018. FIVE forms, and a
 * sixth is a design-artifact approval first (§2.4). Every row is `proposed`.
 *
 * §2.4's bounds, held here:
 *   · exactly two series colours: --chart-you and --chart-rival. There is no
 *     third, and no chart prop in this file accepts a colour or a tone.
 *   · every bar and point direct-labelled (name + value) — identity is never
 *     colour-alone, and there is no legend-only mode to fall into.
 *   · one axis per chart · 2–2.5px lines · 3.5–5px endpoint dots with a
 *     --surface ring · faint gridlines at 2–3 values · tooltip on every mark.
 *   · inline SVG, hand-sized viewBoxes. No chart library.
 *
 * NUMBERS INSIDE A viewBox ARE COORDINATE SPACE, not design values —
 * tokens.md §7 states that exemption explicitly. Every stroke, fill and
 * font in here is still a named token.
 *
 * ── TWO THINGS THE OWNER'S 2026-09-02 RULING CHANGED HERE ───────────────
 *
 * 1. EVERY viewBox NOW CARRIES PADDING. The old geometry put the endpoint
 *    dot at exactly x = W and, at the series maximum, within 4 units of the
 *    top — so an outer radius of 5.5 (r 3.5 + a 2-wide --surface ring) hung
 *    outside the box and was cut by it. That is the clipped RivalSparkline
 *    the owner saw. Every plot below now insets its drawable area by more
 *    than the largest mark it can draw, so no mark can reach an edge.
 *
 * 2. NO TEXT LIVES INSIDE A viewBox ANY MORE. A viewBox scales with its
 *    container; text inside one scales with it. An 11px axis label in a
 *    640-wide viewBox rendered in a 300px column is about 5px — far under
 *    --t-floor, and unreadable rather than merely small. Marks are SVG;
 *    every label is HTML at a named size, in a grid that matches the plot's
 *    columns, and it never scales. Strokes carry `vector-effect:
 *    non-scaling-stroke` for the same reason: §2.4's 2–2.5px line weight is
 *    a rendered bound, and a scaled stroke silently leaves it.
 */
import type { ReactNode } from "react";
import { Num } from "@/components/Num";

/* ── GrowthLine ──────────────────────────────────────────────────────────
   Weekly points, each with its OWN measurement date. MUST accept a gapped
   series: an unmeasured week is a break with that week's own account
   beside it — never carried forward, never interpolated. */
export type GrowthPoint = { label: string; date: string; value: number | null };

export function GrowthLine({
  points,
  goalNote,
  startNote,
}: {
  points: readonly GrowthPoint[];
  /** The dashed goal footnote — a caller-supplied written line. */
  goalNote: ReactNode;
  startNote: ReactNode;
}) {
  const W = 640;
  const H = 180;
  /* PAD is larger than the largest mark this plot draws (a dot of r 4 with
     a 2-wide ring = an outer radius of 6), so no mark can touch an edge. */
  const PAD = 12;
  const values = points.map((p) => p.value).filter((v): v is number => v !== null);
  const max = Math.max(...values, 1);
  const x = (i: number) => PAD + (i * (W - PAD * 2)) / Math.max(points.length - 1, 1);
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);

  /* A gap is a BREAK, not an interpolation: the path restarts after every
     null, so no measured value is ever joined to one across a missing week. */
  const segments: { i: number; v: number }[][] = [];
  let current: { i: number; v: number }[] = [];
  points.forEach((p, i) => {
    if (p.value === null) {
      if (current.length) segments.push(current);
      current = [];
    } else {
      current.push({ i, v: p.value });
    }
  });
  if (current.length) segments.push(current);

  const last = points.reduce<{ i: number; v: number } | null>(
    (acc, p, i) => (p.value !== null ? { i, v: p.value } : acc),
    null,
  );

  return (
    <div className="stack-2">
      <svg className="rk-chart" viewBox={`0 0 ${W} ${H}`} role="img">
        {/* one axis, faint gridlines at three values */}
        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            x1={PAD}
            x2={W - PAD}
            y1={y(max * f)}
            y2={y(max * f)}
            stroke="var(--line)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {segments.map((seg, si) => (
          <g key={si}>
            <path
              d={`M ${seg.map((p) => `${x(p.i)} ${y(p.v)}`).join(" L ")} L ${x(
                seg[seg.length - 1].i,
              )} ${H - PAD} L ${x(seg[0].i)} ${H - PAD} Z`}
              fill="var(--chart-you)"
              fillOpacity="0.12"
            />
            <path
              d={`M ${seg.map((p) => `${x(p.i)} ${y(p.v)}`).join(" L ")}`}
              fill="none"
              stroke="var(--chart-you)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}
        {points.map((p, i) =>
          p.value === null ? (
            /* The break: a dashed --ink-3 rule, NEVER a series colour — a
               third stroke colour reads as a third series against §2.4. */
            <line
              key={p.label}
              x1={x(i)}
              x2={x(i)}
              y1={PAD}
              y2={H - PAD}
              stroke="var(--ink-3)"
              strokeWidth="1"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          ) : (
            <g key={p.label}>
              <circle
                cx={x(i)}
                cy={y(p.value)}
                r="4"
                fill="var(--chart-you)"
                stroke="var(--surface)"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
              {/* §2.4: a tooltip on EVERY mark. */}
              <title>
                {p.label} · {p.value} · {p.date}
              </title>
            </g>
          ),
        )}
      </svg>
      {/* The axis, as HTML. One column per point, so a label sits under its
          own mark; the endpoint's value rides above its own label, which is
          §4.5's "endpoint labelled" with the label out of coordinate space
          where it cannot be scaled under --t-floor. */}
      <div className="rk-chart-x">
        {points.map((p, i) => (
          <span className="rk-chart-x-cell" key={p.label}>
            {last && last.i === i ? (
              <span className="rk-chart-x-value">
                <Num>{last.v}</Num>
              </span>
            ) : null}
            <span className="rk-chart-x-label" title={p.date}>
              {p.label}
            </span>
          </span>
        ))}
      </div>
      <div className="between">
        <span className="prov">{startNote}</span>
        <span className="prov" style={{ color: "var(--chart-goal)" }}>
          {goalNote}
        </span>
      </div>
    </div>
  );
}

/** The no-measurement state: one written line carrying the first-due date,
 *  IN PLACE OF the chart. Not an empty chart, not a spinner. */
export function GrowthLineNoMeasurement({
  account,
  firstDue,
}: {
  account: string;
  firstDue: string;
}) {
  return (
    <div className="sunk stack-1">
      <p className="t-sm">{account}</p>
      <p className="prov">
        <Num>{firstDue}</Num>
      </p>
    </div>
  );
}

/* ── PresenceBars ────────────────────────────────────────────────────────
   One bar per domain, direct-labelled with name AND value. The customer is
   --chart-you; every rival is --chart-rival. `you` is a boolean, not a
   colour or a tone: a rival has no way to be rendered red. Zero for the
   customer is a MEASUREMENT — rendered, never an error. */
export type PresenceRow = { name: string; value: number; you: boolean };

export function PresenceBars({
  rows,
  max,
  provenance,
}: {
  rows: readonly PresenceRow[];
  max: number;
  provenance?: ReactNode;
}) {
  return (
    <div className="stack-2">
      {rows.map((r) => (
        <div className="stack-1" key={r.name}>
          {/* `.between` wraps, so a long domain name pushes its own value on
              to a second line instead of squeezing it into nothing. */}
          <div className="between t-xs">
            <span
              className="grow"
              style={r.you ? { color: "var(--accent)" } : { color: "var(--ink-2)" }}
            >
              {r.name}
            </span>
            <span style={{ flex: "0 0 auto" }}>
              <Num>
                {r.value}/{max}
              </Num>
            </span>
          </div>
          <div className="rk-bar-track" title={`${r.name} ${r.value}/${max}`}>
            <div
              className="rk-bar-fill"
              data-you={r.you ? "true" : "false"}
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
      {provenance ? <p className="prov">{provenance}</p> : null}
    </div>
  );
}

/* ── AiDotMatrixChart ────────────────────────────────────────────────────
   The chart form of AiDotMatrix over the SAME cell type, imported and never
   re-declared (rule 7.1: one capability, one shape). Adds the goal dots. */
export { AiDotMatrix as AiDotMatrixChartCells } from "./surfaces";

export function GoalDots({ have, goal }: { have: number; goal: number }) {
  return (
    <span className="row-tight" title={`${have} of ${goal}`}>
      {Array.from({ length: goal }, (_, i) => (
        <span
          key={i}
          className="rk-cell"
          data-state={i < have ? "cited" : "muted"}
          data-you="true"
          style={
            i >= have
              ? { borderStyle: "dashed", borderColor: "var(--chart-goal)", background: "transparent" }
              : undefined
          }
        />
      ))}
    </span>
  );
}

/* ── RivalSparkline ──────────────────────────────────────────────────────
   Per rival: name, falling series, endpoint. THE PROPS ACCEPT NO TONE AT
   ALL, so §2.5's "rival strength is neutral gray, never red" cannot be
   broken by a prop — the type has no member to break it with.

   The endpoint dot is --chart-you and that is TRANSCRIBED, not a slip:
   BUILD §4.5 reads "falling sparkline (gray, accent endpoint)". It is the
   one mark on a rival's row that carries the customer's colour, and it is
   recorded in components.md §3 so nobody later "corrects" it.

   Two arms and one gapped state:
     · absolute — used while the customer's count is 0. NEVER a ratio: §6.6,
       a division by zero reads as broken.
     · ratio — unlocks at ranked ≥ 10.
     · gapped — components.md §4 gap 6, drawn on previews/WO-035.html §2.
       Three parts, all enforced here: the break is a dashed --ink-3 rule;
       an `account` node is REQUIRED beside the row; and the state ACCEPTS
       NO DELTA BADGE — `delta` is absent from the gapped variant's type, so
       REQ-071 c13's forbidden span cannot be rendered by convention-breach.
       THE RESIZE DID NOT COST THIS: the union below is unchanged, and the
       gapped arm still has no `delta` member to pass one to.

   WHY THE ORDINARY STATE DID NOT FIT, stated once. The old row was a
   four-child no-wrap flex line — name, plot, endpoint, delta badge — with
   the plot declared `width: 100%`, so the plot was the only child that
   could give and the badge was the only child that could not. As the row
   narrowed the plot collapsed, then the badge's own text was cut inside a
   fixed-height daisyUI badge: the `was 276×` the owner read as wrongly
   sized. And the plot itself put its endpoint dot at exactly the viewBox
   edge, so the dot was already half-cut at ANY width. Both are structural,
   not cosmetic: a grid with named areas, a floored plot column, and a
   padded viewBox.
*/
type SparkBase = { name: string; series: readonly (number | null)[] };
export type RivalSparkProps =
  | (SparkBase & { arm: "absolute"; endpoint: string; delta?: string })
  | (SparkBase & { arm: "ratio"; endpoint: string; delta?: string })
  | (SparkBase & { arm: "gapped"; endpoint: string; account: string });

export function RivalSparkline(props: RivalSparkProps) {
  const { name, series } = props;
  /* 132×44 rather than 120×32: the extra twelve units are PAD on every
     side, so the drawable plot is still the 120×32 §2.4 sized by hand and
     the largest mark (r 3.5 + a 2-wide ring = an outer radius of 5.5) has
     6 units of clearance it did not have before. */
  const W = 132;
  const H = 44;
  const PAD = 6;
  const values = series.filter((v): v is number => v !== null);
  const max = Math.max(...values, 1);
  const x = (i: number) => PAD + (i * (W - PAD * 2)) / Math.max(series.length - 1, 1);
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);

  const segments: { i: number; v: number }[][] = [];
  let current: { i: number; v: number }[] = [];
  series.forEach((v, i) => {
    if (v === null) {
      if (current.length) segments.push(current);
      current = [];
    } else current.push({ i, v });
  });
  if (current.length) segments.push(current);
  const lastPoint = segments.length ? segments[segments.length - 1].slice(-1)[0] : null;

  return (
    <div className="stack-1">
      <div className="rk-spark">
        <span className="rk-spark-name">{name}</span>
        <span className="rk-spark-plot">
          <svg className="rk-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={name}>
            {segments.map((seg, si) => (
              <path
                key={si}
                d={`M ${seg.map((p) => `${x(p.i)} ${y(p.v)}`).join(" L ")}`}
                fill="none"
                stroke="var(--chart-rival)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {series.map((v, i) =>
              v === null ? (
                <line
                  key={i}
                  x1={x(i)}
                  x2={x(i)}
                  y1={PAD / 2}
                  y2={H - PAD / 2}
                  stroke="var(--ink-3)"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null,
            )}
            {/* §2.4: a tooltip on every mark. The hit target is transparent
                and sized in coordinate space; the dot itself keeps §2.4's
                3.5 radius, which the --w-spark-min floor keeps rendered. */}
            {series.map((v, i) =>
              v === null ? null : (
                <circle key={i} cx={x(i)} cy={y(v)} r="6" fill="transparent">
                  <title>
                    {name} · {v}
                  </title>
                </circle>
              ),
            )}
            {lastPoint ? (
              /* "gray, accent endpoint" — BUILD §4.5, transcribed. */
              <circle
                cx={x(lastPoint.i)}
                cy={y(lastPoint.v)}
                r="3.5"
                fill="var(--chart-you)"
                stroke="var(--surface)"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
          </svg>
        </span>
        <span className="rk-spark-value">
          <span className="rk-h3">
            <Num>{props.endpoint}</Num>
          </span>
          {props.arm === "gapped" ? null : props.delta ? (
            <span className="badge tone-ok">
              <Num>{props.delta}</Num>
            </span>
          ) : null}
        </span>
      </div>
      {props.arm === "gapped" ? (
        <p className="rk-spark-account">{props.account}</p>
      ) : null}
    </div>
  );
}

/* ── WeekStrip ───────────────────────────────────────────────────────────
   Seven days, each direct-labelled with its date through the mono utility,
   in the customer's own time zone. A day with nothing measured renders as a
   LABELLED EMPTY MARK, never a gap.

   Seven days cannot become six, so the strip takes the same rule the
   calendar grid takes, from the same --w-cell-min: seven across at and
   above --breakpoint-md, seven rows below it. The label is never dropped
   and never shrunk — see globals.css, `.rk-week`. */
export type WeekDay = {
  date: string;
  state: "done" | "today" | "to-come" | "unmeasured";
  label: string;
};

export function WeekStrip({ days }: { days: readonly WeekDay[] }) {
  return (
    <div className="rk-week">
      {days.map((d) => (
        <div className="rk-week-day" key={d.date} data-state={d.state} title={d.label}>
          <span className="prov">
            <Num>{d.date}</Num>
          </span>
          <span className="rk-week-mark" data-state={d.state} />
          <span className="explain rk-week-label">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
