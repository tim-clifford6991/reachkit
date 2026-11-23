// Destination health, refreshed on a clock: `destination_working` reads `health = 'ok'`, and no screen re-checks, so the
// date a customer reads is this tick's. `account/maintenance` asks this every tick and hands each id to `checkHealth`.
// Two windows: a hosted one not `ok` waits on a record that can land any minute (`DESTINATION_HOSTNAME_RECHECK_H`, the
// window that bounds the check's vendor call); every other is only kept inside `DESTINATION_HEALTH_MAX_AGE_H`, so the
// customer's own site is read with their credential once a day, never hourly.
import {
  DESTINATION_HEALTH_MAX_AGE_H,
  DESTINATION_HOSTNAME_RECHECK_H,
} from "@/lib/config/constants";
import { publishDb } from "../../db";

const HOUR_MS = 3_600_000;

/** Live destinations whose last check is older than their window, oldest
 *  first. A read that fails throws: the tick records a fault rather than a
 *  quiet "nothing due". */
export async function destinationsDueHealth(now: Date): Promise<string[]> {
  const before = (hours: number) => new Date(now.getTime() - hours * HOUR_MS).toISOString();
  const [waiting, aged] = await Promise.all([
    due({ waitingHosted: true, checkedBefore: before(DESTINATION_HOSTNAME_RECHECK_H) }),
    due({ waitingHosted: false, checkedBefore: before(DESTINATION_HEALTH_MAX_AGE_H) }),
  ]);
  return [...new Set([...waiting, ...aged])];
}

async function due(a: { waitingHosted: boolean; checkedBefore: string }): Promise<string[]> {
  const base = publishDb().from<{ id: string }>("destinations").select("id").is("deleted_at", null);
  const { data, error } = await (a.waitingHosted ? base.eq("kind", "hosted").neq("health", "ok") : base)
    .lte("last_checked_at", a.checkedBefore)
    .order("last_checked_at", { ascending: true });
  if (error !== null) throw new Error(`destinationsDueHealth: ${error.message}`);
  return (data ?? []).map((row) => row.id);
}
