// BUILD §4.1 module 1 — the report's header card (UI-SPEC S2)
//
// The domain, when it was measured, the category and its correction; the
// score under its own name, its band word, one written line naming the
// factor holding it down; and the three driver mini-bars.
//
// **The driver bars are back, with their values** (ruling 1b of
// 2026-09-08, `docs/design/approved/full-set/UI-SPEC.md` §1). They were
// removed on 2026-09-03 and the ruling restores them, amending REQ-004 c2
// and BUILD §4.1 to allow a factor's value "on the header strip only":
// this file is that one strip, `Verdict.factors` is where the values now
// travel, and no other card, tile or mail may render one. The registered
// `Progress` is the bar — `components.md` §1 names it "also the three
// driver mini-bars of the report's header strip (§4.1); mini-bars are
// *not* a sixth chart".
//
// **The value is spoken in tenths, and the bar is drawn from the same
// tenths.** `score.ts` computes each factor on 0–100 and the approved set
// draws `7/10`; one conversion, here, feeds both the label and the bar, so
// the drawing and the figure beside it cannot disagree — a bar at 46% over
// a label reading `5/10` would be two different claims about one
// measurement.
//
// The unmeasured arm renders the dash, **no band element at all**, still
// names the domain and the date, and carries one line per factor with no
// value, saying which of the two reasons applies to each. A measured zero
// is a zero: `renderMeasured`'s own trichotomy decides which, and it is
// not re-implemented here. A factor with no value draws no bar — a track
// at zero would claim a measurement of zero.
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
 *  *sentence* about a factor and is a different thing; conflating them
 *  would put a whole sentence inside another sentence's slot. */
const FACTOR_NAMES: Readonly<Record<ScoreFactorName, CopyKey>> = Object.freeze({
  foundations: "verdict.factor.foundations",
  answerability: "verdict.factor.answerability",
  presence: "verdict.factor.presence",
});

/** The order the three bars are drawn in — `score.ts`'s own tie-break
 *  order, which is the order a founder can act on them in: their own page
 *  today, their own wording next, the market's answer last. */
const FACTOR_ORDER: readonly ScoreFactorName[] = ["foundations", "answerability", "presence"];

/** The scale the header speaks in. The factors are 0–100 (`BUILD.md` §5);
 *  the approved set draws `7/10`. Both the label and the bar read this one
 *  number, so they cannot disagree. */
const TENTHS = 10;

/** REQ-004 c3: one line naming every factor that has no value, and for
 *  each, which of the two reasons applies — never calling a factor the
 *  scan never attempted a missing one. The count follows
 *  `Verdict.missing`'s own length exactly; it is never padded or
 *  truncated. */
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

/** One driver mini-bar: the bar, then its name and its value in tenths.
 *  The name is the accessible name of the bar as well, so the reading is
 *  the same whether the row is seen or heard. */
function DriverBar(p: { factor: ScoreFactorName; value: Measured<number> }): React.JSX.Element {
  const name = copy(FACTOR_NAMES[p.factor]);
  const tenths = p.value.kind === "unmeasured" ? null : Math.round(p.value.value / TENTHS);
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      {tenths === null ? null : <Progress value={tenths} max={TENTHS} label={name} />}
      <p className="text-xs opacity-60">
        {name} <Num unmeasured={tenths === null}>{tenths === null ? dash() : ratioOfTen(tenths)}</Num>
      </p>
    </div>
  );
}

/** The score's own size — the ladder's big-number rung (`--t-num-big`,
 *  44px), named rather than approximated by a utility step. */
const BIG_NUMBER: React.CSSProperties = { fontSize: "var(--t-num-big)", lineHeight: 1.1 };

/** REQ-094 c1's control, as S2 draws it. The correction itself — the form,
 *  the seven-day window, the re-measure — is REQ-094's own work and not
 *  this screen's, so this is a control with no destination rather than an
 *  invented one, the way the pricing card's Start was until checkout
 *  landed. */
function CorrectionControl(): React.JSX.Element {
  return <Btn label={copy("verdict.not-your-market")} variant="tertiary" size="sm" />;
}

/** `n/10`, composed in TypeScript: a slash written as JSX text is a string
 *  literal in a voice position, and this is a numeric format rather than a
 *  sentence — the same reason `measured.tsx` composes its own ratio. */
function ratioOfTen(tenths: number): string {
  return `${tenths}/${TENTHS}`;
}

export function VerdictStrip(p: {
  verdict: Verdict;
  category: string | null;
  /** Already formatted by the one caller that owns the report's one date. */
  measuredOn: string;
}): React.JSX.Element {
  const { verdict } = p;
  const scoreAndBand = verdict.scoreAndBand;

  return (
    <Card
      state="default"
      title={
        <div className="flex w-full flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            {/* The domain is a value: mono, and never rewritten to fit
                (`.num` in `src/ui/type.css`). */}
            <h3 className="min-w-0 overflow-x-auto">
              <Num>{verdict.domain}</Num>
            </h3>
            <div className="flex flex-wrap items-baseline gap-2 text-xs font-normal opacity-60">
              <Num>
                {p.category === null
                  ? copy("report.measured-at.no-category", { date: p.measuredOn })
                  : copy("report.measured-at", { date: p.measuredOn, category: p.category })}
              </Num>
              {/* REQ-094 c1's correction control. It has no destination
                  yet — the correction flow is REQ-094's own work — and a
                  control with no destination is what this codebase ships
                  rather than an invented one (`pricing.tsx`'s Start until
                  checkout landed). */}
              <CorrectionControl />
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 text-right">
            {/* 6a: "Discoverability Score" is the number's name on every
                surface that labels it. */}
            <p className="eyebrow opacity-60">{copy("verdict.score.label")}</p>
            {/* A block, not an inline `span`: an inline box is sized from
                its own font's metrics, and JetBrains Mono is taller at the
                same size than the UI face, so a mono child inside an
                inline parent overflows it by a pixel or two. A block
                wrapper takes the line box's height, which is the child's.
                The size is the ladder's own big-number rung. */}
            <div className="font-semibold" style={BIG_NUMBER}>
              <Num unmeasured={scoreAndBand.kind === "unmeasured"}>
                {scoreAndBand.kind === "unmeasured" ? dash() : scoreAndBand.value.score}
              </Num>
            </div>
            {scoreAndBand.kind === "unmeasured" ? null : (
              <Badge tone={BAND_TONE[scoreAndBand.value.band]}>
                {copy(SCORE_BANDS[scoreAndBand.value.band])}
              </Badge>
            )}
          </div>
        </div>
      }
    >
      {verdict.limiting.kind === "factor" ? (
        <p>{copy(LIMITING_LINES[verdict.limiting.factor])}</p>
      ) : null}
      <MissingFactors verdict={verdict} />

      {/* One column on a phone, three across the strip from
          `--breakpoint-sm`: pinned to one row they would be a third of a
          wide report each, and at 320 narrower than their own labels. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {FACTOR_ORDER.map((factor) => (
          <DriverBar key={factor} factor={factor} value={verdict.factors[factor]} />
        ))}
      </div>
    </Card>
  );
}
