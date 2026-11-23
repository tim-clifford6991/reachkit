// A listed test site's week measured again on a fresh weekly budget, so the owner can evaluate a pass as often as needed. Temporary.
// The re-run measures on a row of its own, so its `WEEKLY` budget starts at 0¢, and takes the week only once it finishes.
import { env } from "@/lib/config/env";
import { dbAdmin } from "@/lib/db";
import { recordOpsEvent } from "@/lib/ops/events";
import type { WeeklyOutcome } from "./run";

/** Whether the site is on the owner's server-side list; unset, none is. */
export function isTestSite(siteId: string): boolean {
  return env.WEEKLY_RERUN_SITES.includes(siteId);
}

/** Whether the site's or the product's day has no room left; a day that cannot be read has none. */
export async function dayRefused(siteId: string, now: Date): Promise<boolean> {
  const daily = await import("@/lib/costs/daily");
  const [site, day, ceiling] = await Promise.all([daily.readSiteDaySpendCents(siteId, now), daily.readDaySpendCents(now), daily.readDayCeilingCents(now)]);
  return site === null || day === null || daily.siteCeilingReached(site) || daily.ceilingReached(day, ceiling);
}

/** One ops row per re-run, under its own key: what came of it and every cent its row's ledger carries. */
export async function recordRerun(a: { siteId: string; weekStart: string; key: string; outcome: WeeklyOutcome }): Promise<null> {
  const scanId = a.outcome.ran ? a.outcome.scanId : null;
  let cents = 0;
  if (scanId !== null) {
    const { data, error } = await dbAdmin().from("fetches").select("cost_cents").eq("scan_id", scanId);
    if (error !== null) throw new Error(`weekly rerun: could not read the ledger: ${error.message}`);
    cents = (data ?? []).reduce((sum, row) => sum + Number(row.cost_cents), 0);
  }
  const outcome = a.outcome.ran ? a.outcome.status : a.outcome.because;
  await recordOpsEvent("weekly_rerun", JSON.stringify({ weekStart: a.weekStart, scanId, cents, outcome }), a.key, a.siteId);
  return null;
}
