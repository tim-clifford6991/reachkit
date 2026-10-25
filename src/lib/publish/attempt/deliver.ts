// BUILD §9 — the approve-and-deliver edge (BP-015): what the engine calls for `publish/execute`. Orchestration only;
// the guards are `machine/`'s, the claim and delivery `./index.ts`'s, the retry policy `./retry.ts`'s.
// Three outcomes, so a page never rests somewhere none describes:
//   · `delivered` — `verifyDue` says whether an address came back for the +24h check; the engine enqueues it, since
//     `src/lib/**` may not import `src/jobs/**` (ARCHITECTURE rule 2).
//   · `held` — §9's holds move no page; it resumes in the order it was held.
//   · `failed` — the retry policy is applied in this same invocation, so no page rests in `failed` unattended.
// The kind is read from the row, never the payload: the claim re-reads the site's live destination at the attempt.
// A due retry is never re-sent from here, since `publish/execute`'s key `(draftId, destinationId)` would dedupe it;
// `./due.ts` finds it on the tick.
import { publishDb } from "../db";
import { capture } from "@/lib/analytics";
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

/** The job makes every move on this edge; whatever sent the event is already in the page's history. */
const BY: Actor = { kind: "system", job: "publish/execute" };

interface DraftSiteRow {
  site_id: string;
}

/** The page's site, for the switch the retry policy reads. */
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
  /** The guard facts as `publish()` takes them, for suites; the engine passes none and the real guards run. */
  deps?: GuardDeps;
}): Promise<ApprovedDelivery> {
  const at = a.at ?? new Date();
  const destination = await readDestination(a.destinationId);

  // A destination gone or disconnected is a hold, as `destination_working` answers, and it goes out on reconnect.
  // `?? null`: a row read without the column is not a disconnected destination.
  if (destination === null || (destination.deleted_at ?? null) !== null) {
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
    // The product event, only on the delivery that made the page live; the subject is the site, hashed in the seam.
    if (!result.alreadyPublished) {
      const siteId = await siteOf(a.draftId);
      await capture("draft_published", { subject: siteId ?? a.draftId });
      // SPEC §7, links both ways: the nearest older live pages are planned an update linking this one; it never fails delivery.
      if (siteId !== null && result.liveUrl !== undefined) {
        const { planLinkBacks } = await import("@/lib/opportunities");
        await planLinkBacks({ siteId, url: result.liveUrl, at });
      }
    }
    return {
      kind: "delivered",
      publicationId: result.publicationId,
      // The address decides, as on the write that set `verify_due_at` (BP-049).
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
