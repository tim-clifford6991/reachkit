// BUILD §4.1 module 1 — the report's header card (Canvas: Report, module 1).
// The gauge under the score's own name, its band chip and the correction
// control; the three driver mini-bars; the tinted line naming the limit.
import type React from "react";
import { Badge, Btn, Card, Progress } from "@/ui/components";
import { BAND_TONE } from "@/ui/bands";
import { copy } from "@/lib/presentation/copy";
import { LIMITING_LINES, SCORE_BANDS } from "@/lib/presentation/bands";
import type { Verdict } from "@/lib/measure/verdict";
import type { Measured } from "@/lib/measure/measured";
import type { ScoreFactorName } from "@/lib/measure/score";
import type { CopyKey } from "@/lib/presentation/copy";
import { dash, Num, unmeasuredLineFor } from "./measured";

/** The factor's own name, for the `{what}` slot of the two unmeasured
 *  lines and for its own bar's label. `LIMITING_LINES` holds the
 *  *sentence* about a factor and is a different thing. */
const FACTOR_NAMES: Readonly<Record<ScoreFactorName, CopyKey>> = Object.freeze({
  foundations: "verdict.factor.foundations",
  answerability: "verdict.factor.answerability",
  presence: "verdict.factor.presence",
});

/** `score.ts`'s own tie-break order, which is the order a founder can act
 *  on them in: their own page today, their own wording next, the market's
 *  answer last. */
const FACTOR_ORDER: readonly ScoreFactorName[] = ["foundations", "answerability", "presence"];

/** The scale the header speaks in. The factors are 0–100 (`BUILD.md` §5);
 *  the artboard draws `7/10`. Both the label and the bar read this one
 *  number, so they cannot disagree. */
const TENTHS = 10;

/** The score's own scale, which the gauge sweeps and the numeral names. */
const HUNDREDTHS = 100;

/**
 * The gauge as the artboard draws it: a 270° arc open at the foot, stated
 * as its own path. It carries no `transform`: a rotation maps the shape's
 * local box and takes its axis-aligned bounds, which inflates it past the
 * viewBox even when every painted pixel is inside (layout check 2).
 */
const GAUGE = Object.freeze({
  box: 200,
  centre: 100,
  radius: 82,
  stroke: 13,
  /** Open at the foot: the arc runs from 135° clockwise for 270°. */
  startDeg: 135,
  extentDeg: 270,
});

const FULL_TURN_DEG = 360;

function polar(deg: number): readonly [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [
    GAUGE.centre + GAUGE.radius * Math.cos(rad),
    GAUGE.centre + GAUGE.radius * Math.sin(rad),
  ];
}

/** The dial's one path — track and value are drawn on the same arc, so the
 *  reading and the ground it sits on cannot disagree. */
const ARC_PATH = ((): string => {
  const [x0, y0] = polar(GAUGE.startDeg);
  const [x1, y1] = polar(GAUGE.startDeg + GAUGE.extentDeg);
  const r = GAUGE.radius;
  return `M ${x0} ${y0} A ${r} ${r} 0 1 1 ${x1} ${y1}`;
})();

/** The arc's own length, which the value's dash is a fraction of. */
const SWEEP = 2 * Math.PI * GAUGE.radius * (GAUGE.extentDeg / FULL_TURN_DEG);

/** The meaning token each band's tone is spoken in. Keyed by tone rather
 *  than by band, so `BAND_TONE` stays the one place a band's meaning is
 *  decided and the chip and the arc cannot disagree. */
const TONE_PAINT = Object.freeze({
  ok: "var(--ok)",
  warn: "var(--warn)",
  bad: "var(--bad)",
  accent: "var(--accent)",
  neutral: "var(--ink-3)",
});

// The box is stated on the element, not left to `height: auto`: an SVG is
// not covered by the preflight rule that gives an image an intrinsic
// height, and a box shorter than its drawing puts its contents outside it.
const GAUGE_SVG: React.CSSProperties = { maxWidth: "100%", display: "block" };

/** The arc's presentation values, bound to a name rather than spelled in
 *  the attribute: a literal in a JSX attribute is a voice position, and
 *  these are geometry (`chart-primitives.ts` names its own the same way). */
const ARC = Object.freeze({
  unfilled: "none",
  capRound: "round",
  track: "var(--sunk)",
  notFocusable: "false",
});

/** The score's size — the ladder's big-number rung (`--t-num-big`). */
const BIG_NUMBER: React.CSSProperties = { fontSize: "var(--t-num-big)", lineHeight: 1.1 };

/** The tinted panel the artboard draws the limiting line in: the accent
 *  ground and its own hairline, both tokens. */
const LIMIT_PANEL: React.CSSProperties = {
  background: "var(--accent-bg)",
  borderColor: "var(--accent-line)",
};

/** The eyebrow over it, in the accent ink the artboard gives it. */
const LIMIT_EYEBROW: React.CSSProperties = { color: "var(--accent)" };

/** `n/10`, composed in TypeScript: a slash written as JSX text is a string
 *  literal in a voice position, and this is a numeric format rather than a
 *  sentence. */
function ratioOfTen(tenths: number): string {
  return `${tenths}/${TENTHS}`;
}

/** `/100` under the score, for the same reason. */
function outOfHundred(): string {
  return `/${HUNDREDTHS}`;
}

/** REQ-004 c3: one line naming every factor that has no value, and for
 *  each, which of the two reasons applies. The count follows
 *  `Verdict.missing`'s own length exactly. */
