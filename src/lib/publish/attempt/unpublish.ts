// BUILD §9 — `unpublish()`: available for as long as the page is published.
//
// One edge, five outcomes, and **the edge is the same in all five**.
//
// This function branches on nothing. It reads the page's publication row,
// hands it to the adapter, records the arm that came back, and takes
// `published → unpublished`. Which family of arms applies is the adapter's
// question and is read there from `hostedByUs` — never from
// `servesPublicly`, which is now true at both destinations (ADR-084
// Decision 2). Re-deriving the arm here would agree with the adapter today
// and diverge the first time either changes, which is why the discriminator
// is consulted in exactly one place and this is not it.
//
// `unreachable` is `ok: true` on purpose and takes the edge exactly as the
// other four do: the page did reach `unpublished` and the product did stop
// treating it as live. What failed is the write into a site we do not own,
// and that is the outcome, not a failure of the action. Reading it as a
// failure and holding the page in `published` would leave the customer's
// stop un-taken — the one thing §9 promises in every branch.
//
// **No publication row is ever deleted** (ADR-080 decision 2). The row is
// what proves a page was published; `unpublished_at` is what says it no
// longer is.
//
// `named_for_removal` has no members in production since 2026-09-01 and is
// kept for exactly the reason the union's other empty arm was once kept: it
// is the outcome §9 promises for a page ReachKit created but did not make
// live. A `default:` arm that folded it into `returned_to_draft` would
// break nothing here except the five-arm pass-through test.
//
// The archived plan is WO-214.
import { publishDb } from "../db";
import { adapterFor as defaultAdapterFor } from "../destinations";
import { destinationOf, withConfig } from "../destinations";
import { NoConfigError } from "../destinations/config";
import type { GuardDeps } from "../machine";
import { transition } from "../machine";
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
    reason: "unpublish",
  });

  return result;
}

/**
 * The adapter's `unpublish`, with the credential in plaintext for the
 * duration of that one call and not one moment longer.
 *
 * `withConfig` returns what the callback returns and never the config, so
 * this function cannot leak one however it is edited. A destination whose
 * credential has been destroyed — disconnected since the page was
 * published — is called with an empty config rather than not at all: the
 * arm the adapter takes for a page it never made live writes nothing and
 * needs no credential, and the customer's stop is taken either way.
 */
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

/** The row as the adapter reads it. A mapping and nothing else: every
 *  member is carried across, none is compared with anything here. */
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
