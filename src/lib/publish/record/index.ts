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

// ── The month's worth, in one read (issue #175) ─────────────────────────
//
// `pageRecordFor` is one page's whole standing and costs three reads; a
// calendar drawing thirty-one dates cannot ask it thirty-one times. So the
// month is its own read: the same columns, for every page §9 has put on a
// date inside a window, and nothing derived that the row does not carry.
//
// **It states no liveness of its own.** `liveUrl` is handed on exactly
// where ReachKit made the page live at its destination and the page still
// stands published — the same split `addressOf` makes above, and made in
// one place so a grid and a panel cannot disagree about whether a page is
// readable at an address.

/** One page §9 has put on a date, as a surface reads it off the row. */
export interface ScheduledPage {
  readonly draftId: string;
  readonly state: State;
  /** The site-local calendar date the page is for, as stored. */
  readonly scheduledFor: string;
  readonly title: string | null;
  readonly opportunityId: string;
  /** §9's veto window, for the one stage that has one. */
  readonly vetoDeadline: Date | null;
  /** The moment the customer approved the page, where they did. */
  readonly approvedAt: Date | null;
  /** Whether the page ever reached review — read off the append-only
   *  transitions and nowhere else, which is the same thing the machine's
   *  own `never_entered_review` guard reads (#143). */
  readonly enteredReview: boolean;
  /** The address, where ReachKit made the page live and it still stands
   *  published. `null` in every other case, never an empty string. */
  readonly liveUrl: string | null;
}

interface ScheduledDraftRow {
  id: string;
  state: string;
  scheduled_for: string | null;
  title: string | null;
  opportunity_id: string;
  veto_deadline: string | null;
  approved_at: string | null;
  transitions: unknown;
}

interface LivePublicationRow {
  draft_id: string;
  live_url: string | null;
  made_live_by_us: boolean;
}

const SCHEDULED_COLUMNS =
  "id, state, scheduled_for, title, opportunity_id, veto_deadline, approved_at, transitions";

function asDate(value: string | null): Date | null {
  if (value === null) return null;
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? null : at;
}

/** `drafts.transitions` is append-only JSON; only one question is asked of
 *  it here, and a row whose column is absent or misshapen answers `false`
 *  — a page that has not recorded reaching review has not reached it. */
function enteredReviewFrom(transitions: unknown): boolean {
  if (!Array.isArray(transitions)) return false;
  return transitions.some(
    (record) => typeof record === "object" && record !== null && (record as { to?: unknown }).to === "in_review"
  );
}

/**
 * Every page scheduled for one site between two site-local dates,
 * inclusive.
 *
 * Two indexed reads and no more, whatever the number of dates: the drafts
 * in the window, and the publications behind the ones that went out. A
 * window with no pages in it is an empty array — a legitimate empty, and
 * never an error.
 */
export async function scheduledPagesFor(a: {
  siteId: string;
  from: string;
  to: string;
}): Promise<readonly ScheduledPage[]> {
  const db = publishDb();
  const { data, error } = await db
    .from<ScheduledDraftRow>("drafts")
    .select(SCHEDULED_COLUMNS)
    .eq("site_id", a.siteId)
    .gte("scheduled_for", a.from)
    .lte("scheduled_for", a.to);
  if (error !== null || data === null) {
    throw new Error(`scheduledPagesFor(${a.siteId}): could not read the scheduled pages`);
  }
  const rows = data.filter((row): row is ScheduledDraftRow & { scheduled_for: string } =>
    typeof row.scheduled_for === "string" && row.scheduled_for !== ""
  );
  if (rows.length === 0) return [];

  const live = await db
    .from<LivePublicationRow>("publications")
    .select("draft_id, live_url, made_live_by_us")
    .in(
      "draft_id",
      rows.map((row) => row.id)
    );
  const byDraft = new Map<string, LivePublicationRow>();
  for (const row of live.data ?? []) byDraft.set(row.draft_id, row);

  return rows.map((row): ScheduledPage => {
    const state = row.state as State;
    const publication = byDraft.get(row.id);
    return {
      draftId: row.id,
      state,
      scheduledFor: row.scheduled_for,
      title: row.title,
      opportunityId: row.opportunity_id,
      vetoDeadline: asDate(row.veto_deadline),
      approvedAt: asDate(row.approved_at),
      enteredReview: enteredReviewFrom(row.transitions),
      liveUrl:
        state === "published" && publication?.made_live_by_us === true
          ? (publication.live_url ?? null)
          : null,
    };
  });
}
