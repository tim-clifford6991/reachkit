// BUILD §5 — the band a score falls in.
// src/lib/measure/bands.ts — WO-277 (consolidates WO-054), BP-024
//
// The four band handles and the boundaries they turn on. Thresholds are
// BP-005's `SCORE_BAND_BOUNDS`, imported, never written here
// (`structure.md` rule 5). No band *word* appears in this file — the words
// (Invisible, Hard to find, Findable, Dominant) are BP-019's `SCORE_BANDS`.
import { SCORE_BAND_BOUNDS } from "@/lib/config/constants";

export type BandHandle = "invisible" | "hard-to-find" | "findable" | "dominant";

/** Descends through `SCORE_BAND_BOUNDS`'s four lower bounds with a total
 *  switch. The input range is asserted at the boundary — `score < 0` or
 *  `score > 100` throws — rather than left to a default arm that could
 *  silently return a band for an out-of-range value; the switch's own
 *  final arm still throws (unreachable once the guard above holds), so no
 *  branch of it can swallow anything. `0` and `100` are the only numeric
 *  literals in this file — every threshold comparison reads the pin. */
export function bandOf(score: number): BandHandle {
  if (score < 0 || score > 100) {
    throw new RangeError(`bandOf: score out of range [0,100]: ${score}`);
  }
  switch (true) {
    case score >= SCORE_BAND_BOUNDS.dominant:
      return "dominant";
    case score >= SCORE_BAND_BOUNDS.findable:
      return "findable";
    case score >= SCORE_BAND_BOUNDS["hard-to-find"]:
      return "hard-to-find";
    case score >= SCORE_BAND_BOUNDS.invisible:
      return "invisible";
    default:
      throw new RangeError(`bandOf: unreachable — score ${score} matched no band after the range guard`);
  }
}