function MissingFactors(p: { verdict: Verdict }): React.JSX.Element | null {
  if (p.verdict.missing.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      {p.verdict.missing.map((m) => (
        <p key={m.factor}>
          {copy(unmeasuredLineFor({ kind: "unmeasured", reason: m.reason, at: p.verdict.measuredAt }), {
            what: copy(FACTOR_NAMES[m.factor]),
          })}
        </p>
      ))}
    </div>
  );
}

/** One driver mini-bar, as the artboard stacks it: the name and its value
 *  on one baseline, the bar under them. The name is the bar's accessible
 *  name too, so the reading is the same whether it is seen or heard. */
function DriverBar(p: { factor: ScoreFactorName; value: Measured<number> }): React.JSX.Element {
  const name = copy(FACTOR_NAMES[p.factor]);
  const tenths = p.value.kind === "unmeasured" ? null : Math.round(p.value.value / TENTHS);
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="t-sm font-semibold">{name}</span>
        <Num unmeasured={tenths === null}>{tenths === null ? dash() : ratioOfTen(tenths)}</Num>
      </div>
      {/* A factor with no value draws no bar — a track at zero would claim
          a measurement of zero. */}
      {tenths === null ? null : <Progress value={tenths} max={TENTHS} label={name} />}
    </div>
  );
}

/** The dial. The value arc is drawn only from a measured score: an arc at
 *  zero over a dash would be a reading the scan never took. */
function Gauge(p: { score: number | null; paint: string }): React.JSX.Element {
  const { box, stroke } = GAUGE;
  return (
    <svg
      viewBox={`0 0 ${box} ${box}`}
      width={box}
      height={box}
      style={GAUGE_SVG}
      aria-hidden
      focusable={ARC.notFocusable}
    >
      <path
        d={ARC_PATH}
        fill={ARC.unfilled}
        stroke={ARC.track}
        strokeWidth={stroke}
        strokeLinecap={ARC.capRound}
      />
      {p.score === null ? null : (
        <path
          d={ARC_PATH}
          fill={ARC.unfilled}
          stroke={p.paint}
          strokeWidth={stroke}
          strokeLinecap={ARC.capRound}
          strokeDasharray={`${(SWEEP * p.score) / HUNDREDTHS} ${SWEEP}`}
        />
      )}
    </svg>
  );
}

/** REQ-094 c1's control, as the artboard draws it under the dial. The
 *  correction itself is REQ-094's own work, so this is a control with no
 *  destination rather than an invented one. */
function CorrectionControl(): React.JSX.Element {
  return <Btn label={copy("verdict.not-your-market")} variant="tertiary" size="sm" />;
}

export function VerdictStrip(p: {
  verdict: Verdict;
  category: string | null;
  /** Already formatted by the one caller that owns the report's one date. */
  measuredOn: string;
}): React.JSX.Element {
  const { verdict } = p;
  const scoreAndBand = verdict.scoreAndBand;
  const measured = scoreAndBand.kind === "unmeasured" ? null : scoreAndBand.value;

  return (
    <Card
      state="default"
      title={
        // The artboard's head: the score's own name, and the domain with
        // the date it was measured quiet on the right.
        <div className="flex w-full flex-wrap items-baseline justify-between gap-3">
          <span>{copy("verdict.score.label")}</span>
          <span className="t-explain flex min-w-0 flex-wrap items-baseline gap-2 font-normal opacity-60">
            <Num>{verdict.domain}</Num>
            <Num phrase>
              {p.category === null
                ? copy("report.measured-at.no-category", { date: p.measuredOn })
                : copy("report.measured-at", { date: p.measuredOn, category: p.category })}
            </Num>
          </span>
        </div>
      }
    >
      {/* The dial and the drivers sit side by side from `--breakpoint-sm`
          and stack under it, where a dial beside three bars leaves neither
          room to read. */}
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex basis-full flex-col items-center gap-2 sm:basis-48">
          <div className="relative w-full">
            <Gauge
              score={measured === null ? null : measured.score}
              paint={measured === null ? TONE_PAINT.neutral : TONE_PAINT[BAND_TONE[measured.band]]}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="font-semibold" style={BIG_NUMBER}>
                <Num unmeasured={measured === null}>{measured === null ? dash() : measured.score}</Num>
              </div>
              {measured === null ? null : (
                <span className="num t-explain opacity-60">{outOfHundred()}</span>
              )}
            </div>
          </div>
          {measured === null ? null : (
            <Badge tone={BAND_TONE[measured.band]}>{copy(SCORE_BANDS[measured.band])}</Badge>
          )}
          <CorrectionControl />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <p className="eyebrow opacity-60">{copy("verdict.drivers.title")}</p>
          <div className="flex flex-col gap-3">
            {FACTOR_ORDER.map((factor) => (
              <DriverBar key={factor} factor={factor} value={verdict.factors[factor]} />
            ))}
          </div>
        </div>
      </div>

      {verdict.limiting.kind === "factor" ? (
        <div className="rounded-box flex flex-col gap-2 border p-4" style={LIMIT_PANEL}>
          <p className="eyebrow" style={LIMIT_EYEBROW}>
            {copy("verdict.limiting.eyebrow")}
          </p>
          <p>{copy(LIMITING_LINES[verdict.limiting.factor])}</p>
        </div>
      ) : null}
      <MissingFactors verdict={verdict} />
    </Card>
  );
}
