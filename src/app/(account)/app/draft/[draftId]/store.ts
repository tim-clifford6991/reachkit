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
// **What is honestly absent, and whose it is.** The values below are read
// where their writer has written them and stand at their honest empty
// where it has not — never at a fixture value:
//
//   groundedFact      §8's recorded fact and its source — `grounded_fact`
//   claim             the claim check's last verdict — `claim_check`
//   recordedChecks    which §8 hard rules passed — `rule_failures`
//   bodyMdGenerated   the body as generated, before the customer's edits
//   firstEditedAt     the first save that changed the text (#17)
//   lastSavedAt       the last save the customer made
//
// **Every one of the recorded three is read from the column §8 writes, and
// that is issues #415 and #424.** This file used to read `meta` keys of its
// own spelling — `grounded_fact`, `claim`, `hard_rules_passed` — that no
// code in `src/` has ever written, so every generated draft reached its
// customer with no highlight, no claim outcome and an empty Checks list,
// while the fixture account's hand-typed draft showed all three. The
// readers are `@/lib/generate`'s own (`fact.ts`, `record.ts`): the writer
// and the reader of one record are one module, so the two cannot be
// spelled apart again.
//
// The three keys that remain in `meta` are the **save path's**, not
// generation's: `body_md_generated`, `first_edited_at` and `last_saved_at`
// are written by `PATCH /api/drafts/{id}`, which `save.ts` declares and no
// code yet serves. Until it does they are absent — and absent is exactly
// what an unedited draft should read as, which is why the generated body
// falls back to the body as it stands and the screen states no edit and no
// save. Whoever lands that route writes the keys this file reads.
//
// `writtenAt` is not among them: it is `drafts.created_at`, a column the
// baseline declares `not null`, so the day the page was written is read
// from the row rather than from what generation remembered to write down.
import { dbAdmin } from "@/lib/db";
import { readRecordedFact } from "@/lib/generate/fact";
import {
  checkedAgainstNothing,
  readRecordedVerdict,
  recordedRulesPassed,
} from "@/lib/generate/record";
import type { PublishingMode } from "@/lib/publish/types";
import type { State } from "../../calendar/stages";
import { pageRecordFor } from "@/lib/publish/record";
import { RAIL_CHECKS, type RailCheck } from "./checks";
import type { ClaimState, DraftFacts } from "./model";

interface DraftRow {
  id: string;
  site_id: string;
  state: string;
  title: string;
  body_md: string | null;
  meta: Record<string, unknown> | null;
  grounded_fact: unknown;
  claim_check: unknown;
  rule_failures: unknown;
  veto_deadline: string | null;
  created_at: string;
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
const DRAFT_COLUMNS =
  "id, site_id, state, title, body_md, meta, grounded_fact, claim_check, rule_failures, " +
  "veto_deadline, created_at";

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

/**
 * The claim check's last verdict, as §8 recorded it in `drafts.claim_check`
 * — the column the pipeline writes at generation and the re-check sweep
 * rewrites whenever the customer changes their list. The badge therefore
 * states the check the product last actually ran, not the one it ran the
 * day the page was written.
 *
 * `outstanding` where no verdict has been recorded and where one records
 * that the check could not run: a badge the screen leaves without an
 * outcome, never a pass it did not earn. `nothing_to_check` is a verdict
 * reached against a list with nothing in it — criterion 3's fourth case,
 * which `record.ts` reads out of the verdict's own hash so that an empty
 * do-not-claim list is never stated as a silent pass. A `failed` verdict
 * carries the entry it matched, because the arm is unrenderable without it.
 */
function claimOf(row: DraftRow): ClaimState {
  const verdict = readRecordedVerdict(row.claim_check);
  if (verdict === null || verdict.state === "unrun") return { state: "outstanding" };
  if (verdict.state === "failed") {
    return { state: "failed", matchedEntry: verdict.matchedEntry, at: verdict.at };
  }
  return checkedAgainstNothing(verdict)
    ? { state: "nothing_to_check" }
    : { state: "passed", at: verdict.at };
}

/**
 * The §8 rules the last battery passed, filtered to the four S16 names.
 *
 * The record is `drafts.rule_failures` — the failure list the pipeline
 * writes on every run — read through `record.ts`, which answers with the
 * rules a recorded run did **not** fail. A rule outside the four is dropped
 * rather than rendered: the rail speaks only for rules it can name, and an
 * unknown handle has no sentence. A row no battery has recorded anything
 * for answers the empty list, which is the arm `checks.ts` draws no row
 * for — the screen declining to speak for a run it has no result from.
 */
function recordedChecksOf(row: DraftRow): readonly RailCheck[] {
  const passed = recordedRulesPassed(row.rule_failures);
  return RAIL_CHECKS.filter((rule) => passed.includes(rule));
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
    writtenAt: new Date(row.created_at),
    bodyMd,
    bodyMdGenerated: generated,
    state: row.state as State,
    firstEditedAt: firstEdited === null ? null : new Date(firstEdited),
    // §8's recorded fact, from its own column and through the one reader
    // (`@/lib/generate/fact`). `null` where generation recorded no
    // grounding: `assembleDraft` draws no highlight and no source line for
    // one, rather than an empty address beside a stand-in date (#268).
    groundedFact: readRecordedFact(row.grounded_fact),
    claim: claimOf(row),
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
    recordedChecks: recordedChecksOf(row),
    timeZone: a.site.timeZone,
  };
}
