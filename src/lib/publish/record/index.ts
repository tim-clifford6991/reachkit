// BUILD §9 — the one read behind every surface that states a published
// page's standing.
//
// Read-only: it takes no transition, writes no row and repairs nothing.
//
// **The address's label is decided by the page's current state, not by what
// ReachKit once did to it, and that is a bug fix rather than a
// refinement.** REQ-056 criterion 6 used to split on whether ReachKit
// *made* the page live — a fact about the past — and hung its "never an
// address that does not resolve to that page" guard on that split. A page
// ReachKit published and then took down stayed in the first arm and was
// shown "the address it is publicly readable at" for a page that is not.
// The two arms were not disjoint. The fixture that carries one page through
// the `published → unpublished` edge is what holds the fix: an
// implementation splitting on `made_live_by_us` passes every static fixture
// and fails that one.
//
// The guard has changed meaning with it, and the new meaning is the honest
// one: it is no longer a promise that the address resolves — ReachKit
// cannot verify that and never looks again — but a ban on claiming liveness
// at an address ReachKit itself stopped serving or asked the customer's
// site to stop serving.
//
// **`verification` is not optional, and that is the whole mechanism —
// ADR-085 Decision 5.** REQ-062 criterion 7 is a law over surfaces, not a
// field: wherever any surface states a page's state, it carries the
// recorded outcome and its date alongside. It is enforced by there being
// one place to read a page's observed standing, returning the state and the
// outcome **inside the same value** with neither field optional. A surface
// cannot obtain the state without the outcome, because they are one object.
// That is the same mechanism `Measured<T>` uses for REQ-004: the promise
// holds on surfaces that do not exist yet, because the type will not let
// them render without it. A rule each surface follows is a rule two of them
// will stop following — and there are three.
//
// **`page_not_found` and `could_not_confirm` reach this record as two
// values and must leave it as two — ADR-085 (landmine).** They render as
// the same grey line and have opposite consequences: one stops the page
// being shown as live and retires it from weekly judgement, the other
// leaves the page's publish state unchanged and still shown as it was. The
// merge will be proposed by whoever is looking at two identical grey lines
// on a day panel; the paired fixture in
// `tests/publish/record/record.test.ts` is what fails when they do.
//
// The archived plan is WO-263.
import type { CopyKey } from "@/lib/presentation/copy";
import { publishDb } from "../db";
import type { State, UnpublishOutcome, VerifyDisposition } from "../types";
import { dispositionOf, DISPOSITION_COLUMNS, type DispositionRow } from "../verify/due";

/** How an address may be spoken of, decided by the page's **current
 *  state**, not by what ReachKit once did to it. Two keys, not one string
 *  and not a boolean: the pair is a customer-visible distinction and both
 *  sentences are the owner's. This module names the keys and supplies the
 *  address; it mints neither sentence, and it never interpolates the tense
 *  into one key. */
export type AddressLabel =
  | "record.address.publiclyReadableAt" // while the page stands `published`
  | "record.address.wasPublishedAt"; // from the moment it moves to `unpublished`

export type RecordedAddress =
  | { offered: true; label: AddressLabel; url: string }
  /** REQ-056 c6's last sentence: where ReachKit never made the page live at
   *  its destination, no address is offered at all and the record says so
   *  in place of one. Carries **no `url` field** — not an empty string and
   *  not a null — so a surface cannot render an address it was not given.
   *  Disjoint from the unpublished case by construction: this arm is
   *  decided from `made_live_by_us`, and the published/unpublished split is
   *  decided from the state. */
  | { offered: false; because: "never_made_live"; copy: "record.address.neverMadeLive" };

export interface PageRecord {
  draftId: string;
  state: State;
  opportunityId: string;
  targetQuery: string;
  /** The date of the measurement behind the page (REQ-056 c6) — the scan
   *  the opportunity was derived from. */
  measuredAt: Date;
  /** c6's "approved or published automatically". */
  mode: "approved" | "autopilot";
  address: RecordedAddress;
  /** The outcome REQ-056 c15 or c16 named for this page, and **no other
   *  account of what is at that address**. Non-null exactly when
   *  `state === 'unpublished'`. */
  unpublishOutcome: UnpublishOutcome | null;
  /** REQ-062 c7. The whole `VerifyOutcome`, `checkedAt` included, or the
   *  disposition where no check has run. **Not optional, and not separable
   *  from `state`.** */
  verification: VerifyDisposition;
}

