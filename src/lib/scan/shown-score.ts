// The Visibility Score a scan shows, read one way by the report, its share
// image, the gallery's stored column, the Monday mail and Overview.
import { unmeasured, type Measured } from "@/lib/measure/measured";

/** A stored report as far as its score goes, declared by shape so no reader's graph reaches the scan's modules. */
interface Scored<V extends { score: number }> {
  readonly verdict?: { readonly scoreAndBand?: Measured<V> | null } | null;
}

/** The scan's stored verdict reading; no report, or a verdict with no reading, is not measured. */
export function shownReading<V extends { score: number }>(report: Scored<V> | null | undefined, at: Date): Measured<V> {
  return report?.verdict?.scoreAndBand ?? unmeasured<V>("not_attempted", at);
}

/** The scan's score as one integer, `null` where it reached none: never `0` for not measured. */
export function shownScore(report: Scored<{ score: number }> | null | undefined): number | null {
  const reading = report?.verdict?.scoreAndBand;
  return reading === undefined || reading === null || reading.kind === "unmeasured" ? null : reading.value.score;
}
