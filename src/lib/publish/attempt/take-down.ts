// SPEC §7 — the customer takes one live page down, and puts it back within `TAKE_DOWN.PUT_BACK_DAYS`.
// Take down is `unpublish()` with the customer as actor and reason `take_down`, for every live version at the address,
// since a refresh leaves older ones live beside it. Setting `unpublished_at` is what makes the hosted row answer 410
// and drops it from the sitemap, feed and links; a WordPress post returns to draft, and a failed write re-checks health.
// Its topic is dropped for good and an unsent refresh of the address is stopped: the system never puts the page back.
// Put back is §9's `unpublished → published`: the customer only, after their own take-down, hosted only, since
// re-publishing a WordPress post is a call ADR-084 decision 1 keeps out of that client. The destination is asked first,
// then each row's `unpublished_at` is cleared and each draft takes the edge. No row is deleted and no text edited (ADR-080).
import { publishDb } from "../db";
import { adapterFor as defaultAdapterFor, destinationOf, withConfig } from "../destinations";
import { NoConfigError } from "../destinations/config";
import type { AnnounceSend } from "../destinations/hosted/announce";
import { transition } from "../machine";
import { canPutBack, PUT_BACK_REASON, RESTORABLE, TAKE_DOWN_REASON } from "../take-down/standing";
import type {
  Actor,
  DestinationAdapter,
  DestinationKind,
  Publication,
  RestoreResult,
  State,
  UnpublishOutcome,
  UnpublishResult,
} from "../types";
import { unpublish } from "./unpublish";

export interface TakeDownDeps {
  adapterFor?: (destination: DestinationKind) => DestinationAdapter | null;
  announce?: AnnounceSend;
  /** Re-checks a destination's health after a failed write; defaults to the usual health check. */
  recheckHealth?: (destinationId: string) => Promise<void>;
}

export type TakeDownResult = { ok: true } | { ok: false; refused: "not_live" | "failed" };
export type PutBackResult = { ok: true } | { ok: false; refused: "not_open" | "address_taken" | "failed" };

interface PublicationRow {
  id: string;
  draft_id: string;
  site_id: string;
  destination: string;
  delivery_state: string;
  attempt_no: number;
  claimed_at: string;
  published_at: string | null;
  unpublished_at: string | null;
  live_url: string | null;
  remote_id: string | null;
  failure_reason: string | null;
  mode: string;
  unpublish_outcome: string | null;
  made_live_by_us: boolean;
  verify_due_at: string | null;
}

/** States a refresh that has not gone out can be stopped from. */
const STOPPABLE: readonly State[] = ["planned", "in_review", "needs_attention"];

export async function takeDown(a: { draftId: string; userId: string; at?: Date; deps?: TakeDownDeps }): Promise<TakeDownResult> {
  const at = a.at ?? new Date();
  const by: Actor = { kind: "customer", userId: a.userId };
  const row = (await publicationsOf("draft_id", a.draftId)).find(isLive);
  if (row === undefined || row.live_url === null) return { ok: false, refused: "not_live" };

  const versions = (await publicationsAt(row.site_id, row.live_url)).filter(isLive);
  const results: UnpublishResult[] = [];
  for (const [index, version] of versions.entries()) {
    results.push(
      await unpublish({
        draftId: version.draft_id,
        by,
        at,
        reason: TAKE_DOWN_REASON,
        announceAddress: index === 0,
        ...(a.deps?.adapterFor === undefined ? {} : { adapterFor: a.deps.adapterFor }),
        ...(a.deps?.announce === undefined ? {} : { announce: a.deps.announce }),
      })
    );
  }
  if (results.some((result) => !result.ok || result.outcome === "unreachable")) {
    await recheckHealthOf(row.site_id, row.destination, a.deps);
  }
  const down = versions.filter((_, index) => results[index]?.ok === true).map((version) => version.draft_id);
  if (down.length === 0) return { ok: false, refused: "failed" };

  // After the move, never undoing it: the page is down whether or not these rows are written.
  try {
    const own = await opportunitiesOf(down);
    await stopRefreshesOf(row.site_id, row.live_url, own, by, at);
    await dropTopics(own);
  } catch (error) {
    console.log(JSON.stringify({ event: "take_down_settle_failed", draftId: a.draftId, because: String(error) }));
  }
  return { ok: true };
}

