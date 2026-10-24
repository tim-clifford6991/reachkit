// BUILD §5 — the 0–100 composite and its drivers.
// src/lib/measure/score.ts — WO-277 (consolidates WO-054), BP-024
//
// `BUILD.md` §5's arithmetic over `Measured` values. The report shows none
// of the three factors as a number (owner ruling 2026-09-03, BP-024
// decision 6): the verdict is the score, its band word, and one written
// line naming the factor holding it down.
import { combine, mapMeasured, type Measured } from "./measured";
import { bandOf, type BandHandle } from "./bands";
import { SCORE_ESTIMATE, SCORING } from "@/lib/config/constants";

/** BP-010's own four measured quantities (`src/lib/measure/index.ts`,
 *  BP-010's file — `measureDomain` and this type's canonical home).
 *
 *  **Provenance note (rule 1.1 — an internal module boundary, not a
 *  customer promise; recorded once, here):** BP-010's own `index.ts` does
 *  not exist in this repo yet — this WO's `depends-on` is
 *  `[WO-001, WO-006, WO-018, WO-051]`, none of which is BP-010's own leaf,
 *  and `## Out of scope` names "the `Drivers` themselves … another
 *  node's" explicitly. `factorsOf` and `verdictOf` still need the shape to
 *  type against, so it is declared here, verbatim from BP-024's own
 *  approved `## Public interface` transcription of BP-010's declaration —
 *  nothing invented (rule 1.2). TypeScript's structural typing means a
 *  real `Drivers` value BP-010's own `measureDomain` produces later will
 *  satisfy this type without either file importing the other; when
 *  BP-010's `index.ts` lands, this local declaration should be replaced by
 *  `import type { Drivers } from './index'` — a one-line, no-behaviour-
 *  change reversal. Flagged once here per constitution rule 4.2. */
export interface Drivers {
  foundations: Measured<number>; // 0-100; a read generic noindex on the home doc is a measured 0
  answerability: Measured<number>; // 0-100, floored at 1
  searchPresence: Measured<number>; // sub-measure of Presence, never shown alone
  aiPresence: Measured<number>; // sub-measure of Presence, never shown alone
}

/** The three the score is composed of. **The report shows none of them.** */
export type ScoreFactorName = "foundations" | "answerability" | "presence";
export type ScoreFactors = Readonly<Record<ScoreFactorName, Measured<number>>>;

// `PRESENCE_FLOOR` stays local and is not pointed at `SCORING`
// (WO-251 file plan / out of scope). It equals `SCORING.answerabilityFloor`
// today by coincidence of value, not by derivation — `BUILD.md` §5 states
// the two floors independently (BP-005's `SCORING` comment) — so folding
// this into the pin would make a later edit to Answerability's floor
// silently move Presence's too. Leave it a local literal.
const PRESENCE_FLOOR = 1;

function floorAt(m: Measured<number>, floor: number): Measured<number> {
  return mapMeasured(m, (value) => Math.max(floor, value));
}

/** The `because` of an AI presence where AI answered none of the searches
 *  read (issue 1439): Presence is then search presence alone. Here and not
 *  in `drivers.ts`, so reading it does not load the drivers' word list. */
export const NO_AI_ANSWERS = "no_ai_answers";

/** How Presence reads one of its two halves (issue 1439): a value to weigh,
 *  `absent` where there is nothing to judge (AI answered none of the
 *  searches read), or `unknown` where it was not read. */
type Half = { kind: "value"; value: number; zero: boolean } | { kind: "absent" } | { kind: "unknown" };

function halfOf(m: Measured<number>): Half {
  if (m.kind !== "unmeasured") return { kind: "value", value: m.value, zero: m.kind === "zero" };
  return m.because === NO_AI_ANSWERS ? { kind: "absent" } : { kind: "unknown" };
}

/** `Presence = max(1, 0.5 × SearchPresence + 0.5 × AIPresence)` (owner, issue
 *  1439; the weights are `SCORE_ESTIMATE`'s). A weighted mean, so one zero
 *  no longer collapses it: under `√(SP × AP)` a site that does not rank yet
 *  had Presence 1 and a score of at most 22, whatever its pages and AI
 *  answers. A site nobody finds anywhere still has Presence 1.
 *
 *  Where AI answered none of the searches read, Presence is search presence
 *  alone. A half that was not read is the middle of its scale — the neutral
 *  assumption, never the best case — so the figure sits inside its range
 *  (`presenceRangeOf`), which spans that half's whole scale (master review
 *  of PR 1445). Never `unmeasured`: a score is withheld only where the
 *  site's own pages were not read. */
export function presenceOf(d: Pick<Drivers, "searchPresence" | "aiPresence">): Measured<number> {
  const at = d.searchPresence.at;
  const search = halfOf(d.searchPresence);
  const ai = halfOf(d.aiPresence);
  const middle = (low: number): number => (low + SCALE_CEILING) / 2;
  const sp = search.kind === "value" ? search.value : middle(0);
  const zero = search.kind === "value" && search.zero && (ai.kind === "absent" || (ai.kind === "value" && ai.zero));
  if (ai.kind === "absent") return { kind: zero ? "zero" : "measured", value: Math.max(PRESENCE_FLOOR, sp), at };
  const ap = ai.kind === "value" ? ai.value : middle(PRESENCE_FLOOR);
  const value = Math.max(PRESENCE_FLOOR, SCORE_ESTIMATE.searchWeight * sp + SCORE_ESTIMATE.aiWeight * ap);
  return { kind: zero ? "zero" : "measured", value, at };
}

