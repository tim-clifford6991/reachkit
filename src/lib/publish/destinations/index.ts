// BUILD §9 — the destination registry: the read model a surface may see,
// and connect / disconnect / reconnect.
//
// A destination is an object with a state, a date it was last checked, one
// action that fixes it, and a queue that holds rather than loses. §9 makes
// that explicit for the credential case — "expired credential is a
// **state** (reconnect prompt, queue holds), not an error loop" — and this
// module is where that shape lives for every case.
//
// **`DestinationView` is the whole of what a surface may see**, and the
// only shape it may see it in. Settings, Overview and the calendar all
// read the same view, so the three cannot come to describe one destination
// differently. There is no field on it that can hold a vendor string and
// no read path here selects `config`.
//
// The adapters themselves are their own issues: hosted is #49 and
// WordPress is #54. `adapterFor` lives in `registry.ts` and is re-exported
// here — the split is ADR-092's, so that `health/` can resolve an adapter
// and this file can call `health/` without either importing the other.
//
// The archived plans are WO-223 … WO-227.
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

/** One line per lifecycle event. Never a credential, never a response body
 *  — a destination id, a kind, a state and who did it (BP-058's
 *  observability budget). */
function log(a: { at: string; destinationId: string; kind?: DestinationKind; actor: Actor["kind"]; health?: string }): void {
  console.log(JSON.stringify({ event: "destination", ...a }));
}

/**
 * A site already has a live destination.
 *
 * A throw and not a `{ ok: false }` arm: the closed reason union describes
 * what a *check* found about a destination, and "this site already has
 * one" is not one of those — it is a caller offering Connect where the
 * surface should have offered Reconnect or Disconnect. Making it a reason
 * would put it in front of the customer as a state of their destination,
 * which it is not.
 *
 * The database refuses it too (`destinations_one_live_per_site`), and that
 * is the guarantee; this is the readable form of the same refusal.
 */
export class AlreadyConnectedError extends Error {
  constructor(siteId: string) {
    super(`src/lib/publish/destinations: site ${siteId} already has a live destination.`);
    this.name = "AlreadyConnectedError";
  }
}

export interface DestinationRow {
  id: string;
  kind: DestinationKind;
  health: "ok" | "expired" | "error";
  config: Readonly<Record<string, unknown>>;
}

/**
 * The site's live destination of a kind, read fresh.
 *
 * Read inside the claim rather than cached: §9 makes an expired credential
 * a state the queue holds against, and a stale health reading is exactly
 * how a page goes out to a destination that had already stopped working.
 *
 * A disconnected destination is not one of these: its credential was
 * destroyed and nothing further is sent to it.
 */
export async function destinationOf(
  siteId: string,
  kind: DestinationKind
): Promise<DestinationRow | null> {
  const { data, error } = await publishDb()
    .from<DestinationRow>("destinations")
    .select("id, kind, health, config")
    .eq("site_id", siteId)
    .eq("kind", kind)
    .is("deleted_at", null)
    .limit(1);
  if (error !== null || data === null) return null;
  const [row] = data;
  return row ?? null;
}

/**
 * The `destination_working` guard's fact: the site has a live destination
 * and it is healthy.
 *
 * `health = 'ok'` and `deleted_at is null` are the whole test. Where it is
 * false the publish attempt fails with `no_destination` — a reason no
 * repeated attempt could clear — and the page comes to rest needing the
 * customer. **There is no fallback destination, ever**: a page goes to the
 * destination the customer chose or it goes nowhere, and the partial
 * unique index means there is no second row one could fall back to.
 */
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

/**
 * Every live destination this site has, as a surface sees it, each with a
 * state no older than the freshness window.
 *
 * The re-check happens here, on the read path, because §9's promise is
 * about the date the customer reads — "never more than 24 hours old
 * whether or not a publish was attempted in between". At most one live
 * destination exists per site, so this does not fan out.
 */
export async function listDestinations(siteId: string): Promise<DestinationView[]> {
  const rows = await liveDestinations(siteId);
  const views = await Promise.all(rows.map((row) => ensureFreshHealth(row.id)));
  return views.filter((view): view is DestinationView => view !== null);
}

export type ConnectResult =
  | { ok: true; destinationId: string; health: "ok" | "expired" | "error" }
  | { ok: false; reason: HealthReason };

/**
 * Connects a destination to a site.
 *
 * **`config: null` is a deferred connection**, and it is an ordinary
 * outcome rather than a failure: the row is created `expired` /
 * `never_connected`, no network call is made and the result is `ok`. That
 * is what setup needs — a founder who has chosen a destination and not yet
 * pointed the record or linked the account has a destination, in a state
 * with one action against it, and their first page is held rather than
 * published somewhere they did not choose.
 *
 * A non-null config is stored sealed and then **validated by the check**,
 * never by the act of connecting. A credential that does not work leaves a
 * destination in the state the check found, with the reason it found — the
 * customer sees it as a state and not as a rejected form.
 */
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
  return { ok: true, destinationId: created.id, health: "ok" };
}

/**
 * Disconnects a destination: its credential is destroyed and nothing
 * further is sent to it.
 *
 * **It calls no `unpublish` and touches no publication row.** Pages
 * already published stay live — they are the customer's, on the
 * customer's site — and the publication rows that record them are half of
 * §9's at-most-once guarantee (ADR-080). Deleting them here is exactly the
 * tidy-up that guarantee exists to forbid: a disconnect-and-reconnect
 * cycle would then start every page over as a first attempt against a
 * destination that already holds the posts.
 */
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

/**
 * Reconnects a broken destination.
 *
 * On success the destination reads as working and the customer is told how
 * many pages are waiting. **Where publishing is on**, those pages resume
 * in the order they were held, under §9's ordinary ceilings — this
 * function publishes nothing itself; it clears the guard that was holding
 * them. Where publishing is switched off, none of them publishes: they
 * stay held, listed and exportable until the customer switches it on, and
 * `releasing` says which of the two happened.
 *
 * **Re-entering the stored credential does not clear
 * `error`/`cannot_publish`, and no branch here makes that true** — the
 * check is what decides health, and it re-runs the same probe against the
 * same credential and finds the same answer. A short-circuit that treated
 * a submitted credential as proof of capability would break it and would
 * pass every other assertion in this module.
 */
export async function reconnect(a: {
  destinationId: string;
  config: unknown;
  by: Actor;
}): Promise<ReconnectResult> {
  const row = await readDestination(a.destinationId);
  if (row === null || row.deleted_at !== null) {
    // A disconnected destination is not a broken one: its credential was
    // destroyed on purpose and connecting it again is `connect`.
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
