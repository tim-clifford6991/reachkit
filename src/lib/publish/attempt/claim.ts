// BUILD §9 — the claim: the one place a publish attempt is taken, and the conflict clause that refuses only a delivered
// row. ADR-080: "The `publications` row (written before the destination call) plus the destination-side marker are the
// at-most-once guarantee; neither may be tidied away." In order:
//   1. `transition()` to `publishing` evaluates every guard here, at the moment of the attempt, in one place, so a
//      switch recorded before this call refuses it (§9's "instant"); a refusal becomes the word naming the guard.
//   2. the `publications` row, written before the adapter is called, never after: it is what a crashed attempt leaves.
//   3. nothing else: the adapter is `publish()`'s, after this commits.
// PostgREST cannot express `insert … on conflict … where delivery_state <> 'delivered'` in one transaction, so two
// mechanisms Postgres enforces atomically carry it:
//   - at-most-once is `idx_publications_one_per_draft_destination`: of two racing inserts one wins, the loser re-reads;
//   - "refuses only a delivered row" rides the update itself (`.neq('delivery_state', 'delivered')`), so a delivery
//     landing between read and write still wins.
// Two tidy-looking edits break ADR-080: `do nothing` on conflict, which refuses §9's three retries; and adding
// `made_live_by_us` or `live_url` to the update's `set` list, which would reset the discriminator on a retry.
import { publishDb } from "../db";
import { destinationOf } from "../destinations";
import type { GuardDeps } from "../machine";
import { transition } from "../machine";
import type { Actor, DestinationKind } from "../types";
import { ceilingRoom } from "../ceilings";

/** Why an attempt did not begin. Every member is a hold: the page keeps its state, never skipped or moved. */
export type HeldBy =
  /** BUILD §8 hard rule 4 · REQ-053 c5 — a forbidden claim, or a check against a list since changed; it clears when a
   *  re-check passes against the list in force. */
  | "claim_recheck"
  | "switch_off"
  | "ceiling_day"
  | "ceiling_week"
  | "zone_not_set"
  /** The ceilings could not be counted: held, never counted as none published. */
  | "ceiling_unreadable"
  | "destination_not_working"
  | "not_publishable"
  | "telling_owed"
  | "hard_rules_not_passed";

export type ClaimResult =
  | {
      ok: true;
      publicationId: string;
      alreadyPublished: boolean;
      attemptNo: number;
      /** The row the credential is sealed on, never the credential; the delivery reads it through `withConfig`. */
      destinationId: string;
    }
  | {
      ok: false;
      reason: "held";
      heldBy: HeldBy;
      /** On `claim_recheck` only, where the last check named an entry: the customer's own words, rendered through
       *  `draft.claim.matched`. Absent for a stale list hash, so no claim is attributed to them. */
      matchedEntry?: string;
    };

export interface ClaimArgs {
  draftId: string;
  destination: DestinationKind;
  by: Actor;
  at?: Date;
  deps?: GuardDeps;
}

interface PublicationRow {
  id: string;
  draft_id: string;
  destination: string;
  delivery_state: string;
  attempt_no: number;
  site_id: string;
}

interface DraftRow {
  id: string;
  site_id: string;
  state: string;
  approved_at: string | null;
  opportunity_id: string | null;
  sites?: { mode?: string | null } | null;
}

/** Postgres' unique-violation SQLSTATE: a losing insert re-reads the winner's row. */
const UNIQUE_VIOLATION = "23505";

