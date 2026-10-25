// BUILD §9 — the freshness promise, kept on the read path: the date a customer reads about a destination is never more
// than `DESTINATION_HEALTH_MAX_AGE_H` old, whether or not a publish was attempted. `listDestinations` re-checks a stale row in line.
// Not on publish, since a broken destination stops publishing and so would never refresh; not in a job, since §11's
// kill switch must not take the truth of a date with it. A read can call the network, so it is debounced.
import { DESTINATION_HEALTH_DEBOUNCE_S, DESTINATION_HEALTH_MAX_AGE_H } from "@/lib/config/constants";
import type { DestinationView } from "../../types";
import { heldPages } from "../../switch";
import { destinationView } from "../view";
import { readDestination, type DestinationRecord } from "../store";
import { checkHealth } from "./check";

export { checkHealth } from "./check";
export type { HealthCheck } from "./check";
export { breakageMailDue, sendBreakageMail } from "./breakage-mail";
export { hostedDestinationsDueHealth } from "./due";
export type { BreakageMail } from "./breakage-mail";

const HOUR_MS = 3_600_000;
const SECOND_MS = 1_000;

/** When this process last checked each destination: a burst collapser only, as the promise is made on `last_checked_at`. */
const lastCheckedHere = new Map<string, number>();

/** Vitest keeps one module instance per file, so a debounce would make the next test's first read a no-op. */
export function __resetHealthDebounceForTesting(): void {
  lastCheckedHere.clear();
}

/** What the capability probe last recorded. `null` is "not asked" (hosted, or WordPress no check has reached), never
 *  `false`, which would tell a customer they cannot publish before anything asked (ADR-086 decision 1). */
export async function publishCapability(destinationId: string): Promise<boolean | null> {
  const row = await readDestination(destinationId);
  return row?.publish_capable ?? null;
}

function isStale(row: DestinationRecord, now: Date): boolean {
  const checkedAt = Date.parse(row.last_checked_at);
  if (Number.isNaN(checkedAt)) return true;
  return now.getTime() - checkedAt >= DESTINATION_HEALTH_MAX_AGE_H * HOUR_MS;
}

function debounced(destinationId: string, now: Date): boolean {
  const last = lastCheckedHere.get(destinationId);
  return last !== undefined && now.getTime() - last < DESTINATION_HEALTH_DEBOUNCE_S * SECOND_MS;
}

/** The destination as a surface sees it, no older than the freshness window; `null` where it is not there, so the
 *  caller renders nothing rather than a blank destination. */
export async function ensureFreshHealth(destinationId: string): Promise<DestinationView | null> {
  const now = new Date();
  let row = await readDestination(destinationId);
  if (row === null) return null;

  if (isStale(row, now) && !debounced(destinationId, now)) {
    lastCheckedHere.set(destinationId, now.getTime());
    await checkHealth(destinationId);
    row = (await readDestination(destinationId)) ?? row;
  }

  const held = await heldPages(row.site_id);
  return destinationView({
    id: row.id,
    kind: row.kind,
    health: row.health,
    reason: row.health_reason,
    lastCheckedAt: new Date(row.last_checked_at),
    heldPages: held.count,
    // SPEC §5: the host and its state from the one row just refreshed, never two readings.
    hostname: row.hostname,
    hostnameState: row.hostname_state,
  });
}
