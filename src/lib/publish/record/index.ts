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
// **REQ-060 criterion 4's line lives here and on no other surface** (issue
// #156). "One written line on that page's own record — and no other
// surface" is a law about where a sentence may appear, so it is kept the
// way this module keeps the address label: there is one place the fact is
// read from a column and turned into a key, and every surface that states a
// page's standing already comes through it. The three ways of having no
// line — nothing delivered, a destination with no plugins to find, and a
// plugin that did write — are one `null` on the way out and three different
// facts on the way in, which is why the column is three-valued and the
// derivation is its own function.
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
  /** REQ-060 criterion 4's line, **and this is the only surface it appears
   *  on** (issue #156).
   *
   *  Non-null exactly where a delivery recorded that the destination's site
   *  wrote the title and description into no SEO plugin. Null everywhere
   *  else, and the three cases that are "everywhere else" are different
   *  facts rather than one: a page nothing has delivered, a destination
   *  with no plugins to find, and a page one plugin did write.
   *
   *  It names the key and mints no sentence — the line is the owner's, the
   *  same way the three address keys are. */
  seoNote: CopyKey | null;
}

/** The three keys this module names. All three sentences are the owner's;
 *  nothing here mints one. */
export const ADDRESS_COPY = Object.freeze({
  publiclyReadableAt: "record.address.publiclyReadableAt",
  wasPublishedAt: "record.address.wasPublishedAt",
  neverMadeLive: "record.address.neverMadeLive",
} as const satisfies Record<string, CopyKey>);

/** REQ-060 criterion 4's line (issue #156), declared in this module's pure
 *  leaf and re-exported here so every caller's spelling is unchanged.
 *
 *  It is named in the record module rather than imported from the WordPress
 *  leaf that also names it: this module is on the import graph of every
 *  surface that states a page's standing, and pulling the adapter's REST
 *  client behind it to reach one string constant would be a dependency
 *  bought for nothing. It moved to `lines.ts` with #217 for the same shape
 *  of reason one file down: a fixture screen needs the key and must not pay
 *  for `publishDb()` to get it. `tests/publish/record/seo-note.test.ts`
 *  asserts the two spellings are the same key, which is the coupling that
 *  actually matters. */
export { SEO_COPY } from "./lines";

// Imported as well as re-exported: `seoNoteOf` below names the key, and a
// re-export alone does not bring it into this module's scope.
import { SEO_COPY as SEO_COPY_VALUE } from "./lines";

interface PublicationRow extends DispositionRow {
  mode: string;
  made_live_by_us: boolean;
  unpublish_outcome: string | null;
  /** REQ-060 c4. `null` where no delivery recorded an answer; an empty
   *  array is an answer and is the case that carries the line. */
  seo_written: string[] | null;
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
 * REQ-060 criterion 4's line, or nothing.
 *
 * **The empty array is the whole condition, and `null` is not it.** A page
 * nothing has delivered, and a page delivered to a destination that has no
 * SEO plugins to find, both carry `null` and both must carry no line —
 * criterion 4 is about a site where the plugins *could* have been found and
 * were not. A page one plugin wrote carries a non-empty array and no line,
 * which is what makes "one present and one not" silent rather than
 * half-spoken: the criterion asks about no plugin, not about every plugin.
 */
function seoNoteOf(written: readonly string[] | null | undefined): CopyKey | null {
  if (written === null || written === undefined) return null;
  return written.length === 0 ? SEO_COPY_VALUE.noSeoPlugin : null;
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
    .select(`${DISPOSITION_COLUMNS}, mode, made_live_by_us, unpublish_outcome, seo_written`)
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
    seoNote: seoNoteOf(publication?.seo_written),
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
  /** REQ-062 criterion 7, on the month read as well as the page one
   *  (issue #217): the day panel states what became of a page, so it
   *  carries what ReachKit saw and when — from the same `dispositionOf`
   *  the single-page record uses, never a second reading of the columns. */
  readonly verification: VerifyDisposition;
  /** What the last unpublish call found, for a page that stands
   *  `unpublished`. `null` for every other state, exactly as on
   *  `PageRecord`. */
  readonly unpublishOutcome: UnpublishOutcome | null;
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

interface LivePublicationRow extends DispositionRow {
  draft_id: string;
  made_live_by_us: boolean;
  unpublish_outcome: string | null;
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
  /** The clock due-ness is decided against, injected so a month's
   *  dispositions are testable without travelling in time — the same
   *  parameter `pageRecordFor` takes, for the same reason. */
  now?: Date;
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
    .select(`${DISPOSITION_COLUMNS}, draft_id, made_live_by_us, unpublish_outcome`)
    .in(
      "draft_id",
      rows.map((row) => row.id)
    );
  const byDraft = new Map<string, LivePublicationRow>();
  for (const row of live.data ?? []) byDraft.set(row.draft_id, row);

  const now = a.now ?? new Date();
  return rows.map((row): ScheduledPage => {
    const state = row.state as State;
    const publication = byDraft.get(row.id);
    const outcome = publication?.unpublish_outcome ?? null;
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
      // The same two derivations `pageRecordFor` makes, from the same
      // columns and the same functions — so a grid, a panel and a draft
      // view cannot disagree about what became of one page.
      verification:
        publication === undefined
          ? { kind: "never", because: "no_live_address" }
          : dispositionOf(publication, now),
      unpublishOutcome:
        state === "unpublished" &&
        outcome !== null &&
        UNPUBLISH_OUTCOMES.includes(outcome as UnpublishOutcome)
          ? (outcome as UnpublishOutcome)
          : null,
    };
  });
}
