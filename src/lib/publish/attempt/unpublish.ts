// BUILD §9 — `unpublish()`, available as long as the page is published: one edge, five outcomes, the same edge in all five.
// It branches on nothing: the adapter picks the arm (from `hostedByUs`, never `servesPublicly`, ADR-084 decision 2),
// and the discriminator is consulted in exactly one place, which is not here.
// `unreachable` is `ok: true` and takes the edge: holding the page in `published` would leave the customer's stop un-taken.
// No publication row is ever deleted (ADR-080 decision 2): the row proves a page was published, `unpublished_at` that it no longer is.
// `named_for_removal` has no members today and is kept: §9 promises it for a page we created but did not make live.
import { publishDb } from "../db";
import { adapterFor as defaultAdapterFor } from "../destinations";
import { destinationOf, withConfig } from "../destinations";
import { NoConfigError } from "../destinations/config";
import type { GuardDeps } from "../machine";
import { transition } from "../machine";
import type { AnnounceSend } from "../destinations/hosted/announce";
import type {
  Actor,
  DestinationAdapter,
  DestinationKind,
  Publication,
  UnpublishResult,
} from "../types";

export interface UnpublishArgs {
  draftId: string;
  by: Actor;
  at?: Date;
  deps?: GuardDeps;
  adapterFor?: (destination: DestinationKind) => DestinationAdapter | null;
  /** How the change is announced (`../destinations/hosted/announce.ts`), injected so a suite answers for the network. */
  announce?: AnnounceSend;
  /** The reason the move is recorded under; `unpublish` unless named, `take_down` for the customer's take-down. */
  reason?: string;
  /** `false` where another version at the same address announces it: one request an address. */
  announceAddress?: boolean;
}

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

export async function unpublish(a: UnpublishArgs): Promise<UnpublishResult> {
  const at = a.at ?? new Date();
  const resolve = a.adapterFor ?? defaultAdapterFor;

  const row = await readPublication(a.draftId);
  if (row === null) return { ok: false, reason: "no_destination" };

  const destination = row.destination as DestinationKind;
  const adapter = resolve(destination);
  if (adapter === null) return { ok: false, reason: "no_destination" };

  const connection = await destinationOf(row.site_id, destination);
  const result = await takenDown(adapter, toPublication(row), connection?.id ?? null);

  if (!result.ok) return result;

  await publishDb()
    .from<{ id: string }>("publications")
    .update({
      unpublished_at: at.toISOString(),
      unpublish_outcome: result.outcome,
    })
    .eq("id", row.id);

  await transition(a.draftId, "unpublished", a.by, {
    at,
    ...(a.deps === undefined ? {} : { deps: a.deps }),
    reason: a.reason ?? "unpublish",
  });

  // SPEC §7: the address now answering 410 is announced once so engines drop it; it never blocks the stop.
  if (destination === "hosted" && row.live_url !== null && a.announceAddress !== false) {
    const { announceHosted } = await import("../destinations/hosted/announce");
    await announceHosted({ siteId: row.site_id, urls: [row.live_url], ...(a.announce === undefined ? {} : { send: a.announce }) });
  }

  return result;
}

/** The adapter's `unpublish`, with the credential plaintext for that one call. A destroyed credential gets an empty
 *  config rather than no call, so the customer's stop is taken either way. */
async function takenDown(
  adapter: DestinationAdapter,
  pub: Publication,
  destinationId: string | null
): Promise<UnpublishResult> {
  if (destinationId === null) return adapter.unpublish(pub, {});
  try {
    return await withConfig(destinationId, (cfg: Record<string, unknown>) =>
      adapter.unpublish(pub, cfg)
    );
  } catch (cause) {
    if (cause instanceof NoConfigError) return adapter.unpublish(pub, {});
    throw cause;
  }
}

async function readPublication(draftId: string): Promise<PublicationRow | null> {
  const { data, error } = await publishDb()
    .from<PublicationRow>("publications")
    .select("*")
    .eq("draft_id", draftId)
    .limit(1);
  if (error !== null || data === null) return null;
  const [row] = data;
  return row ?? null;
}

/** The row as the adapter reads it: a mapping, comparing nothing. */
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
