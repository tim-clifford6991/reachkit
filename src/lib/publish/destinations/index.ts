// BUILD §9 — the destination registry: the read model a surface may see, and connect / disconnect / reconnect.
// A destination has a state, a last-checked date, one action that fixes it, and a queue that holds rather than loses:
// §9's "expired credential is a state (reconnect prompt, queue holds), not an error loop", for every case.
// `DestinationView` is all a surface may see, read alike by Settings, Overview and the calendar; nothing on it can hold
// a vendor string, and nothing here selects `config`. `adapterFor` is re-exported from `registry.ts` (ADR-092).
import type { Actor, DestinationKind, DestinationView, HealthReason } from "../types";
import { isPublishingOn, heldPages } from "../switch";
import { publishDb } from "../db";
import { destroyConfig, storeConfig } from "./config";
import { checkHealth } from "./health/check";
import { ensureFreshHealth } from "./health";
import { liveDestinations, readDestination } from "./store";

export { adapterFor } from "./registry";
export { destinationView } from "./view";
export type { DestinationFacts } from "./view";
export { checkHealth, ensureFreshHealth, breakageMailDue, sendBreakageMail } from "./health";
export { withConfig } from "./config";
export type { DestinationRecord } from "./store";

/** One line per lifecycle event: id, kind, state and actor, never a credential or body (BP-058). */
function log(a: { at: string; destinationId: string; kind?: DestinationKind; actor: Actor["kind"]; health?: string }): void {
  console.log(JSON.stringify({ event: "destination", ...a }));
}

/** A site already has a live destination: a throw, not a reason, since it is a caller's mistake and not a state to show
 *  the customer. `destinations_one_live_per_site` is the guarantee; this is its readable form. */
export class AlreadyConnectedError extends Error {
  constructor(siteId: string) {
    super(`src/lib/publish/destinations: site ${siteId} already has a live destination.`);
    this.name = "AlreadyConnectedError";
  }
}

/** What a caller may learn without opening the credential; `config` is not on it, and callers needing it use `withConfig`. */
export interface DestinationRow {
  id: string;
  kind: DestinationKind;
  health: "ok" | "expired" | "error";
}

/** The site's live destination of a kind, read fresh inside the claim, since a stale health reading is how a page goes
 *  to a destination that already stopped working. A disconnected one is not live. */
export async function destinationOf(
  siteId: string,
  kind: DestinationKind
): Promise<DestinationRow | null> {
  const { data, error } = await publishDb()
    .from<DestinationRow>("destinations")
    .select("id, kind, health")
    .eq("site_id", siteId)
    .eq("kind", kind)
    .is("deleted_at", null)
    .limit(1);
  if (error !== null || data === null) return null;
  const [row] = data;
  return row ?? null;
}

/** `destination_working`: a live destination with `health = 'ok'`, the whole test. There is no fallback destination,
 *  ever: a page goes where the customer chose or nowhere. */
export async function destinationWorking(siteId: string): Promise<boolean> {
  const { data, error } = await publishDb()
    .from<{ id: string }>("destinations")
    .select("id, health")
    .eq("site_id", siteId)
    .eq("health", "ok")
    .is("deleted_at", null)
    .limit(1);
  if (error !== null || data === null) return false;
  return data.length > 0;
}

/** The live destination's host is `pending_dns` (SPEC §5). Asked beside `destinationWorking` so the calendar can name
 *  the record to set; a failed read is `false`, the general "not connected". */
export async function destinationWaitingOnDns(siteId: string): Promise<boolean> {
  const { data, error } = await publishDb()
    .from<{ id: string }>("destinations")
    .select("id, hostname_state")
    .eq("site_id", siteId)
    .eq("hostname_state", "pending_dns")
    .is("deleted_at", null)
    .limit(1);
  if (error !== null || data === null) return false;
  return data.length > 0;
}

/** What the site publishes to and whether it works, from the stored row, never re-checked: choosing whether to draw a
 *  reconnect control may not spend a vendor call. `null` with no live destination. */
export async function destinationStanding(
  siteId: string
): Promise<{ kind: DestinationKind; healthy: boolean } | null> {
  const [row] = await liveDestinations(siteId);
  if (row === undefined) return null;
  return { kind: row.kind, healthy: row.health === "ok" };
}

/** Every live destination as a surface sees it, re-checked on the read path for §9's "never more than 24 hours old"; at
 *  most one per site, so no fan-out. */
