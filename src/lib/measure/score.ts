// BUILD §5 — the 0–100 composite and its drivers.
// src/lib/measure/score.ts — WO-277 (consolidates WO-054), BP-024
//
// `BUILD.md` §5's arithmetic over `Measured` values. The report shows none
// of the three factors as a number (owner ruling 2026-09-03, BP-024
// decision 6): the verdict is the score, its band word, and one written
// line naming the factor holding it down.
// ── The record for this file ─────────────────────────────────────────────
// Rulings of record for this module, moved out of `DECISIONS.md` on 2026-09-11
// (owner ruling: the record holds product rulings only; an implementation ruling
// belongs where the code is). Verbatim. The whole original record is
// `docs/archive/DECISIONS-full-2026-09-11.md`.
//
// DECISIONS 2026-08-31: The spend ceiling outranks the verdict: a cut-off factor nulls the
//   score; no partial score is ever computed. — ADR-021

import { combine, mapMeasured, type Measured } from "./measured";
import { bandOf, type BandHandle } from "./bands";
import { SCORING } from "@/lib/config/constants";

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

/** `Presence = max(1, √(SearchPresence × AIPresence))` (`BUILD.md` §5). The
 *  floor is applied inside the combining function, so it can only ever
 *  apply to a value that exists — `combine` never calls `f` when either
 *  sub-measure is `unmeasured`. */
export function presenceOf(d: Pick<Drivers, "searchPresence" | "aiPresence">): Measured<number> {
  return combine([d.searchPresence, d.aiPresence] as const, ([sp, ap]) =>
    Math.max(PRESENCE_FLOOR, Math.sqrt(sp * ap))
  );
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
