// BUILD §9 — the claim: the one place a publish attempt is taken, and the
// conflict clause that refuses only a delivered row.
//
// ADR-080 (2026-08-31), the ruling this file exists to serve: "The
// `publications` row (written before the destination call) plus the
// destination-side marker are the at-most-once guarantee; neither may be
// tidied away."
//
// Order, and every step of it is load-bearing:
//
//   1. `transition()` to `publishing` — which evaluates the named guards
//      for whichever edge applies, so the switch, the ceilings, the
//      destination, the publishable rule and the telling are all checked
//      **here, at the moment of the attempt**, and in exactly one place.
//      A refusal is turned into the word that says which of them held it.
//   2. the `publications` row — written **before** the adapter is called,
//      never after. A row written after the delivery would guarantee
//      nothing: it is the row that a crashed attempt leaves behind for the
//      next one to find.
//   3. nothing else. **The adapter is not called from this file** — that is
//      `publish()`'s, after this has committed, and the split is visible in
//      the module graph rather than only in a comment.
//
// **The switch is read where the decision is made.** §9's "instant" is
// exactly that: `publishing_switch_on` is a guard on every edge whose
// target is `publishing`, evaluated inside this call, so an invocation that
// began before the switch was recorded and reaches here after it is
// refused.
//
// **A deviation flagged once (and not fabricated around).** The archived
// plan writes the claim as one SQL statement —
// `insert … on conflict (draft_id, destination) do update set attempt_no =
// attempt_no + 1, claimed_at = now() where publications.delivery_state <>
// 'delivered' returning id` — inside one serialisable transaction. The only
// client any code here may hold is a PostgREST client (`dbAdmin()`), where
// each `.from(...)` is its own HTTP request and its own implicit
// transaction and that clause is not expressible; `src/lib/scan/admission.ts`
// documents the same limitation for `claimFreeScanSlot`. So the clause is
// reached by two mechanisms Postgres enforces atomically regardless of the
// calling transaction's isolation level, rather than by an isolation level
// this client cannot request:
//
//   - **at-most-once** is `idx_publications_one_per_draft_destination`
//     (`20260906120000_publications_core.sql`). Two attempts racing from two
//     processes can both find no row; only one of their inserts can ever
//     succeed, and the loser is rejected by the database and re-reads.
//   - **"refuses only a delivered row"** is carried on the *update itself*
//     (`.neq('delivery_state', 'delivered')`), not on the read before it —
//     so a delivery that lands between the read and the write still wins,
//     and the claim is told it did.
//
// Two edits here would each look like tidying and each would break ADR-080:
//
//   - `do nothing` on conflict — it refuses the legitimate retry of an
//     attempt that failed, which §9 requires to be retried three times.
//   - adding `made_live_by_us` or `live_url` to the update's `set` list. A
//     re-claim of a `failed` row would reset the discriminator, and on the
//     day a page can be made live at a destination we do not own, that
//     turns "ReachKit never made this page live" into "ReachKit made it
//     live" silently, on a retry, with every test green.
//
// The archived plan is WO-212.
import { publishDb } from "../db";
import { destinationOf } from "../destinations";
import type { GuardDeps } from "../machine";
import { transition } from "../machine";
import type { Actor, DestinationKind } from "../types";
import { ceilingRoom } from "../ceilings";

/** Why an attempt did not begin. Every member is a **hold** — the page
 *  keeps the state it holds and is never skipped, discarded or moved to
 *  needs-attention on account of one. */
export type HeldBy =
  | "switch_off"
  | "ceiling_day"
  | "ceiling_week"
  | "zone_not_set"
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
      /** The row the credential is sealed on. **Not the credential**: the
       *  claim never holds one, and the delivery reads it through
       *  `withConfig` for the duration of the one call it is needed in
       *  (issue #54). A claim that carried the config would be the
       *  ciphertext travelling as though it were the plaintext, which is
       *  what it used to be. */
      destinationId: string;
    }
  | { ok: false; reason: "held"; heldBy: HeldBy };

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
  sites?: { mode?: string | null } | null;
}

/** Postgres' unique-violation SQLSTATE. A losing insert is not an error
 *  this code handles by guessing — it re-reads and finds the winner's row. */
const UNIQUE_VIOLATION = "23505";

export async function claim(a: ClaimArgs): Promise<ClaimResult> {
  const at = a.at ?? new Date();

  const draft = await loadDraft(a.draftId);
  if (draft === null) return { ok: false, reason: "held", heldBy: "not_publishable" };

  const destination = await destinationOf(draft.site_id, a.destination);

  // 1. The move. Every guard on the edge is evaluated here, by the one
  //    thing that owns them.
  const moved = await transition(a.draftId, "publishing", a.by, {
    at,
    ...(a.deps === undefined ? {} : { deps: a.deps }),
    reason: "publish/execute",
  });
  if (!moved.ok) {
    return { ok: false, reason: "held", heldBy: await heldWord(moved.failedGuard, draft.site_id, at) };
  }

  // 2. The row, before any destination call.
  const mode = draft.approved_at !== null || draft.sites?.mode === "copilot" ? "approved" : "autopilot";
  const existing = await readPublication(a.draftId, a.destination);

  if (existing === null) {
    const inserted = await insertPublication({
      draftId: a.draftId,
      siteId: draft.site_id,
      destination: a.destination,
      mode,
      claimedAt: at,
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
    // The insert lost the unique index to a concurrent claim. The winner's
    // row is the one that exists; re-read and continue as a retry would.
  }

  const row = existing ?? (await readPublication(a.draftId, a.destination));
  if (row === null) {
    // Neither our insert nor a re-read produced a row: something other than
    // a race refused the write. Nothing was claimed, so nothing is claimed.
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

  // The conflict clause, carried on the write: only a row that is not
  // already delivered may be re-claimed, and `made_live_by_us` and
  // `live_url` appear in no `set` list here.
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

/** The guard that refused, as the word a surface can act on. `within_ceilings`
 *  is asked which ceiling it was — the day and the week lift at different
 *  moments and a customer is owed the one that applies. */
async function heldWord(
  failedGuard: string | undefined,
  siteId: string,
  at: Date
): Promise<HeldBy> {
  switch (failedGuard) {
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
      return "ceiling_day";
    }
    default:
      return "not_publishable";
  }
}

async function loadDraft(draftId: string): Promise<DraftRow | null> {
  const { data, error } = await publishDb()
    .from<DraftRow>("drafts")
    .select("id, site_id, state, approved_at, sites(mode)")
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

async function insertPublication(a: {
  draftId: string;
  siteId: string;
  destination: DestinationKind;
  mode: "approved" | "autopilot";
  claimedAt: Date;
}): Promise<{ id: string } | null> {
  const { data, error } = await publishDb()
    .from<{ id: string }>("publications")
    .insert({
      draft_id: a.draftId,
      site_id: a.siteId,
      destination: a.destination,
      mode: a.mode,
      delivery_state: "claimed",
      attempt_no: 1,
      claimed_at: a.claimedAt.toISOString(),
      // `made_live_by_us` is written at its column default, `false`, and is
      // named in no `set` list on either limb: at claim time no delivery has
      // happened, so nothing is yet known about whether ReachKit made the
      // page live, and `false` is the only honest value. Setting it here
      // from the destination's kind would be right today and would still be
      // the wrong fact — the discriminator is what *this call did to this
      // page*, not a property of the destination.
    })
    .select("id");
  if (error !== null) {
    if (error.code === UNIQUE_VIOLATION) return null;
    return null;
  }
  const [row] = data ?? [];
  return row ?? null;
}
