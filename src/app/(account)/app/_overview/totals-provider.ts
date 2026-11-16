// SPEC §4 *The three totals* — the signed-in account's totals, read once a request.
import { cache } from "react";
import { now } from "@/lib/config/now";
import type { Totals } from "@/lib/measure/totals";
import { isReservedFixtureAccount, requireSetUpAccount } from "../_session/account";

/** The reserved fixture account's: one total of each state the row draws. */
const FIXTURE_TOTALS: Totals = {
  ai: { kind: "added", total: 37, n: 4 },
  google: { kind: "flat", total: 12 },
  pages: { kind: "first", total: 1, week: "2026-09-07" },
};

/** `null` where the rows could not be read: the row is not drawn, never zeros. */
export const readTotalsNow = cache(async function readTotalsNow(): Promise<Totals | null> {
  const account = await requireSetUpAccount();
  if (isReservedFixtureAccount(account)) return FIXTURE_TOTALS;
  // Imported at the call: the store resolves `@/lib/db`, which the reserved account never reaches.
  const { readTotals } = await import("@/lib/measure/totals-store");
  return readTotals({ siteId: account.siteId, zone: account.timeZone, now: now() });
});
