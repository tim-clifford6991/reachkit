// SPEC §4 (owner, 2026-10-19, E3) — Billing's "What you got this month",
// counted from stored rows for the period the customer last paid for.
// A count nothing measured is `null`, which the card draws as "not measured".
import { readRecordedRun, recordedChecks } from "@/lib/generate/record";
import { HARD_RULES } from "@/lib/generate/rules/types";
import { billingStore } from "./store";

export interface MonthPage {
  readonly title: string | null;
  readonly refresh: boolean;
  /** `null` where the page's run did not record which checks it asked. */
  readonly checks: { readonly passed: number; readonly total: number } | null;
}

export interface MonthGot {
  readonly from: Date;
  readonly to: Date;
  readonly live: number;
  readonly refreshed: number;
  /** `null` where no scan finished in the period. */
  readonly scans: number | null;
  readonly pages: readonly MonthPage[];
}

/** The monthly period that ends at `paidThrough`, on the same day of the
 *  month before, or that month's last day where it is shorter. */
export function periodEnding(paidThrough: Date): { from: Date; to: Date } {
  const from = new Date(paidThrough);
  const day = from.getUTCDate();
  from.setUTCDate(1);
  from.setUTCMonth(from.getUTCMonth() - 1);
  const last = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 0)).getUTCDate();
  from.setUTCDate(Math.min(day, last));
  return { from, to: new Date(paidThrough) };
}

/** The account's current period, counted. `null` where it could not be read. */
export async function monthGot(userId: string, siteId: string): Promise<MonthGot | null> {
  const account = await billingStore().account(userId);
  if (!account.ok || account.account === null) return null;
  const { from, to } = periodEnding(new Date(account.account.paid_through));
  const read = await billingStore().period(siteId, from, to);
  if (!read.ok) return null;

  const pages = read.pages.map((row): MonthPage => {
    const recorded = recordedChecks(row.rule_failures, readRecordedRun(row.meta));
    return {
      title: row.title,
      refresh: row.refresh,
      checks: recorded.skipped === null ? null : { passed: recorded.passed.length, total: HARD_RULES.length },
    };
  });
  return {
    from,
    to,
    live: pages.filter((page) => !page.refresh).length,
    refreshed: pages.filter((page) => page.refresh).length,
    scans: read.scans === 0 ? null : read.scans,
    pages,
  };
}
