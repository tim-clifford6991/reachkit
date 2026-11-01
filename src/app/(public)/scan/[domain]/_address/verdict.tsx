// BUILD §4.1 module 1 — the report's head (SPEC §2, board PubReport)
//
// The site's mark and domain, when and where it was measured, what the scan read the
// business as with its one correction, who gets the buyers (owner R12) and
// the biggest gap in its own card; beside them the score in its own card,
// its band and range, and its parts as `n/10`, closed under their name.
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
import { Languages, MapPin, Tag, type LucideIcon } from "lucide-react";
import { BAND_TONE } from "@/ui/bands";
import type { Tone } from "@/ui/types";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { LIMITING_LINES, SCORE_BANDS } from "@/lib/presentation/bands";
import { shownLimitingOf, type ShownFactor, type Verdict } from "@/lib/measure/verdict";
import type { Measured } from "@/lib/measure/measured";
import type { CorrectionOffer } from "@/lib/market/coherence/offer";
import { SiteMark } from "@/ui/SiteMark";
import { CategoryCorrection } from "./correction";
import { dash, Num, unmeasuredLineFor } from "./measured";

/** One reading in "We read you as": what it is, who buys, a town or a
 *  country-wide reach, and the market measured. */
export type ReadAsChip = { kind: "what" | "buyer" | "place" | "reach" | "measured"; text: string };

// One icon per concept (E29, E44): MapPin is a town only, and the buyer takes none because Users means competitors.
const READ_AS_ICON: Record<ReadAsChip["kind"], LucideIcon | null> = { what: Tag, buyer: null, place: MapPin, reach: null, measured: Languages };

/** A bar's own name, for the `{what}` slot of the two unmeasured lines and
 *  for its own label. */
const FACTOR_NAMES: Readonly<Record<ShownFactor, CopyKey>> = Object.freeze({
  foundations: "verdict.factor.foundations",
  answerability: "verdict.factor.answerability",
  google: "verdict.factor.google",
  ai: "verdict.factor.ai",
  presence: "verdict.factor.presence",
});

/** `score.ts`'s own tie-break order: their own page today, their own
 *  wording next, the market's answer last — Presence as its two halves
 *  where they were kept (issue 1444). */
