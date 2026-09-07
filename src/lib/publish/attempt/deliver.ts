// BUILD §9 — the approve-and-deliver edge (BP-015).
//
// `publish/execute` carries a draft and a destination id; this is what the
// engine calls with them. It is the *orchestration* of one attempt and
// holds no rule of its own: the edge and its nine guards are
// `machine/`'s, the claim and the delivery are `./index.ts`'s, the retry
// policy is `./retry.ts`'s, and each is called once.
//
// **Three outcomes and no fourth**, because a page must never rest
// somewhere none of them describes:
//
//   · `delivered` — the `publications` row says delivered, the page is
//     `published`, and `verifyDue` says whether an address came back for
//     the +24h check to look at. The *enqueue* is the engine's, not this
//     file's: `src/lib/**` may not import `src/jobs/**` (ARCHITECTURE rule
//     2), and a leaf that sent its own job events would be the arrow
//     pointing the wrong way.
//   · `held` — the switch is off, a ceiling is reached, ReachKit itself is
//     stopped, the claim needs re-checking. §9's holds move no page and
//     this returns none: the page keeps the state it holds and resumes in
//     the order it was held.
//   · `failed` — the outcome was written as it happened and the retry
//     policy has already been applied, in this same invocation. That is
//     what keeps §9's promise that no page rests in `failed` with neither
//     a further attempt due nor the move to `needs_attention` made.
//
// **The kind is read from the row, never from the payload.** The event
// carries a destination *id*; `publish()` claims against a destination
// *kind*, because the claim re-reads the site's live destination at the
// moment of the attempt rather than trusting an id minted when the page
// was approved (`destinations/index.ts` says why). So the id is resolved
// to its kind here and the claim decides the rest.
//
// **A retry that is due is not scheduled from here, and that is named
// rather than faked.** `scheduleRetry` returns the moment a retryable
// failure becomes due again; nothing in this product claims a `failed`
// page at that moment yet — no job has that trigger and
// `publish/execute`'s own idempotency key is `(draftId, destinationId)`,
// so re-sending its event would be deduped rather than delayed. The page
// is left in `failed` with its reason written, which is exactly where
// §9 says it waits, and the scheduler that wakes it is a separate seam.
// Reporting a retry as though it had been queued would be worse than
// saying so.
import { publishDb } from "../db";
import { readDestination } from "../destinations/store";
import type { GuardDeps } from "../machine";
import type { Actor, FailureReason } from "../types";
import { publish } from "./index";
import type { HeldBy } from "./claim";
import { scheduleRetry, type RetryDecision } from "./retry";

export type ApprovedDelivery =
  | { kind: "delivered"; publicationId: string; verifyDue: boolean; alreadyPublished: boolean }
  | { kind: "held"; heldBy: HeldBy }
  | { kind: "failed"; reason: FailureReason; decision: RetryDecision };

/** The actor every move on this edge is recorded under. The job is the
 *  one making them — a customer's approval is what *sent* the event, and
 *  that move is already in the page's own history. */
const BY: Actor = { kind: "system", job: "publish/execute" };

interface DraftSiteRow {
  site_id: string;
}

/** The page's site, for the switch the retry policy reads. One statement,
 *  and the only read this file makes that the calls below do not. */
async function siteOf(draftId: string): Promise<string | null> {
  const { data, error } = await publishDb()
    .from<DraftSiteRow>("drafts")
    .select("site_id")
    .eq("id", draftId)
    .limit(1);
  if (error !== null || data === null) return null;
  return data[0]?.site_id ?? null;
}

export async function deliverApproved(a: {
  draftId: string;
  destinationId: string;
  at?: Date;
  /** The guard facts, injected exactly as `publish()` takes them, so a
   *  suite drives this edge without standing up all nine. The engine
   *  passes none and the real guards run. */
  deps?: GuardDeps;
}): Promise<ApprovedDelivery> {
  const at = a.at ?? new Date();
  const destination = await readDestination(a.destinationId);

  // A destination row that is gone, or was disconnected between the
  // approval and this tick, is a **hold** and not a failure — the same
  // answer the `destination_working` guard gives for a site with none, and
  // the machine has no `approved → needs_attention` edge to take instead.
  // §9's holds move no page: this one keeps its state and goes out when
  // the customer reconnects, which is what the reconnect prompt is for.
  if (destination === null || destination.deleted_at !== null) {
    return { kind: "held", heldBy: "destination_not_working" };
  }

  const result = await publish({
    draftId: a.draftId,
    destination: destination.kind,
    by: BY,
    at,
    ...(a.deps === undefined ? {} : { deps: a.deps }),
  });

  if (result.ok) {
    return {
      kind: "delivered",
      publicationId: result.publicationId,
      // The address decides, exactly as it does on the write that set
      // `verify_due_at` (BP-049): a delivery that came back with one is
      // due for the check, one that did not is not.
      verifyDue: result.liveUrl !== undefined,
      alreadyPublished: result.alreadyPublished,
    };
  }

  if (result.reason === "held") return { kind: "held", heldBy: result.heldBy };

  const decision = await scheduleRetry({
    draftId: a.draftId,
    siteId: (await siteOf(a.draftId)) ?? "",
    reason: result.reason,
    attemptNo: result.attemptNo,
    by: BY,
    at,
    ...(a.deps === undefined ? {} : { deps: a.deps }),
  });
  return { kind: "failed", reason: result.reason, decision };
}