export async function listDestinations(siteId: string): Promise<DestinationView[]> {
  const rows = await liveDestinations(siteId);
  const views = await Promise.all(rows.map((row) => ensureFreshHealth(row.id)));
  return views.filter((view): view is DestinationView => view !== null);
}

export type ConnectResult =
  | { ok: true; destinationId: string; health: "ok" | "expired" | "error" }
  | { ok: false; reason: HealthReason };

/** Connects a destination. `config: null` is a deferred connection, not a failure: `expired`/`never_connected`, no
 *  network call, `ok`, and the first page held. A config is stored sealed and validated by the check, never by connecting,
 *  so a bad credential is a state, not a rejected form. */
export async function connect(a: {
  siteId: string;
  kind: DestinationKind;
  config: unknown | null;
  by: Actor;
}): Promise<ConnectResult> {
  if ((await liveDestinations(a.siteId)).length > 0) throw new AlreadyConnectedError(a.siteId);

  const now = new Date();
  const { data, error } = await publishDb()
    .from<{ id: string }>("destinations")
    .insert({
      site_id: a.siteId,
      kind: a.kind,
      config: null,
      health: "expired",
      health_reason: "never_connected",
      health_changed_at: now.toISOString(),
      last_checked_at: now.toISOString(),
      created_at: now.toISOString(),
    })
    .select("id");
  const created = data?.[0];
  if (error !== null || created === undefined) throw new AlreadyConnectedError(a.siteId);

  log({ at: "connect", destinationId: created.id, kind: a.kind, actor: a.by.kind });

  if (a.config === null) {
    return { ok: true, destinationId: created.id, health: "expired" };
  }

  await storeConfig(created.id, a.config);
  const checked = await checkHealth(created.id);
  log({ at: "connect.checked", destinationId: created.id, kind: a.kind, actor: a.by.kind, health: checked.health });
  if (checked.health !== "ok") {
    return { ok: false, reason: checked.reason ?? "credentials_invalid" };
  }
  // SPEC §7: "every post on a connected WordPress (read through the connection when it is made and every Monday)", here
  // where the checked connection first exists, so the first page planned knows what the blog covers.
  await indexKnownContent(a.siteId);
  return { ok: true, destinationId: created.id, health: "ok" };
}

/** The known-content refresh `connect` reaches. Never throws: an index that could not be built is rebuilt on Monday. */
async function indexKnownContent(siteId: string): Promise<void> {
  try {
    const { refreshKnownContentFor } = await import("@/lib/known-content");
    await refreshKnownContentFor({ siteId });
  } catch {
    // Monday's pass reads it again.
  }
}

/** Disconnects a destination: its credential is destroyed and nothing further is sent to it. It calls no `unpublish`
 *  and touches no publication row: those rows are half of §9's at-most-once guarantee (ADR-080), and deleting them would
 *  make a reconnect re-attempt every page against a site that already holds the posts. */
export async function disconnect(
  destinationId: string,
  by: Actor
): Promise<{ ok: true; credentialsDestroyed: true }> {
  await destroyConfig(destinationId, new Date());
  log({ at: "disconnect", destinationId, actor: by.kind });
  return { ok: true, credentialsDestroyed: true };
}

export type ReconnectResult =
  | { ok: true; held: number; releasing: boolean }
  | { ok: false; reason: HealthReason };

/** Reconnects a broken destination and says how many pages wait. It publishes nothing: it clears the guard, so with
 *  publishing on they resume in held order under the ceilings, and off they stay held; `releasing` says which.
 *  Re-entering the same credential never clears `cannot_publish`: the check decides, never the submission. */
export async function reconnect(a: {
  destinationId: string;
  config: unknown;
  by: Actor;
}): Promise<ReconnectResult> {
  const row = await readDestination(a.destinationId);
  if (row === null || row.deleted_at !== null) {
    // A disconnected destination is not broken; connecting it again is `connect`.
    return { ok: false, reason: "never_connected" };
  }

  await storeConfig(a.destinationId, a.config);
  const checked = await checkHealth(a.destinationId);
  log({
    at: "reconnect",
    destinationId: a.destinationId,
    kind: row.kind,
    actor: a.by.kind,
    health: checked.health,
  });
  if (checked.health !== "ok") {
    return { ok: false, reason: checked.reason ?? "credentials_invalid" };
  }

  const held = await heldPages(row.site_id);
  return { ok: true, held: held.count, releasing: await isPublishingOn(row.site_id) };
}
