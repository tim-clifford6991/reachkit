// BUILD §4.1 module 1 — the report's header card (SPEC §2)
//
// The domain, when it was measured, the category and its correction; the
// score under its own name, its band word, one written line naming the
// factor holding it down; and the three driver mini-bars `n/10`, which live
// here and on no other card (SPEC §2).
//
// daisyUI in the route (DESIGN rule 1): `card`, `radial-progress`, `badge`,
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

/** One driver mini-bar: its name and its value in tenths above a
 *  full-width bar (`docs/DESIGN.md`: "a bar gets its own full-width line
 *  under its label"). The name is the bar's accessible name as well. The
 *  factor holding the score down draws in `error`, beside its name and value
 *  and never instead of them. */
function DriverBar(p: { factor: ScoreFactorName; value: Measured<number>; limiting: boolean }): React.JSX.Element {
  const name = copy(FACTOR_NAMES[p.factor]);
  const tenths = p.value.kind === "unmeasured" ? null : Math.round(p.value.value / TENTHS);
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold">{name}</span>
        <span className={p.limiting ? "text-error font-semibold" : "text-base-content/70"}>
          <Num unmeasured={tenths === null}>{tenths === null ? dash() : ratioOfTen(tenths)}</Num>
        </span>
      </p>
      {tenths === null ? (
        <div className="bg-base-200 h-1.5 rounded-full" aria-hidden />
      ) : (
        <progress
          className={`progress h-1.5 ${p.limiting ? "progress-error" : "progress-primary"}`}
          value={tenths}
          max={TENTHS}
          aria-label={name}
        />
      )}
    </div>
  );
}

/** The score in a ring that fills once (the calm layer, #1068): daisyUI's
 *  `radial-progress`, its track an inset ring in `base-200`, and the fill
 *  drawn from nothing in 1.4s by `animate-ring` — under reduced motion the
 *  full ring is drawn and nothing moves. The number inside is the one
 *  `<Num figure>`; the ring is its drawing, so it is hidden from a reader
 *  that already has the figure and "of 100". */
function ScoreRing(p: { score: number }): React.JSX.Element {
  return (
    <div className="relative grid size-40 place-items-center">
      <div
        aria-hidden
        className="radial-progress text-primary motion-safe:animate-ring absolute inset-0 shadow-[inset_0_0_0_12px_var(--color-base-200)] [--size:10rem] [--thickness:12px]"
        style={{ "--value": p.score } as React.CSSProperties}
      />
      <div className="relative flex flex-col items-center">
        <span className="text-5xl leading-none">
          <Num figure>{p.score}</Num>
        </span>
        <span className="text-base-content/70 text-xs">
          <Num>{copy("verdict.score.of")}</Num>
        </span>
      </div>
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
  const limiting = verdict.limiting.kind === "factor" ? verdict.limiting.factor : null;

  return (
    <section className="card bg-base-100 shadow-(--shadow-card)">
      {/* Board `R12-2-Report`: what the report says on the left, the score
          on the right; at compact the score comes first. */}
      <div className="card-body grid gap-8 p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-8">
        <div className="flex min-w-0 flex-col gap-4 max-md:order-2">
          <div className="flex min-w-0 flex-col gap-1.5">
            <p className="eyebrow">{copy("report.eyebrow")}</p>
            {/* The domain is what this report is *about*, so it is the
                page's `<h1>` (owner ruling 2026-09-23, #328). */}
            <h1 className="min-w-0 overflow-x-auto text-3xl font-semibold">
              <Num>{verdict.domain}</Num>
            </h1>
            <div className="text-base-content/70 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <Num phrase>
                {p.category === null
                  ? copy("report.measured-at.no-category", { date: p.measuredOn })
                  : copy("report.measured-at", { date: p.measuredOn, category: p.category })}
              </Num>
              {/* SPEC §2 (#715): what was measured, in one line that is
                  always shown — beside the date it was measured on. */}
              <span>{copy("report.measurement")}</span>
              {/* The category correction: an inline field that re-measures
                  on the market given, and follows the rerun here (#786). */}
              <CategoryCorrection domain={verdict.domain} offer={p.correction} />
            </div>
          </div>

          {limiting === null ? null : <p className="max-w-2xl text-lg">{copy(LIMITING_LINES[limiting])}</p>}
          <MissingFactors verdict={verdict} />

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {FACTOR_ORDER.map((factor) => (
              <DriverBar key={factor} factor={factor} value={verdict.factors[factor]} limiting={factor === limiting} />
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center gap-2.5 max-md:order-1">
          {scoreAndBand.kind === "unmeasured" ? (
            <span className="text-5xl leading-none">
              <Num unmeasured figure>
                {dash()}
              </Num>
            </span>
          ) : (
            <>
              <ScoreRing score={scoreAndBand.value.score} />
              <span className={`badge ${BADGE_TONE[BAND_TONE[scoreAndBand.value.band]]}`}>
                {copy(SCORE_BANDS[scoreAndBand.value.band])}
              </span>
            </>
          )}
          <p className="text-base-content/70 text-xs">{copy("verdict.score.label")}</p>
        </div>
      </div>
    </section>
  );
}