export async function claim(a: ClaimArgs): Promise<ClaimResult> {
  const at = a.at ?? new Date();

  const draft = await loadDraft(a.draftId);
  if (draft === null) return { ok: false, reason: "held", heldBy: "not_publishable" };

  const destination = await destinationOf(draft.site_id, a.destination);

  // 1. The move: every guard on the edge, evaluated by the one thing that owns them.
  const moved = await transition(a.draftId, "publishing", a.by, {
    at,
    ...(a.deps === undefined ? {} : { deps: a.deps }),
    reason: "publish/execute",
  });
  if (!moved.ok) {
    return {
      ok: false,
      reason: "held",
      heldBy: await heldWord(moved.failedGuard, draft.site_id, at),
      // From the refusal itself: a second read could name a different entry than the one that held the page.
      ...(moved.matchedEntry === undefined ? {} : { matchedEntry: moved.matchedEntry }),
    };
  }

  // 2. The row, before any destination call.
  const mode = draft.approved_at !== null ? "approved" : "autopilot";
  const existing = await readPublication(a.draftId, a.destination);

  if (existing === null) {
    const inserted = await insertPublication({
      draftId: a.draftId,
      siteId: draft.site_id,
      destination: a.destination,
      mode,
      claimedAt: at,
      acceptance: await acceptanceAtPublish(draft.opportunity_id),
    });
    if (inserted !== null) {
      return {
        ok: true,
        publicationId: inserted.id,
        alreadyPublished: false,
        attemptNo: 1,
        destinationId: destination?.id ?? "",
      };
    }
    // Lost the unique index to a concurrent claim: re-read the winner's row and continue as a retry.
  }

  const row = existing ?? (await readPublication(a.draftId, a.destination));
  if (row === null) {
    // Something other than a race refused the write, so nothing is claimed.
    return { ok: false, reason: "held", heldBy: "destination_not_working" };
  }

  if (row.delivery_state === "delivered") {
    return {
      ok: true,
      publicationId: row.id,
      alreadyPublished: true,
      attemptNo: row.attempt_no,
      destinationId: destination?.id ?? "",
    };
  }

  // The conflict clause on the write: only an undelivered row is re-claimed; `made_live_by_us` and `live_url` are in no `set` list.
  const attemptNo = row.attempt_no + 1;
  const { error } = await publishDb()
    .from<PublicationRow>("publications")
    .update({
      delivery_state: "claimed",
      attempt_no: attemptNo,
      claimed_at: at.toISOString(),
    })
    .eq("id", row.id)
    .neq("delivery_state", "delivered");

  if (error !== null) {
    return { ok: false, reason: "held", heldBy: "destination_not_working" };
  }

  return {
    ok: true,
    publicationId: row.id,
    alreadyPublished: false,
    attemptNo,
    destinationId: destination?.id ?? "",
  };
}

/** The refusing guard as a word a surface can act on; the ceilings say which, as day and week lift at different moments. */
async function heldWord(
  failedGuard: string | undefined,
  siteId: string,
  at: Date
): Promise<HeldBy> {
  switch (failedGuard) {
    case "no_outstanding_claim_recheck":
      return "claim_recheck";
    case "publishing_switch_on":
      return "switch_off";
    case "destination_working":
      return "destination_not_working";
    case "customer_told":
      return "telling_owed";
    case "draft_passed_hard_rules":
      return "hard_rules_not_passed";
    case "within_ceilings": {
      const room = await ceilingRoom(siteId, at);
      if (room.room) return "ceiling_day";
      if (room.blockedBy === "week") return "ceiling_week";
      if (room.blockedBy === "zone_not_set") return "zone_not_set";
      if (room.blockedBy === "unreadable") return "ceiling_unreadable";
      return "ceiling_day";
    }
    default:
      return "not_publishable";
  }
}

async function loadDraft(draftId: string): Promise<DraftRow | null> {
  const { data, error } = await publishDb()
    .from<DraftRow>("drafts")
    .select("id, site_id, state, approved_at, opportunity_id, sites(mode)")
    .eq("id", draftId)
    .single();
  if (error !== null || data === null) return null;
  return data;
}

async function readPublication(
  draftId: string,
  destination: DestinationKind
): Promise<PublicationRow | null> {
  const { data, error } = await publishDb()
    .from<PublicationRow>("publications")
    .select("id, draft_id, destination, delivery_state, attempt_no, site_id")
    .eq("draft_id", draftId)
    .eq("destination", destination)
    .limit(1);
  if (error !== null || data === null) return null;
  const [row] = data;
  return row ?? null;
}

/** The acceptance test the page is judged by, recorded at claim (SPEC §6) so the weekly verdict never reads the
 *  opportunity back: its own test, else "top 20 for" its search, `null` with neither. */
async function acceptanceAtPublish(opportunityId: string | null): Promise<unknown> {
  if (opportunityId === null) return null;
  const { data, error } = await publishDb()
    .from<{ acceptance: unknown; target_query: string | null }>("opportunities")
    .select("acceptance, target_query")
    .eq("id", opportunityId)
    .limit(1);
  const row = error === null ? data?.[0] : undefined;
  if (row === undefined) return null;
  const query = row.target_query?.trim() ?? "";
  return row.acceptance ?? (query === "" ? null : { form: "top20", query });
}

async function insertPublication(a: {
  draftId: string;
  siteId: string;
  destination: DestinationKind;
  mode: "approved" | "autopilot";
  claimedAt: Date;
  acceptance: unknown;
}): Promise<{ id: string } | null> {
  const { data, error } = await publishDb()
    .from<{ id: string }>("publications")
    .insert({
      draft_id: a.draftId,
      site_id: a.siteId,
      destination: a.destination,
      mode: a.mode,
      acceptance: a.acceptance,
      delivery_state: "claimed",
      attempt_no: 1,
      claimed_at: a.claimedAt.toISOString(),
      // `made_live_by_us` stays at its default `false`: nothing is delivered yet, and the discriminator is what this
      // call did to the page, never a property of the destination's kind.
    })
    .select("id");
  if (error !== null) {
    if (error.code === UNIQUE_VIOLATION) return null;
    return null;
  }
  const [row] = data ?? [];
  return row ?? null;
}