function barsOf(verdict: Verdict): readonly { factor: ShownFactor; value: Measured<number> }[] {
  const own = [
    { factor: "foundations", value: verdict.factors.foundations },
    { factor: "answerability", value: verdict.factors.answerability },
  ] as const;
  return verdict.halves === undefined
    ? [...own, { factor: "presence", value: verdict.factors.presence }]
    : [...own, { factor: "google", value: verdict.halves.google }, { factor: "ai", value: verdict.halves.ai }];
}

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
function DriverBar(p: { factor: ShownFactor; value: Measured<number>; limiting: boolean }): React.JSX.Element {
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
 *  full ring is drawn and nothing moves. daisyUI's end-cap dot (`::after`)
 *  is placed from `--value`, which does not animate, so it sat at the final
 *  score while the arc grew toward it; `after:hidden` removes it (issue
 *  1436). The number inside is the one `<Num figure>`; the ring is its
 *  drawing, so it is hidden from a reader that already has the figure and
 *  "of 100". */
function ScoreRing(p: { score: number }): React.JSX.Element {
  return (
    <div className="relative grid size-40 place-items-center">
      <div
        aria-hidden
        className="radial-progress text-primary motion-safe:animate-ring absolute after:hidden inset-0 shadow-[inset_0_0_0_12px_var(--color-base-200)] [--size:10rem] [--thickness:12px]"
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

/** The biggest gap in its own card: its title and its one line. */
function GapCard(p: { factor: ShownFactor }): React.JSX.Element {
  const lines = LIMITING_LINES[p.factor];
  return (
    <section className="card card-border border-l-warning bg-base-100 border-l-4" data-testid="report-gap">
      <div className="card-body gap-1 p-5">
        <h2 className="text-lg font-semibold">{copy(lines.title)}</h2>
        <p>{copy(lines.line)}</p>
      </div>
    </section>
  );
}

/** The Visibility Score in its own card: the figure, its band and range,
 *  and, closed, what it is made of and the parts as `n/10`. */
function ScoreCard(p: { verdict: Verdict; limiting: ShownFactor | null; rescored?: { on: string; before: number } }): React.JSX.Element {
  const { verdict } = p;
  const scoreAndBand = verdict.scoreAndBand;
  const bars = barsOf(verdict);
  return (
    <section className="card bg-base-100 shadow-(--shadow-card) min-w-0" data-testid="report-score">
      <div className="card-body items-center gap-4 p-6">
        <p className="eyebrow">{copy("verdict.score.label")}</p>
        {scoreAndBand.kind === "unmeasured" ? (
          <span className="text-5xl leading-none">
            <Num unmeasured figure>
              {dash()}
            </Num>
          </span>
        ) : (
          <>
            <ScoreRing score={scoreAndBand.value.score} />
            <p className="flex flex-wrap items-center justify-center gap-2">
              <span className={`badge ${BADGE_TONE[BAND_TONE[scoreAndBand.value.band]]}`}>
                {copy(SCORE_BANDS[scoreAndBand.value.band])}
              </span>
              {/* A report scored before issue 1439 carries no range and draws none. */}
              {verdict.estimate === undefined ? null : (
                <span className="text-base-content/70 text-sm" data-testid="verdict-estimate">
                  <Num phrase>
                    {copy("verdict.estimate.range", {
                      low: String(verdict.estimate.low),
                      high: String(verdict.estimate.high),
                    })}
                  </Num>
                </span>
              )}
            </p>
            {p.rescored === undefined ? null : (
              <p className="text-base-content/70 text-center text-sm" data-testid="verdict-rescored">
                <Num phrase>{copy("verdict.rescored", { date: p.rescored.on, before: String(p.rescored.before) })}</Num>
              </p>
            )}
          </>
        )}
        <MissingFactors verdict={verdict} />
        <details className="collapse collapse-arrow w-full rounded-none" data-testid="verdict-split">
          <summary className="collapse-title min-h-0 px-0 py-2 pe-8 text-sm font-semibold after:end-2">{copy("verdict.score.split")}</summary>
          <div className="collapse-content flex flex-col gap-4 px-0">
            <p className="text-base-content/70 text-sm">{copy(bars.length === 4 ? "verdict.score.parts" : "verdict.score.parts.three")}</p>
            {bars.map((bar) => (
              <DriverBar key={bar.factor} factor={bar.factor} value={bar.value} limiting={bar.factor === p.limiting} />
            ))}
          </div>
        </details>
      </div>
    </section>
  );
}

export function VerdictStrip(p: {
  verdict: Verdict;
  category: string | null;
  /** Already formatted by the one caller that owns the report's one date. */
  measuredOn: string;
  /** Whether the category correction is on offer (SPEC §2, #786). */
  correction: CorrectionOffer;
  /** Where the report was measured, already worded, where that is not US
   *  Google in English (D66). Absent, the line every report carried. */
  measurement?: string;
  /** What the scan read the business as, one badge each, already worded. */
  readAs: readonly ReadAsChip[];
  /** The lines that say how the market was read, under what we read. */
  notes?: React.ReactNode;
  /** Who gets the buyers and the pages found, above the gap (owner R12). */
  top?: React.ReactNode;
  /** That the report is ReachKit's, not the business's, under the meta line. */
  independent: string;
  /** Where a re-score moved the score through the Google half: when, already formatted, and the score it read before. */
  rescored?: { on: string; before: number };
  /** Whether the scan kept the site's logo; otherwise its letter tile. */
  hasLogo?: boolean;
}): React.JSX.Element {
  const { verdict } = p;
  const limiting = shownLimitingOf(verdict);

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] md:items-start">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="eyebrow">{copy("report.eyebrow")}</p>
          {/* The domain is what this report is *about*, so it is the
              page's `<h1>` (owner ruling 2026-09-23, #328). */}
          <div className="flex min-w-0 items-center gap-3.5">
            <SiteMark domain={verdict.domain} hasLogo={p.hasLogo === true} size={56} />
            <h1 className="min-w-0 overflow-x-auto text-3xl font-semibold">
              <Num>{verdict.domain}</Num>
            </h1>
          </div>
          <p className="text-base-content/70 flex flex-wrap gap-x-1 text-sm">
            <Num phrase>
              {p.category === null
                ? copy("report.measured-at.no-category", { date: p.measuredOn })
                : copy("report.measured-at", { date: p.measuredOn, category: p.category })}
            </Num>
            <span>{p.measurement ?? copy("report.measurement")}</span>
          </p>
          <p className="text-base-content/70 text-xs">{p.independent}</p>
        </div>

        <div id="read-as" className="flex scroll-mt-20 flex-col items-start gap-2" data-testid="report-read-as">
          <span className="text-base-content/70 text-sm">{copy("report.read.as.title")}</span>
          <ul className="flex flex-wrap gap-1.5">
            {p.readAs.map(({ kind, text }) => {
              const Icon = READ_AS_ICON[kind];
              return (
                <li key={text} className="badge badge-outline h-auto py-0.5 whitespace-normal">
                  {Icon === null ? null : <Icon size={14} strokeWidth={1.75} className="shrink-0" aria-hidden />}
                  {text}
                </li>
              );
            })}
          </ul>
          {/* The category correction: an inline field that re-measures on
              the market given, and follows the rerun here (#786). */}
          <CategoryCorrection domain={verdict.domain} offer={p.correction} />
        </div>
        {p.notes}
        {p.top}

        {limiting === null ? null : <GapCard factor={limiting} />}
      </div>

      <ScoreCard verdict={verdict} limiting={limiting} {...(p.rescored === undefined ? {} : { rescored: p.rescored })} />
    </div>
  );
}
