// src/jobs/vendor-days.ts — issue 1478, SPEC §6
//
// `account/maintenance`'s obligation that reads what the vendors billed: a
// day's DataForSEO balance and Anthropic cost report, and each month's fixed
// vendors. The rule (what is due, how a day's bill is read) is
// `src/lib/costs/vendor-days.ts`'s; this file is the hand-off.
//
// Not spend: every reading is free, so the kill switch does not hold it.
// A second delivery of one tick finds the day's row and reads nothing; two
// together write the same row twice.
//
// Everything reaching `@/lib/db` is imported at the call, for the reason
// `engine.ts` gives.
import type { EngineResult } from "./engine";

export const vendorDayReading = Object.freeze({
  async due(): Promise<readonly string[]> {
    const { vendorDaysDue } = await import("@/lib/costs/vendor-days");
    return vendorDaysDue(new Date());
  },
  async handOff(subject: string): Promise<EngineResult> {
    const { readVendorDay } = await import("@/lib/costs/vendor-days");
    return readVendorDay(subject, new Date());
  },
});
