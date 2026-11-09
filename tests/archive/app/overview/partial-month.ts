// A first-Monday pass that selected twelve searches and measured two, and a
// current report that measured all twelve: the account Overview showed as
// "0 of 2" beside the Google tab's "0 of 12".
import type { MonthReport } from "@/lib/measure/figures";

const TWELVE: readonly unknown[] = Array.from({ length: 12 }, () => ({ kind: "measured" }));

export function passOf(measuredSearches: number, top10 = 0): MonthReport & { presence: NonNullable<MonthReport["presence"]> } {
  return {
    verdict: { scoreAndBand: { kind: "measured", value: { score: 31 }, at: new Date("2026-10-05T06:00:00.000Z") } },
    presence: { measuredSearches, you: { top10Count: top10 } },
    serps: TWELVE,
  };
}

export const FIRST_MONDAY = passOf(2);
export const CURRENT = passOf(12);
