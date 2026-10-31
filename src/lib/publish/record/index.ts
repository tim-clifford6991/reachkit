// BUILD §9 — the one read behind every surface that states a published
// page's standing.
//
// Read-only: no transition, no write, no repair.
// The address label follows the page's current state, never what ReachKit once did to it, so a page taken down is never
// shown "publicly readable at" (REQ-056 c6); the `published → unpublished` fixture fails a split on `made_live_by_us`.
// The guard bans claiming liveness at an address we stopped serving; it does not promise the address resolves.
// `verification` is not optional (ADR-085 decision 5): REQ-062 c7 is a law over surfaces, held by returning state and
// outcome in one value, as `Measured<T>` does for REQ-004, so no surface can render one without the other.
// `page_not_found` and `could_not_confirm` stay two (ADR-085): one retires the page from weekly judgement, the other
// leaves it as it was; `tests/publish/record/record.test.ts`'s paired fixture fails if they merge.
// REQ-060 c4's line lives here and on no other surface: one place reads the three-valued column into a key.
import type { CopyKey } from "@/lib/presentation/copy";
import { publishDb } from "../db";
// The address is composed in `destinations/hosted/store.ts`, imported as a leaf, since the barrel carries the adapters.
import { hostedAddressesNow } from "../destinations/hosted/store";
import type { State, UnpublishOutcome, VerifyDisposition } from "../types";
import { dispositionOf, DISPOSITION_COLUMNS, type DispositionRow } from "../verify/due";
import { needsYouOf, type NeedsYouCause } from "./needs-you";

/** How an address may be spoken of, by the page's current state: two keys, never one with the tense interpolated. */
export type AddressLabel =
  | "record.address.publiclyReadableAt" // while the page stands `published`
  | "record.address.wasPublishedAt"; // from the moment it moves to `unpublished`

export type RecordedAddress =
  | { offered: true; label: AddressLabel; url: string }
  /** REQ-056 c6: never made live by us, no address is offered and the record says so. No `url` field at all, so none
   *  can be rendered. Decided from `made_live_by_us`; the published/unpublished split is the state's. */
  | { offered: false; because: "never_made_live"; copy: "record.address.neverMadeLive" };

export interface PageRecord {
  draftId: string;
  state: State;
  opportunityId: string;
  targetQuery: string;
  /** The date of the scan behind the page (REQ-056 c6), or null where the opportunity cannot be read: never a stand-in
   *  like epoch zero, which a surface would format as a real date. No row without a fact. */
  measuredAt: Date | null;
  /** c6's "approved or published automatically". */
  mode: "approved" | "autopilot";
  address: RecordedAddress;
  /** The outcome REQ-056 c15 or c16 named, and no other account of the address; non-null exactly when `unpublished`. */
  unpublishOutcome: UnpublishOutcome | null;
  /** REQ-062 c7: the whole `VerifyOutcome` or the disposition; not optional, not separable from `state`. */
  verification: VerifyDisposition;
  /** REQ-060 c4's line, on this surface only: non-null exactly where a delivery recorded no SEO plugin written. A key,
   *  never a sentence. */
  seoNote: CopyKey | null;
}

/** The three address keys; nothing here mints a sentence. */
export const ADDRESS_COPY = Object.freeze({
  publiclyReadableAt: "record.address.publiclyReadableAt",
  wasPublishedAt: "record.address.wasPublishedAt",
  neverMadeLive: "record.address.neverMadeLive",
} as const satisfies Record<string, CopyKey>);

/** REQ-060 c4's line from the pure `lines.ts`, never the WordPress leaf, whose REST client every standing surface would
 *  then import. `tests/publish/record/seo-note.test.ts` holds the two spellings to one key. */
export { SEO_COPY } from "./lines";
export type { NeedsYouCause, NeedsYouKind } from "./needs-you";

// Imported as well, since a re-export does not bring it into scope for `seoNoteOf`.
import { SEO_COPY as SEO_COPY_VALUE } from "./lines";

