// BUILD §9 — the `destinations` rows, read and written in one place. There is one select list and it never names
// `config`, which is how §9's "credentials … never logged" holds; only `config/` names the column.
// Live is `deleted_at is null`: disconnect keeps the row because publications point at it (ADR-080), and a partial
// unique index keeps a site to one live row.
import { publishDb } from "../db";
import type { DestinationHealth, DestinationKind, HealthReason } from "../types";

/** The row as read here: no `config`, and nowhere for a vendor message to live. */
export interface DestinationRecord {
  id: string;
  site_id: string;
  kind: DestinationKind;
  health: DestinationHealth;
  health_reason: HealthReason | null;
  health_changed_at: string;
  broken_mail_sent_at: string | null;
  last_checked_at: string;
  deleted_at: string | null;
  publish_capable: boolean | null;
  stamp_capable: boolean | null;
  /** SPEC §5: the host the pages are served at and the domain list's word for it; null with no host of its own. */
  hostname: string | null;
  hostname_state: "pending_dns" | "live" | null;
}

/** The one select list, written once so no caller can widen it. */
export const RECORD_COLUMNS =
  "id, site_id, kind, health, health_reason, health_changed_at, " +
  "broken_mail_sent_at, last_checked_at, deleted_at, publish_capable, stamp_capable, " +
  // SPEC §5: the host and its state, which a surface states; neither is credential-adjacent.
  "hostname, hostname_state";

/** One destination by id, live or disconnected, since `reconnect` and `disconnect` change its liveness. */
export async function readDestination(destinationId: string): Promise<DestinationRecord | null> {
  const { data, error } = await publishDb()
    .from<DestinationRecord>("destinations")
    .select(RECORD_COLUMNS)
    .eq("id", destinationId)
    .limit(1);
  if (error !== null || data === null) return null;
  return data[0] ?? null;
}

/** A site's live destinations, oldest first: a list, as surfaces render one, kept to one by the index. */
export async function liveDestinations(siteId: string): Promise<DestinationRecord[]> {
  const { data, error } = await publishDb()
    .from<DestinationRecord>("destinations")
    .select(RECORD_COLUMNS)
    .eq("site_id", siteId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error !== null || data === null) return [];
  return data;
}

/** Records a check. `health_changed_at` moves only on a change, since the breakage mail's 24 hours count from it;
 *  `last_checked_at` always moves. Reaching `ok` clears `broken_mail_sent_at`, so the next breakage mails again. */
export async function writeHealth(a: {
  destinationId: string;
  health: DestinationHealth;
  reason: HealthReason | null;
  checkedAt: Date;
  changed: boolean;
}): Promise<void> {
  const values: Record<string, unknown> = {
    health: a.health,
    health_reason: a.reason,
    last_checked_at: a.checkedAt.toISOString(),
  };
  if (a.changed) values.health_changed_at = a.checkedAt.toISOString();
  if (a.health === "ok") values.broken_mail_sent_at = null;
  await publishDb()
    .from<never>("destinations")
    .update(values)
    .eq("id", a.destinationId);
}

/** Records the capability probe, only where it answered: `null` is "not asked", never `false`; hosted is never asked,
 *  and a failed read leaves the last answer standing (ADR-084 decision 3, ADR-086 decision 1). */
export async function writePublishCapable(destinationId: string, capable: boolean): Promise<void> {
  await publishDb()
    .from<never>("destinations")
    .update({ publish_capable: capable })
    .eq("id", destinationId);
}

/** Records the stamp probe, never folded into `writePublishCapable`: one holds a queue, the other only names a place in
 *  REQ-060 c6's mail (ADR-083 decision 4). `null` is "not asked", as there. */
export async function writeStampCapable(destinationId: string, capable: boolean): Promise<void> {
  await publishDb()
    .from<never>("destinations")
    .update({ stamp_capable: capable })
    .eq("id", destinationId);
}

/** Stamps the once-per-breakage guard after the mail seam has the mail, never before, or a failed send is never told. */
export async function markBreakageMailSent(destinationId: string, at: Date): Promise<void> {
  await publishDb()
    .from<never>("destinations")
    .update({ broken_mail_sent_at: at.toISOString() })
    .eq("id", destinationId);
}
