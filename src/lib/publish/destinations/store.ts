// BUILD §9 — the `destinations` rows, read and written in one place.
//
// Every read here names its columns and **none of them names `config`**.
// That is the mechanism behind §9's "credentials … never logged": the
// ciphertext is not absent from these selects by care taken at each call
// site, it is absent because there is one select list and it does not have
// it. `config/` is the only module that ever names the column, and the
// only thing it does with the value is hand it to one callback.
//
// A row is *live* when `deleted_at is null`. Disconnect keeps the row —
// published pages stay live and their publications point at it (ADR-080) —
// so every read a surface or a publish attempt makes filters on it, and
// the partial unique index means a site has at most one such row.
import { publishDb } from "../db";
import type { DestinationHealth, DestinationKind, HealthReason } from "../types";

/** The `destinations` row as this subsystem reads it. Ten columns, and no
 *  eleventh: `config` is not here, and there is nowhere on this shape for
 *  a vendor message to live. */
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
}

/** The one select list. Written once so that no caller can widen it. */
export const RECORD_COLUMNS =
  "id, site_id, kind, health, health_reason, health_changed_at, " +
  "broken_mail_sent_at, last_checked_at, deleted_at, publish_capable";

/** One destination by id, live or disconnected. `reconnect` and
 *  `disconnect` both address a row by id and both must be able to see a
 *  row they are about to change the liveness of. */
export async function readDestination(destinationId: string): Promise<DestinationRecord | null> {
  const { data, error } = await publishDb()
    .from<DestinationRecord>("destinations")
    .select(RECORD_COLUMNS)
    .eq("id", destinationId)
    .limit(1);
  if (error !== null || data === null) return null;
  return data[0] ?? null;
}

/** A site's live destinations, oldest first. At most one today (the
 *  partial unique index), and read as a list because that is what a
 *  surface renders and because the index — not this query — is what keeps
 *  it at one. */
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

/**
 * Records what a check concluded.
 *
 * `health_changed_at` moves **only when the state actually changed** — it
 * is when the destination broke, not when it was last looked at, and the
 * 24 hours before one breakage mail are counted from it. A check that
 * confirms an unchanged state still stamps `last_checked_at`, which is the
 * date the customer reads.
 *
 * Reaching `ok` clears `broken_mail_sent_at`. That clearing is the whole
 * of "no further mail about that destination until it is reconnected and
 * breaks again": the guard is data, not a rule a caller has to remember.
 */
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

/**
 * Records what the capability probe found.
 *
 * Its own write, and only where the probe actually answered: `null` on the
 * column means "not asked, or could not be asked", and it is a third value
 * rather than a missing `false` on purpose. A hosted destination is never
 * asked — there is no account there whose permission to publish could
 * differ from its permission to create — and a probe whose read failed
 * leaves the last answer standing rather than overwriting it with a
 * network blip (ADR-084 Decision 3, ADR-086 Decision 1).
 */
export async function writePublishCapable(destinationId: string, capable: boolean): Promise<void> {
  await publishDb()
    .from<never>("destinations")
    .update({ publish_capable: capable })
    .eq("id", destinationId);
}

/** Stamps the once-per-breakage guard. Called when the mail has been
 *  handed to the mail seam and not before: a stamp written first would
 *  turn a send that never happened into a breakage nobody is ever told
 *  about. */
export async function markBreakageMailSent(destinationId: string, at: Date): Promise<void> {
  await publishDb()
    .from<never>("destinations")
    .update({ broken_mail_sent_at: at.toISOString() })
    .eq("id", destinationId);
}
