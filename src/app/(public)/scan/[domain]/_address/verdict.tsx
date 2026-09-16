// BUILD §4.1 module 1 — the report's header card (SPEC §2)
//
// The domain, when it was measured, the category and its correction; the
// score under its own name, its band word, one written line naming the
// factor holding it down; and the three driver mini-bars `n/10`, which live
// here and on no other card (SPEC §2).
//
// daisyUI in the route (DESIGN rule 1): `card`, `stat`, `badge`,
// `progress`, `btn`. The value is spoken in tenths and the bar is drawn from
// the same tenths, so the drawing and the figure beside it cannot disagree.
//
// The unmeasured arm renders the dash and **no band element at all**, still
// names the domain and the date, and carries one line per factor with no
// value. A factor with no value draws no bar — a track at zero would claim a
// measurement of zero.
import type React from "react";
import { BAND_TONE } from "@/ui/bands";
import type { Tone } from "@/ui/types";
import { copy } from "@/lib/presentation/copy";
import { LIMITING_LINES, SCORE_BANDS } from "@/lib/presentation/bands";
import type { Verdict } from "@/lib/measure/verdict";
import type { Measured } from "@/lib/measure/measured";
import type { ScoreFactorName } from "@/lib/measure/score";
import type { CopyKey } from "@/lib/presentation/copy";
import type { CorrectionOffer } from "@/lib/market/coherence/offer";
import { CategoryCorrection } from "./correction";
import { dash, Num, unmeasuredLineFor } from "./measured";

/** The factor's own name, for the `{what}` slot of the two unmeasured
 *  lines and for its own bar's label. */
const FACTOR_NAMES: Readonly<Record<ScoreFactorName, CopyKey>> = Object.freeze({
  foundations: "verdict.factor.foundations",
  answerability: "verdict.factor.answerability",
  presence: "verdict.factor.presence",
});

/** `score.ts`'s own tie-break order: their own page today, their own
 *  wording next, the market's answer last. */
const FACTOR_ORDER: readonly ScoreFactorName[] = ["foundations", "answerability", "presence"];

/** The factors are 0–100; the header speaks in tenths. */
const TENTHS = 10;

const BADGE_TONE: Readonly<Record<Tone, string>> = Object.freeze({
  accent: "badge-primary",
  ok: "badge-success",
  warn: "badge-warning",
  bad: "badge-error",
  neutral: "badge-ghost",
});

/** One line per factor with no value, naming which of the two reasons
 *  applies. The count follows `Verdict.missing` exactly. */
function MissingFactors(p: { verdict: Verdict }): React.JSX.Element | null {
  if (p.verdict.missing.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 text-sm">
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

/** `n/10`, composed in TypeScript: a numeric format, not a sentence. */
function ratioOfTen(tenths: number): string {
  return `${tenths}/${TENTHS}`;
}

/** One driver mini-bar: the bar, then its name and its value in tenths. The
 *  name is the bar's accessible name as well. */
function DriverBar(p: { factor: ScoreFactorName; value: Measured<number> }): React.JSX.Element {
  const name = copy(FACTOR_NAMES[p.factor]);
  const tenths = p.value.kind === "unmeasured" ? null : Math.round(p.value.value / TENTHS);
  return (
    <div className="flex min-w-0 flex-col gap-1">
      {tenths === null ? (
        <div className="bg-base-200 h-2 rounded-full" aria-hidden />
      ) : (
        <progress className="progress progress-primary" value={tenths} max={TENTHS} aria-label={name} />
      )}
      <p className="text-base-content/60 text-xs">
        {name} <Num unmeasured={tenths === null}>{tenths === null ? dash() : ratioOfTen(tenths)}</Num>
      </p>
    </div>
  );
}

export function VerdictStrip(p: {
  verdict: Verdict;
  category: string | null;
  /** Already formatted by the one caller that owns the report's one date. */
  measuredOn: string;
  /** Whether the category correction is on offer (SPEC §2, #786). */
  correction: CorrectionOffer;
}): React.JSX.Element {
  const { verdict } = p;
  const scoreAndBand = verdict.scoreAndBand;

  return (
    <section className="card bg-base-100 border-base-300 border">
      <div className="card-body gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="card-title min-w-0 overflow-x-auto">
              <Num>{verdict.domain}</Num>
            </h2>
            <div className="text-base-content/60 flex flex-wrap items-center gap-2 text-xs">
              <Num phrase>
                {p.category === null
                  ? copy("report.measured-at.no-category", { date: p.measuredOn })
                  : copy("report.measured-at", { date: p.measuredOn, category: p.category })}
              </Num>
              {/* The category correction: an inline field that re-measures
                  on the market given, and follows the rerun here (#786). */}
              <CategoryCorrection domain={verdict.domain} offer={p.correction} />
            </div>
          </div>

          <div className="stat w-auto p-0 text-right">
            <div className="stat-title">{copy("verdict.score.label")}</div>
            <div className="stat-value text-5xl">
              <Num unmeasured={scoreAndBand.kind === "unmeasured"}>
                {scoreAndBand.kind === "unmeasured" ? dash() : scoreAndBand.value.score}
              </Num>
            </div>
            {scoreAndBand.kind === "unmeasured" ? null : (
              <div className="stat-desc">
                <span className={`badge ${BADGE_TONE[BAND_TONE[scoreAndBand.value.band]]}`}>
                  {copy(SCORE_BANDS[scoreAndBand.value.band])}
                </span>
              </div>
            )}
          </div>
        </div>

        {verdict.limiting.kind === "factor" ? (
          <p className="grow-0">{copy(LIMITING_LINES[verdict.limiting.factor])}</p>
        ) : null}
        <MissingFactors verdict={verdict} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {FACTOR_ORDER.map((factor) => (
            <DriverBar key={factor} factor={factor} value={verdict.factors[factor]} />
          ))}
        </div>
      </div>
    </section>
  );
}
