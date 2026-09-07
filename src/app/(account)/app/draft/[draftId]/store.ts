// BUILD §4.6, §8, §9 — one draft, read for the account that owns it.
//
// The other half of `provider.ts`: the `drafts` row behind the draft view,
// for a real signed-in account rather than the reserved fixture one. It
// reads and never writes — every state change on this screen goes through
// `publishing-actions.ts` to §9's one mover.
//
// **Ownership is a filter, not a check made afterwards.** The query is
// keyed on `(id, site_id)`, so a draft belonging to another account does
// not come back at all — there is no row in hand for a later `if` to
// forget. The archived BP-044 fixes what the customer then reads: "a draft
// the customer does not own, or an id that does not exist, resolves to one
// written line, never a stack trace or a vendor payload", which is why
// both take the same `null` arm and the screen words one sentence.
//
// **What is honestly absent, and whose it is.** `drafts.meta` carries what
// §8's generation recorded; the four values below are read from it where
// generation has written them and stand at their honest empty where it has
// not — never at a fixture value:
//
//   bodyMdGenerated   the body as generated, before the customer's edits
//   groundedFact      §8's recorded fact and its source (#43)
//   claim             the claim check's last verdict (#43)
//   firstEditedAt     the first save that changed the text (#17)
import { dbAdmin } from "@/lib/db";
import type { PublishingMode } from "../../_shell/model";
import type { State } from "../../calendar/stages";
import { pageRecordFor } from "@/lib/publish/record";
import type { ClaimState, DraftFacts } from "./model";

interface DraftRow {
  id: string;
  site_id: string;
  state: string;
  title: string;
  body_md: string | null;
  meta: Record<string, unknown> | null;
  veto_deadline: string | null;
}

interface MinimalResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface MinimalQuery<T> extends PromiseLike<MinimalResult<T>> {
  select(columns: string): MinimalQuery<T>;
  eq(column: string, value: unknown): MinimalQuery<T>;
  limit(n: number): MinimalQuery<T>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQuery<T>;
}

/** The one select list. `drafts` carries no credential and this names no
 *  column of another account's. */
const DRAFT_COLUMNS = "id, site_id, state, title, body_md, meta, veto_deadline";

/** §9's ten states, as this screen reads them. A row carrying anything else
 *  is a row this screen cannot draw, and it takes the `null` arm rather
 *  than rendering a state the product does not have. */
const DRAFT_STATES: readonly string[] = [
  "planned",
  "generating",
  "in_review",
  "approved",
  "publishing",
  "published",
  "skipped",
  "failed",
  "needs_attention",
  "unpublished",
];

function stringAt(meta: Record<string, unknown> | null, key: string): string | null {
  const value = meta?.[key];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/** §8's grounded fact, as generation recorded it. A draft with none carries
 *  the empty shape rather than a fabricated fact — `assembleDraft`
 *  recomputes `present` against the body, so an empty fact is simply never
 *  found in it and no highlight is drawn.
 *
 *  **The empty shape's date is `null`, not epoch zero** (issue #268). It
 *  used to be `new Date(0)`, and the empty string it sits beside is why
 *  that was a different kind of value: an empty fact and an empty address
 *  render as nothing, while epoch zero renders as `Dec 31, 1969` — a date
 *  the screen stated as the day this page's source was read, on every
 *  draft generation has recorded no grounding for. A missing date has to
 *  be a value that cannot be formatted. */
function groundedFactOf(meta: Record<string, unknown> | null): DraftFacts["groundedFact"] {
  const grounded = meta?.grounded_fact;
  if (typeof grounded !== "object" || grounded === null) {
    return { fact: "", url: "", readAt: null };
  }
  const record = grounded as Record<string, unknown>;
  const readAt = typeof record.read_at === "string" ? new Date(record.read_at) : null;
  return {
    fact: typeof record.fact === "string" ? record.fact : "",
    url: typeof record.url === "string" ? record.url : "",
    readAt,
  };
}

/**
 * The claim check's last verdict, as §8 recorded it.
 *
 * `outstanding` where the check has not run: a badge the screen leaves off,
 * never a pass it did not earn. `failed` carries the entry it matched,
 * because the arm is unrenderable without it — a do-not-claim failure names
 * what it matched or it says nothing useful — so a recorded failure with no
 * entry reads as outstanding rather than as a failure the screen cannot
 * word.
 */
function claimOf(meta: Record<string, unknown> | null): ClaimState {
  const claim = meta?.claim;
  if (typeof claim !== "object" || claim === null) return { state: "outstanding" };
  const record = claim as Record<string, unknown>;
  const at = typeof record.at === "string" ? new Date(record.at) : null;
  if (record.state === "passed" && at !== null) return { state: "passed", at };
  if (record.state === "failed" && at !== null && typeof record.matched_entry === "string") {
    return { state: "failed", matchedEntry: record.matched_entry, at };
  }
  if (record.state === "nothing_to_check") return { state: "nothing_to_check" };
  return { state: "outstanding" };
}

export interface DraftSite {
  siteId: string;
  timeZone: string;
  mode: PublishingMode;
}

/**
 * One draft of one site, or `null`.
 *
 * `null` covers every way this screen has nothing to draw — no such id, a
 * draft of another account, a row in a state this build does not know — and
 * the screen words one sentence for all of them, which is what BP-044
 * requires and what stops the address from telling a stranger whether an id
 * exists.
 */
export async function readDraftRow(a: {
  draftId: string;
  site: DraftSite;
}): Promise<DraftFacts | null> {
  const client = dbAdmin() as unknown as MinimalClient;
  const { data, error } = await client
    .from<DraftRow>("drafts")
    .select(DRAFT_COLUMNS)
    // Ownership, as a filter: another account's draft never comes back.
    .eq("id", a.draftId)
    .eq("site_id", a.site.siteId)
    .limit(1);
  if (error !== null || data === null) return null;

  const row = data[0];
  if (row === undefined) return null;
  if (!DRAFT_STATES.includes(row.state)) return null;

  const bodyMd = row.body_md ?? "";
  const generated = stringAt(row.meta, "body_md_generated") ?? bodyMd;
  const firstEdited = stringAt(row.meta, "first_edited_at");
  const lastSaved = stringAt(row.meta, "last_saved_at");

  return {
    draftId: row.id,
    title: row.title,
    bodyMd,
    bodyMdGenerated: generated,
    state: row.state as State,
    firstEditedAt: firstEdited === null ? null : new Date(firstEdited),
    groundedFact: groundedFactOf(row.meta),
    claim: claimOf(row.meta),
    mode: a.site.mode,
    // §9's veto window, and only where one is running: a page that is not
    // awaiting review has no time at which doing nothing publishes it.
    autoApprovesAt:
      row.state === "in_review" && row.veto_deadline !== null
        ? new Date(row.veto_deadline)
        : null,
    lastSavedAt: lastSaved === null ? null : new Date(lastSaved),
    // What became of this page (#217). One further read, made only once
    // the row above has proved this account owns the draft — asking first
    // would answer about a page the caller may not see. `pageRecordFor`
    // is the one read behind every surface that states a page's standing;
    // nothing here re-derives liveness from a column.
    record: await pageRecordFor(a.draftId),
    timeZone: a.site.timeZone,
  };
}
