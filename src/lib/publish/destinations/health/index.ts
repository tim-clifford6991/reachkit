// BUILD §9 — a destination's health as a surface reads it: the stored row, never re-checked on a request, since a check
// reaches a vendor (the customer's own site, the domain list, public DNS). `due.ts` keeps the date inside
// `DESTINATION_HEALTH_MAX_AGE_H` from the maintenance tick, which `account/maintenance` hands to `checkHealth`.
import type { DestinationView } from "../../types";
import { heldPages } from "../../switch";
import { destinationView } from "../view";
import type { DestinationRecord } from "../store";

export { checkHealth } from "./check";
export type { HealthCheck } from "./check";
export { breakageMailDue, sendBreakageMail } from "./breakage-mail";
export { destinationsDueHealth } from "./due";
export type { BreakageMail } from "./breakage-mail";

/** The destination as a surface sees it, from its stored check. */
export async function storedHealthView(row: DestinationRecord): Promise<DestinationView> {
  const held = await heldPages(row.site_id);
  return destinationView({
    id: row.id,
    kind: row.kind,
    health: row.health,
    reason: row.health_reason,
    lastCheckedAt: new Date(row.last_checked_at),
    heldPages: held.count,
    // SPEC §5: the host and its state from the same row, never two readings.
    hostname: row.hostname,
    hostnameState: row.hostname_state,
  });
}