/** The three keys this module names. All three sentences are the owner's;
 *  nothing here mints one. */
export const ADDRESS_COPY = Object.freeze({
  publiclyReadableAt: "record.address.publiclyReadableAt",
  wasPublishedAt: "record.address.wasPublishedAt",
  neverMadeLive: "record.address.neverMadeLive",
} as const satisfies Record<string, CopyKey>);

interface PublicationRow extends DispositionRow {
  mode: string;
  made_live_by_us: boolean;
  unpublish_outcome: string | null;
}

interface DraftRow {
  id: string;
  state: string;
  opportunity_id: string;
}

interface OpportunityRow {
  target_query: string;
  scan_id: string;
}

const UNPUBLISH_OUTCOMES: readonly UnpublishOutcome[] = [
  "removed",
  "returned_to_draft",
  "named_for_removal",
  "already_gone",
  "unreachable",
];

function addressOf(a: {
  state: State;
  madeLiveByUs: boolean;
  liveUrl: string | null;
}): RecordedAddress {
  if (!a.madeLiveByUs || a.liveUrl === null) {
    return { offered: false, because: "never_made_live", copy: ADDRESS_COPY.neverMadeLive };
  }
  return {
    offered: true,
    label:
      a.state === "unpublished" ? ADDRESS_COPY.wasPublishedAt : ADDRESS_COPY.publiclyReadableAt,
    url: a.liveUrl,
  };
}

/**
 * The one read behind every surface that states a published page's
 * standing: the day panel, the draft view and Overview all call this, and
 * none of them re-derives liveness from a column.
 *
 * `null` where the draft does not exist. A draft that exists but was never
 * published has a record: its state says so, its address is the
 * never-made-live arm, and its verification is a disposition.
 */
export async function pageRecordFor(
  draftId: string,
  now: Date = new Date()
): Promise<PageRecord | null> {
  const db = publishDb();

  const { data: drafts, error: draftError } = await db
    .from<DraftRow>("drafts")
    .select("id, state, opportunity_id")
    .eq("id", draftId)
    .limit(1);
  if (draftError !== null) throw new Error(`pageRecordFor(${draftId}): ${draftError.message}`);
  const draft = drafts?.[0];
  if (draft === undefined) return null;

  const { data: publications, error: pubError } = await db
    .from<PublicationRow>("publications")
    .select(`${DISPOSITION_COLUMNS}, mode, made_live_by_us, unpublish_outcome`)
    .eq("draft_id", draftId)
    .order("claimed_at", { ascending: false })
    .limit(1);
  if (pubError !== null) throw new Error(`pageRecordFor(${draftId}): ${pubError.message}`);
  const publication = publications?.[0];

  const { data: opportunities, error: oppError } = await db
    .from<OpportunityRow>("opportunities")
    .select("target_query, scan_id")
    .eq("id", draft.opportunity_id)
    .limit(1);
  if (oppError !== null) throw new Error(`pageRecordFor(${draftId}): ${oppError.message}`);
  const opportunity = opportunities?.[0];

  let measuredAt = new Date(0);
  if (opportunity !== undefined) {
    const { data: scans, error: scanError } = await db
      .from<{ created_at: string }>("scans")
      .select("created_at")
      .eq("id", opportunity.scan_id)
      .limit(1);
    if (scanError !== null) throw new Error(`pageRecordFor(${draftId}): ${scanError.message}`);
    const at = scans?.[0]?.created_at;
    if (at !== undefined) measuredAt = new Date(at);
  }

  const state = draft.state as State;
  const outcome = publication?.unpublish_outcome ?? null;

  return {
    draftId: draft.id,
    state,
    opportunityId: draft.opportunity_id,
    targetQuery: opportunity?.target_query ?? "",
    measuredAt,
    mode: publication?.mode === "autopilot" ? "autopilot" : "approved",
    address: addressOf({
      state,
      madeLiveByUs: publication?.made_live_by_us ?? false,
      liveUrl: publication?.live_url ?? null,
    }),
    // Non-null exactly when the page stands `unpublished`: the column
    // records what the last unpublish call *found*, and a page that is not
    // unpublished has no such finding to carry.
    unpublishOutcome:
      state === "unpublished" && outcome !== null && UNPUBLISH_OUTCOMES.includes(outcome as UnpublishOutcome)
        ? (outcome as UnpublishOutcome)
        : null,
    verification:
      publication === undefined
        ? { kind: "never", because: "no_live_address" }
        : dispositionOf(publication, now),
  };
}