export async function putBack(a: { draftId: string; userId: string; at?: Date; deps?: TakeDownDeps }): Promise<PutBackResult> {
  const at = a.at ?? new Date();
  const by: Actor = { kind: "customer", userId: a.userId };
  const draft = (await draftsOf([a.draftId]))[0];
  if (draft === undefined || draft.state !== "unpublished" || !canPutBack(draft.transitions, at)) {
    return { ok: false, refused: "not_open" };
  }
  const row = (await publicationsOf("draft_id", a.draftId)).find(
    (each) =>
      each.live_url !== null &&
      each.unpublished_at !== null &&
      RESTORABLE.includes(each.unpublish_outcome as UnpublishOutcome)
  );
  if (row === undefined || row.live_url === null) return { ok: false, refused: "not_open" };

  // The versions the one take-down took down, at the same instant.
  const atAddress = await publicationsAt(row.site_id, row.live_url);
  if (atAddress.some(isLive)) return { ok: false, refused: "address_taken" };
  const taken = atAddress.filter(
    (each) => each.unpublished_at !== null && Date.parse(each.unpublished_at) === Date.parse(row.unpublished_at!)
  );
  const open = new Set(
    (await draftsOf(taken.map((each) => each.draft_id)))
      .filter((each) => each.state === "unpublished" && canPutBack(each.transitions, at))
      .map((each) => each.id)
  );
  const versions = taken.filter((each) => open.has(each.draft_id));

  const destination = row.destination as DestinationKind;
  const adapter = (a.deps?.adapterFor ?? defaultAdapterFor)(destination);
  const restored = adapter?.restore === undefined ? null : await restoreAt(adapter, row);
  if (restored === null || !restored.ok) {
    await recheckHealthOf(row.site_id, row.destination, a.deps);
    return { ok: false, refused: "failed" };
  }

  for (const version of versions) {
    await publishDb()
      .from<{ id: string }>("publications")
      .update({ unpublished_at: null, unpublish_outcome: null })
      .eq("id", version.id);
    await transition(version.draft_id, "published", by, { at, reason: PUT_BACK_REASON });
  }

  if (destination === "hosted") {
    const { announceHosted } = await import("../destinations/hosted/announce");
    await announceHosted({ siteId: row.site_id, urls: [row.live_url], ...(a.deps?.announce === undefined ? {} : { send: a.deps.announce }) });
  }
  return { ok: true };
}

function isLive(row: PublicationRow): boolean {
  return row.live_url !== null && row.published_at !== null && row.unpublished_at === null;
}

async function publicationsOf(column: "draft_id", value: string): Promise<PublicationRow[]> {
  const { data, error } = await publishDb().from<PublicationRow>("publications").select("*").eq(column, value);
  return error !== null || data === null ? [] : data;
}

/** Every publication of the site at one address, newest first. */
async function publicationsAt(siteId: string, liveUrl: string): Promise<PublicationRow[]> {
  const { data, error } = await publishDb()
    .from<PublicationRow>("publications")
    .select("*")
    .eq("site_id", siteId)
    .eq("live_url", liveUrl);
  if (error !== null || data === null) return [];
  return [...data].sort((x, y) => (y.published_at ?? "").localeCompare(x.published_at ?? ""));
}

interface DraftRow {
  id: string;
  state: State;
  transitions: unknown;
  opportunity_id: string | null;
}

async function draftsOf(ids: readonly string[]): Promise<DraftRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await publishDb()
    .from<DraftRow>("drafts")
    .select("id, state, transitions, opportunity_id")
    .in("id", [...ids]);
  return error !== null || data === null ? [] : data;
}

/** The topics of pages the system withdrew (`content/recheck`) rest as a stopped one's do, never left `queued`, which
 *  would hold their search and cluster for ever. */
export async function restTopicsOfDrafts(draftIds: readonly string[], until: Date): Promise<void> {
  await restTopics(await opportunitiesOf(draftIds), until);
}

/** The topics of pages withdrawn as off the site's topic are dismissed, never left `queued`. */
export async function dismissTopicsOfDrafts(draftIds: readonly string[]): Promise<void> {
  const ids = await opportunitiesOf(draftIds);
  if (ids.length === 0) return;
  const { error } = await publishDb()
    .from<{ id: string }>("opportunities")
    .update({ status: "dismissed" })
    .in("id", [...ids])
    .in("status", ["open", "queued"]);
  if (error !== null) throw new Error(`take-down: dismissing topics: ${error.message}`);
}

/** The distinct rows these drafts were written for. */
async function opportunitiesOf(draftIds: readonly string[]): Promise<string[]> {
  const drafts = await draftsOf(draftIds);
  return [...new Set(drafts.flatMap((draft) => (draft.opportunity_id === null ? [] : [draft.opportunity_id])))];
}

