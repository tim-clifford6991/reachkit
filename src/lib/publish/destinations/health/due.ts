// Issue #791 — hosted health, refreshed on a clock.
//
// `destination_working` reads `destinations.health = 'ok'`, and before this
// the only things that re-checked a hosted destination were a connect, a
// reconnect and Settings' own read. A founder who pointed their record and
// never opened Settings kept `expired` — and no page — until somebody did.
// `account/maintenance` asks this query on every tick and hands each id to
// `checkHealth`.
//
// **Two windows, because the two states wait on different things.** A
// destination that is not `ok` is waiting on the founder's record, which can
// land at any minute: it is re-checked once `DESTINATION_HOSTNAME_RECHECK_H`
// has passed, the same window that bounds the vendor call inside the check.
// One that is `ok` only has to keep the date the customer reads inside
// `DESTINATION_HEALTH_MAX_AGE_H`.
//
// Hosted only: a WordPress check reaches the customer's own site with their
// credential, and nothing in this issue asks that to happen on a clock.
import {
  DESTINATION_HEALTH_MAX_AGE_H,
  DESTINATION_HOSTNAME_RECHECK_H,
} from "@/lib/config/constants";
import { publishDb } from "../../db";

const HOUR_MS = 3_600_000;

/** Live hosted destinations whose last check is older than their window,
 *  oldest first. A read that fails throws: the tick records a fault rather
 *  than a quiet "nothing due". */
export async function hostedDestinationsDueHealth(now: Date): Promise<string[]> {
  const before = (hours: number) => new Date(now.getTime() - hours * HOUR_MS).toISOString();
  const [waiting, healthy] = await Promise.all([
    due({ health: "not-ok", checkedBefore: before(DESTINATION_HOSTNAME_RECHECK_H) }),
    due({ health: "ok", checkedBefore: before(DESTINATION_HEALTH_MAX_AGE_H) }),
  ]);
  return [...waiting, ...healthy];
}

async function due(a: { health: "ok" | "not-ok"; checkedBefore: string }): Promise<string[]> {
  const base = publishDb()
    .from<{ id: string }>("destinations")
    .select("id")
    .eq("kind", "hosted")
    .is("deleted_at", null);
  const { data, error } = await (a.health === "ok" ? base.eq("health", "ok") : base.neq("health", "ok"))
    .lte("last_checked_at", a.checkedBefore)
    .order("last_checked_at", { ascending: true });
  if (error !== null) throw new Error(`hostedDestinationsDueHealth: ${error.message}`);
  return (data ?? []).map((row) => row.id);
}
