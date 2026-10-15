// BUILD §5 — the verdict a score and its drivers add up to.
// src/lib/measure/verdict.ts — WO-277 (consolidates WO-055), BP-024
//
// What the top of the report is made of. There is no tier field and no
// `forFree` parameter anywhere in this file: REQ-004 criterion 5's "no
// part … hidden, blurred, rounded down, locked, or marked as available on
// payment" is discharged by there being nothing to pass that could hide
// anything.
import { AI_READER_AGENTS } from "@/lib/config/constants";
import type { RobotsPolicy } from "@/lib/egress/types";
import type { CanonicalDomain } from "@/lib/scan/domain";
import type { Measured, UnmeasuredReason } from "./measured";
import { FEEDS, type InputOutcome, type ScanInput } from "./partition";
import {
  computeScore,
  estimateOf,
  factorsOf,
  presenceRangeOf,
  limitingFactorOf,
  type Drivers,
  type LimitingFactor,
  type ScoreEstimate,
  type ScoreFactorName,
  type ScoreFactors,
} from "./score";
import type { BandHandle } from "./bands";

export interface Verdict {
  domain: CanonicalDomain;
  measuredAt: Date; // one date; every figure under it is this scan's
  scoreAndBand: Measured<{ score: number; band: BandHandle }>;
  /** How sure the score is (owner, issue 1439): the scores Presence's range
   *  allows and the word for how wide that is. Absent where there is no
   *  score, and on a report scored before issue 1439 that the re-score has
   *  not reached. */
  estimate?: ScoreEstimate;
  /** The three factors the score is composed of.
   *
   *  **They reach exactly one surface, and the owner named it**: ruling 1b
   *  of 2026-09-08 (`docs/design/approved/full-set/UI-SPEC.md` §1) keeps
   *  the report header's three driver mini-bars with their `n/10` values,
   *  and amends REQ-004 c2 and BUILD §4.1 to allow the values "on the
   *  header strip only". That reverses BP-024 decision 6 and the
   *  2026-09-03 ruling that removed the bars, and it reverses nothing
   *  else: no other card, mail or tile may render a factor value, and
   *  `limiting` is still how the *composition* is spoken about — one
   *  written line, never a second arithmetic.
   *
   *  `factorsOf` computed this already; what changed is that the verdict
   *  now carries it rather than dropping it on the floor. */
  factors: ScoreFactors;
  limiting: LimitingFactor;
  /** REQ-004 criterion 3: name every factor with no value and, for each,
   *  which of the two reasons applies. Empty when the score could be
   *  computed. */
  missing: readonly { factor: ScoreFactorName; reason: UnmeasuredReason }[];
  /** REQ-004 criterion 6, the "no driver depended on it" case, and
   *  criterion 10. */
  unmeasuredElsewhere: readonly { input: ScanInput; reason: UnmeasuredReason }[];
  /** Read here because REQ-009 criteria 1, 3 and 4 are a rendering of a
   *  measurement this node performs; BP-027 renders it and computes
   *  nothing. */
  blockedReaders: Measured<number>;
}

// `mapMeasured` alone cannot express the trichotomy REQ-009 c1's test row
// needs (a `measured` read collapsing to the `zero` arm when the count is
// itself 0) — that decision belongs here, not inside `mapMeasured`, which
// must preserve the arm it was given. Written as its own function instead.
function robotsCount(robots: Measured<RobotsPolicy>): Measured<number> {
  if (robots.kind === "unmeasured") return robots;
  const policy = robots.value;
  // `policy.absent === true` is a read with nothing in it (REQ-004 c7): a
  // measured 0, never `unmeasured`.
  const count = policy.absent
    ? 0
    : policy.disallowsAll
      ? AI_READER_AGENTS.length
      : AI_READER_AGENTS.filter((token) => policy.disallowedAgents[token] === true).length;
  return count === 0 ? { kind: "zero", value: 0, at: robots.at } : { kind: "measured", value: count, at: robots.at };
}

function assertAllSameAt(verdict: Verdict): void {
  const t = verdict.measuredAt.getTime();
  for (const m of [verdict.scoreAndBand, verdict.blockedReaders] as const) {
    if (m.at.getTime() !== t) {
      throw new Error(
        "verdictOf: a Measured value inside the verdict carries an `at` that differs from `measuredAt` (BP-024: " +
          "\"a value whose `at` differs from the verdict's is a test failure\")"
      );
    }
  }
}

export function verdictOf(a: {
  domain: CanonicalDomain;
  measuredAt: Date;
  drivers: Drivers;
  inputs: Readonly<Record<ScanInput, InputOutcome>>;
  robots: Measured<RobotsPolicy>;
  /** A stored report's Presence, where its two sub-measures were not both
   *  kept and the stored factor stands (the re-score, issue 1426). */
  presence?: Measured<number>;
  /** Where AI presence could lie given the answers behind it
   *  (`aiPresenceRangeOf`); absent, its value alone. */
  aiRange?: { low: number; high: number } | null;
}): Verdict {
  const drivenFactors = factorsOf(a.drivers);
  const factors: ScoreFactors = a.presence === undefined ? drivenFactors : { ...drivenFactors, presence: a.presence };
  const scoreAndBand = computeScore(factors);
  const presenceRange =
    a.presence === undefined
      ? presenceRangeOf(a.drivers, a.aiRange)
      : a.presence.kind === "unmeasured"
        ? null
        : { low: a.presence.value, high: a.presence.value };
  const estimate = presenceRange === null ? null : estimateOf(factors, presenceRange);
  const limiting = limitingFactorOf(factors);

  const missing: { factor: ScoreFactorName; reason: UnmeasuredReason }[] = [];
  for (const factor of ["foundations", "answerability", "presence"] as const) {
    const m = factors[factor];
    if (m.kind === "unmeasured") missing.push({ factor, reason: m.reason });
  }
  const missingFactors = new Set(missing.map((m) => m.factor));

  const unmeasuredElsewhere: { input: ScanInput; reason: UnmeasuredReason }[] = [];
  for (const input of Object.keys(a.inputs) as ScanInput[]) {
    const outcome = a.inputs[input];
    if (outcome.read) continue;
    const feeds = FEEDS[input];
    const dependsOnMissing = feeds.some((factor) => missingFactors.has(factor));
    if (!dependsOnMissing) {
      unmeasuredElsewhere.push({ input, reason: outcome.because });
    }
  }

  const blockedReaders = robotsCount(a.robots);

  const verdict: Verdict = {
    domain: a.domain,
    measuredAt: a.measuredAt,
    scoreAndBand,
    ...(estimate === null ? {} : { estimate }),
    factors,
    limiting,
    missing,
    unmeasuredElsewhere,
    blockedReaders,
  };

  assertAllSameAt(verdict);
  return verdict;
}