/** Dropped for good, as a stopped topic is, `done` included: the customer did not want a page on it. */
async function dropTopics(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await publishDb()
    .from<{ id: string }>("opportunities")
    .update({ status: "dismissed", stopped: true })
    .in("id", [...ids])
    .in("status", ["open", "queued", "done"]);
  if (error !== null) throw new Error(`take-down: dropping topics: ${error.message}`);
}

/** A withdrawn page's topic rests, `open` and holding its place in the unique index until the rest is over. */
async function restTopics(ids: readonly string[], until: Date): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await publishDb()
    .from<{ id: string }>("opportunities")
    .update({ status: "open", rest_until: until.toISOString(), ready: false, unready_reason: "resting" })
    .in("id", [...ids])
    .in("status", ["open", "queued", "done"]);
  if (error !== null) throw new Error(`take-down: resting topics: ${error.message}`);
}

/** An unsent refresh of the address would put the page back without the customer: its draft is stopped and an
 *  unwritten row dismissed. The taken-down versions' own rows are not among them. */
async function stopRefreshesOf(siteId: string, liveUrl: string, own: readonly string[], by: Actor, at: Date): Promise<void> {
  const db = publishDb();
  const { data } = await db
    .from<{ id: string }>("opportunities")
    .select("id")
    .eq("site_id", siteId)
    .eq("type", "refresh_page")
    .eq("target_ref", liveUrl)
    .in("status", ["open", "queued"]);
  const ids = (data ?? []).map((row) => row.id).filter((id) => !own.includes(id));
  if (ids.length === 0) return;
  const { data: drafts } = await db
    .from<{ id: string; state: State; opportunity_id: string }>("drafts")
    .select("id, state, opportunity_id")
    .in("opportunity_id", ids);
  for (const draft of drafts ?? []) {
    if (STOPPABLE.includes(draft.state)) await transition(draft.id, "skipped", by, { at, reason: TAKE_DOWN_REASON });
  }
  const written = new Set((drafts ?? []).map((draft) => draft.opportunity_id));
  const { opportunityStore } = await import("@/lib/opportunities/store");
  for (const id of ids) if (!written.has(id)) await opportunityStore().markDismissed(id);
}

/** The adapter's `restore`, with the credential plaintext for that one call, as in `unpublish()`. */
async function restoreAt(adapter: DestinationAdapter, row: PublicationRow): Promise<RestoreResult> {
  const restore = adapter.restore!;
  const pub = toPublication(row);
  const connection = await destinationOf(row.site_id, row.destination as DestinationKind);
  if (connection === null) return restore(pub, {});
  try {
    return await withConfig(connection.id, (cfg: Record<string, unknown>) => restore(pub, cfg));
  } catch (cause) {
    if (cause instanceof NoConfigError) return restore(pub, {});
    throw cause;
  }
}

/** A failed write into the customer's WordPress shows as its health, as every fault there does. */
async function recheckHealthOf(siteId: string, destination: string, deps: TakeDownDeps | undefined): Promise<void> {
  if (destination !== "wordpress") return;
  try {
    const connection = await destinationOf(siteId, "wordpress");
    if (connection === null) return;
    if (deps?.recheckHealth !== undefined) return await deps.recheckHealth(connection.id);
    const { checkHealth } = await import("../destinations/health/check");
    await checkHealth(connection.id);
  } catch (error) {
    console.log(JSON.stringify({ event: "take_down_health_failed", siteId, because: String(error) }));
  }
}

function toPublication(row: PublicationRow): Publication {
  return {
    id: row.id,
    draftId: row.draft_id,
    siteId: row.site_id,
    destination: row.destination as Publication["destination"],
    deliveryState: row.delivery_state as Publication["deliveryState"],
    attemptNo: row.attempt_no,
    claimedAt: new Date(row.claimed_at),
    publishedAt: row.published_at === null ? null : new Date(row.published_at),
    unpublishedAt: row.unpublished_at === null ? null : new Date(row.unpublished_at),
    liveUrl: row.live_url,
    remoteId: row.remote_id,
    failureReason: row.failure_reason as Publication["failureReason"],
    mode: row.mode as Publication["mode"],
    unpublishOutcome: row.unpublish_outcome as Publication["unpublishOutcome"],
    madeLiveByUs: row.made_live_by_us,
    verifyDueAt: row.verify_due_at === null ? null : new Date(row.verify_due_at),
  };
}
