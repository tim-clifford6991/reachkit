// SPEC §4 (owner, 2026-10-19, E3) — Billing's "What you got this month",
// counted from stored rows for the period the customer last paid for.
// A count nothing measured is `null`, which the card draws as "not measured".
import { readStoredReport } from "@/lib/scan/report";
import { billingStore } from "./store";

export interface MonthGot {
  readonly from: Date;
  readonly to: Date;
  /** New pages delivered in the period and still up, and when each went live. */
  readonly live: number;
  readonly liveAt: readonly Date[];
  /** When each Monday mail went out in the period. */
  readonly reports: readonly Date[];
  /** What the newest finished pass in the period checked; `null` where none finished. */
  readonly asked: { readonly searches: number; readonly questions: number } | null;
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

/** The newest pass's searches with a result read, and the AI questions it put. */
function askedOf(report: unknown): MonthGot["asked"] {
  if (report === null) return null;
  try {
    const read = readStoredReport(report);
    return {
      searches: read.serps.filter((serp) => serp.kind !== "unmeasured").length,
      questions: read.prompts?.asked.length ?? 0,
    };
  } catch {
    return null;
  }
}

/** The account's current period, counted. `null` where it could not be read. */
export async function monthGot(userId: string, siteId: string): Promise<MonthGot | null> {
  const account = await billingStore().account(userId);
  if (!account.ok || account.account === null) return null;
  const { from, to } = periodEnding(new Date(account.account.paid_through));
  const read = await billingStore().period(siteId, from, to);
  if (!read.ok) return null;
  const pages = read.pages.filter((row) => !row.refresh);
  return {
    from,
    to,
    live: pages.length,
    liveAt: pages.map((row) => new Date(row.published_at)),
    reports: read.reports.map((at) => new Date(at)),
    asked: askedOf(read.newestReport),
  };
}