/** Where Presence could lie (issue 1439): each half that was read is its
 *  Wilson range where the sample behind it is known (`searchRange`,
 *  `aiRange`) and its value otherwise, and a half not read the whole of its
 *  scale. Where AI answered none of the searches read there is no AI term. */
export function presenceRangeOf(
  d: Pick<Drivers, "searchPresence" | "aiPresence">,
  aiRange?: { low: number; high: number } | null,
  searchRange?: { low: number; high: number } | null
): { low: number; high: number } {
  const search = halfOf(d.searchPresence);
  const ai = halfOf(d.aiPresence);
  const sp =
    search.kind === "value"
      ? { low: searchRange?.low ?? search.value, high: searchRange?.high ?? search.value }
      : { low: 0, high: SCALE_CEILING };
  if (ai.kind === "absent") return { low: Math.max(PRESENCE_FLOOR, sp.low), high: Math.max(PRESENCE_FLOOR, sp.high) };
  const ap =
    ai.kind === "unknown" ? { low: PRESENCE_FLOOR, high: SCALE_CEILING } : (aiRange ?? { low: ai.value, high: ai.value });
  const mean = (s: number, a: number): number =>
    Math.max(PRESENCE_FLOOR, SCORE_ESTIMATE.searchWeight * s + SCORE_ESTIMATE.aiWeight * a);
  return { low: mean(sp.low, ap.low), high: mean(sp.high, ap.high) };
}

/** Four measured quantities to the three shown, score-composing factors
 *  (BP-024 decision 1). `foundations` passes through unfloored — a read
 *  generic noindex is a legitimate measured 0. `answerability` is floored
 *  at 1. `presence` is `presenceOf`. */
export function factorsOf(d: Drivers): ScoreFactors {
  return {
    foundations: d.foundations,
    answerability: floorAt(d.answerability, SCORING.answerabilityFloor),
    presence: presenceOf(d),
  };
}

/** `Score = round( ∛(Foundations × Answerability × Presence) )` (`BUILD.md`
 *  §5). `combine` returns `unmeasured` if any of the three factors is
 *  `unmeasured` (ADR-021 decision 3) — no band, no estimate, no
 *  interpolation from the factors that were measured. Exactly one
 *  parameter, no flag (ADR-021 decision 3). */
export function computeScore(f: ScoreFactors): Measured<{ score: number; band: BandHandle }> {
  return combine([f.foundations, f.answerability, f.presence] as const, ([foundations, answerability, presence]) => {
    const score = Math.round(Math.cbrt(foundations * answerability * presence));
    return { score, band: bandOf(score) };
  });
}

/** How sure a score is (owner, issue 1439): the scores its Presence range
 *  allows, and the word for how wide that is. */
export interface ScoreEstimate {
  low: number;
  high: number;
  confidence: "rough" | "close";
}

/** The score at each end of Presence's range, with Foundations and
 *  Answerability as read: they are read off the site's own pages and carry
 *  no sampling range. Rough where the range is wide or few results were
 *  read. `null` where there is no score. */
export function estimateOf(
  f: ScoreFactors,
  presence: { low: number; high: number },
  /** The Google results read; fewer than `SCORE_ESTIMATE.closeMinReads` is
   *  always rough, whatever the width. Absent, the width alone decides. */
  searchesRead?: number
): ScoreEstimate | null {
  const score = computeScore(f);
  const { foundations, answerability } = f;
  if (score.kind === "unmeasured" || foundations.kind === "unmeasured" || answerability.kind === "unmeasured") return null;
  const at = (p: number): number => Math.round(Math.cbrt(foundations.value * answerability.value * p));
  const low = Math.min(score.value.score, at(presence.low));
  const high = Math.max(score.value.score, at(presence.high));
  const thin = searchesRead !== undefined && searchesRead < SCORE_ESTIMATE.closeMinReads;
  return { low, high, confidence: thin || high - low > SCORE_ESTIMATE.roughWidth ? "rough" : "close" };
}

/** Which factor holds the score down — the one thing about the
 *  composition the report says, and it says it in a written line BP-019
 *  holds, never as a value. */
export type LimitingFactor =
  | { kind: "factor"; factor: ScoreFactorName }
  | { kind: "none"; because: "score_unmeasured" | "at_ceiling" };

// The order in which a founder can act on the three: their own page today,
// their own wording next, the market's answer last (BP-024's tie-break,
// fixed there — a parameter, rule 1.1, not re-derived here).
const TIE_BREAK_ORDER: readonly ScoreFactorName[] = ["foundations", "answerability", "presence"];

// The top of the 0-100 scale (`BUILD.md` §5) — not a separate pin: every
// factor is itself already bounded to this range, so "at the ceiling"
// means "at the top of the scale it is already expressed in".
const SCALE_CEILING = 100;

export function limitingFactorOf(f: ScoreFactors): LimitingFactor {
  const values: { factor: ScoreFactorName; value: number }[] = [];
  for (const factor of TIE_BREAK_ORDER) {
    const m = f[factor];
    if (m.kind === "unmeasured") {
      return { kind: "none", because: "score_unmeasured" };
    }
    values.push({ factor, value: m.value });
  }
  const min = Math.min(...values.map((v) => v.value));
  if (min >= SCALE_CEILING) {
    return { kind: "none", because: "at_ceiling" };
  }
  const winner = values.find((v) => v.value === min);
  // `values` has exactly `TIE_BREAK_ORDER.length` (3) entries and `min` is
  // the minimum of their own values, so a winner always exists.
  return { kind: "factor", factor: (winner as { factor: ScoreFactorName }).factor };
}