interface PublicationRow extends DispositionRow {
  mode: string;
  made_live_by_us: boolean;
  unpublish_outcome: string | null;
  /** The address is re-composed from these: a hosted host is the site's, and only our destination is re-addressed. */
  site_id: string;
  destination: string | null;
  /** REQ-060 c4: `null` is no answer; an empty array is the answer that carries the line. */
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

/** The address for the host the page answers at now (SPEC §7): a hosted host can move under its pages, and the old
 *  address would 404. An `unpublished` page keeps its stored address, as `wasPublishedAt` speaks of the past. */
async function liveUrlNow(a: {
  state: State;
  row:
    | { site_id: string; destination: string | null; live_url: string | null; made_live_by_us: boolean }
    | undefined;
}): Promise<string | null> {
  const row = a.row;
  // Never made live: `addressOf` reads this `null` as its never-made-live arm, at no read.
  if (row === undefined || row.live_url === null || !row.made_live_by_us) return null;
  if (a.state === "unpublished") return row.live_url;
  const addressNow = await hostedAddressesNow(row.site_id);
  return addressNow({ destination: row.destination, liveUrl: row.live_url });
}

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

/** REQ-060 c4's line, or nothing: the empty array is the whole condition. `null` (nothing delivered, or no plugins to
 *  find) and a non-empty array (one plugin wrote) carry no line. */
function seoNoteOf(written: readonly string[] | null | undefined): CopyKey | null {
  if (written === null || written === undefined) return null;
  return written.length === 0 ? SEO_COPY_VALUE.noSeoPlugin : null;
}

/** The one read behind every surface stating a page's standing, so none re-derives liveness from a column. `null` where
 *  the draft does not exist; an unpublished draft still has a record. */
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
    .select(`${DISPOSITION_COLUMNS}, site_id, destination, mode, made_live_by_us, unpublish_outcome, seo_written`)
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

  // No date until a scan supplies one, never an instant nothing measured.
  let measuredAt: Date | null = null;
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
      liveUrl: await liveUrlNow({ state, row: publication }),
    }),
    // Non-null exactly when `unpublished`: what the last unpublish call found.
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

// ── The month's worth, in one read ───────────────────────────────────────
// A calendar cannot ask `pageRecordFor` thirty-one times, so the month is its own read of the same columns. It states
// no liveness of its own: `liveUrl` follows `addressOf`'s split, so a grid and a panel cannot disagree.

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
  /** Whether the page ever reached review, from the transitions, as `never_entered_review` reads it. */
  readonly enteredReview: boolean;
  /** The address, where ReachKit made the page live and it still stands
   *  published. `null` in every other case, never an empty string. */
  readonly liveUrl: string | null;
  /** REQ-062 c7 on the month read too, from the same `dispositionOf` as the page record. */
  readonly verification: VerifyDisposition;
  /** What the last unpublish call found, for an `unpublished` page; otherwise `null`, as on `PageRecord`. */
  readonly unpublishOutcome: UnpublishOutcome | null;
  /** Why the page needs the customer, from its transitions; `null` in any other state. */
  readonly needsYou: NeedsYouCause | null;
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
  meta: unknown;
}

interface LivePublicationRow extends DispositionRow {
  draft_id: string;
  made_live_by_us: boolean;
  unpublish_outcome: string | null;
  /** As on `PublicationRow`, so both reads compose the address from the same columns. */
  destination: string | null;
}

const SCHEDULED_COLUMNS =
  "id, state, scheduled_for, title, opportunity_id, veto_deadline, approved_at, transitions, meta";

function asDate(value: string | null): Date | null {
  if (value === null) return null;
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? null : at;
}

/** Whether the transitions record reaching review; absent or misshapen is `false`. */
function enteredReviewFrom(transitions: unknown): boolean {
  if (!Array.isArray(transitions)) return false;
  return transitions.some(
    (record) => typeof record === "object" && record !== null && (record as { to?: unknown }).to === "in_review"
  );
}

/** Every page scheduled between two site-local dates, inclusive, in two indexed reads whatever the window; empty is legitimate. */
export async function scheduledPagesFor(a: {
  siteId: string;
  from: string;
  to: string;
  /** The clock due-ness is decided against, injected for tests, as on `pageRecordFor`. */
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
    .select(`${DISPOSITION_COLUMNS}, draft_id, destination, made_live_by_us, unpublish_outcome`)
    .in(
      "draft_id",
      rows.map((row) => row.id)
    );
  const byDraft = new Map<string, LivePublicationRow>();
  for (const row of live.data ?? []) byDraft.set(row.draft_id, row);

  // The site's host, read once for the whole month.
  const addressNow = await hostedAddressesNow(a.siteId);

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
      // From its own record, never its stage.
      needsYou: needsYouOf({ state, transitions: row.transitions, meta: row.meta }),
      // The address now; `readStandings` re-addresses its side of the join too, so a moved host never empties it.
      liveUrl:
        state === "published" && publication?.made_live_by_us === true && publication.live_url !== null
          ? addressNow({ destination: publication.destination, liveUrl: publication.live_url })
          : null,
      // The same derivations as `pageRecordFor`, so grid, panel and draft view agree.
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
