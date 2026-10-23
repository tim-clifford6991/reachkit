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
//   recordedChecks    the last battery, rule by rule — `rule_failures`
//                     and `meta.checks`
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
// are written by the editor's save (`@/lib/generate/edit`, #789). On a draft
// never edited they are absent — and absent is exactly what an unedited
// draft should read as, which is why the generated body falls back to the
// body as it stands and the screen states no edit and no save.
//
// `writtenAt` is not among them: it is `drafts.created_at`, a column the
// baseline declares `not null`, so the day the page was written is read
// from the row rather than from what generation remembered to write down.
import type { LinkRecord } from "./links-panel";
import { now as clock } from "@/lib/config/now";
import { dbAdmin } from "@/lib/db";
import { readRecordedFact } from "@/lib/generate/fact";
import { readPack } from "@/lib/generate/pipeline/pack";
import {
  checkedAgainstNothing,
  readRecordedRules,
  readRecordedRun,
  readRecordedVerdict,
  recordedChecks,
} from "@/lib/generate/record";
import type { PublishingMode } from "../../_shell/model";
import type { State } from "../../calendar/stages";
import { pageRecordFor } from "@/lib/publish/record";
import { readingOf } from "@/lib/measure/page-reading";
import { verdict } from "@/lib/opportunities/verdicts/verdict";
import { takeDownStanding } from "@/lib/publish/take-down/standing";
import { needsYouOf } from "@/lib/publish/record/needs-you";
import { askedAs, doneWhen } from "../../calendar/store";
import type { Choice } from "@/lib/opportunities/derive/explain";
import { pageTargetOf } from "../../_shell/page-target";
import {
  NO_RULE_FACTS,
  PACK_PAGES_SHOWN,
  knownNeeds,
  type PackShort,
  type PackView,
  type ClaimState,
  type DraftFacts,
  type PageAdds,
  type DraftTarget,
  type KnownCheck,
  type LiveFacts,
  type RuleFacts,
} from "./model";

interface DraftRow {
  id: string;
  site_id: string;
  opportunity_id: string | null;
  state: string;
  title: string;
  body_md: string | null;
  meta: Record<string, unknown> | null;
  grounded_fact: unknown;
  claim_check: unknown;
  rule_failures: unknown;
  veto_deadline: string | null;
  created_at: string;
  transitions: unknown;
  told?: { sentAt?: unknown; mailed?: unknown } | null;
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
  "id, site_id, opportunity_id, state, title, body_md, meta, grounded_fact, claim_check, rule_failures, " +
  "veto_deadline, created_at, transitions, told";

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

/** The stored pack as the card reads it (issue 1252), or nothing on a row
 *  written before the pack. Every member is read defensively: the column is
 *  JSON and `readPack` vouches only for the pack's version and its two fact
 *  lists. */
/** Whole days from `readAt` to `at` (D59, issue 1287): 0 on the day it was
 *  read. Nothing where the pack kept no date a calendar can read. */
export function ageOf(readAt: unknown, at: Date): { ageDays?: number } {
  const read = typeof readAt === "string" ? Date.parse(readAt) : Number.NaN;
  return Number.isNaN(read) ? {} : { ageDays: Math.max(0, Math.floor((at.getTime() - read) / 86_400_000)) };
}

function packAt(meta: Record<string, unknown> | null, at: Date): { pack?: PackView } {
  const pack = readPack(meta);
  if (pack === null) return {};
  const texts = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((each): each is string => typeof each === "string" && each.trim() !== "") : [];
  const pages = (Array.isArray(pack.pages) ? pack.pages : []).flatMap((page) => {
    const name = page?.title ?? page?.question;
    return typeof name === "string" && name.trim() !== "" ? [name] : [];
  });
  return {
    pack: {
      question: typeof pack.target?.question === "string" ? pack.target.question : "",
      claims: pack.claims.flatMap((claim) =>
        typeof claim?.passage === "string" && typeof claim.url === "string"
          ? [
              {
                passage: claim.passage,
                url: claim.url,
                title: typeof claim.title === "string" ? claim.title : "",
                readAt: typeof claim.readAt === "string" ? claim.readAt : "",
                ...ageOf(claim.readAt, at),
              },
            ]
          : []
      ),
      pages: pages.slice(0, PACK_PAGES_SHOWN),
      pagesMore: Math.max(0, pages.length - PACK_PAGES_SHOWN),
      neverClaim: texts(pack.neverClaim),
      missing: knownNeeds(texts(pack.missing)),
    },
  };
}

/** Whether the page rests because its pack was short, and of what (issue
 *  1252). The cause is the record's own (`needsYouOf`); the handles are the
 *  ones the stop recorded, or the stored pack's where it recorded none. */
function packShortAt(row: DraftRow, pack: PackView | undefined): { packShort?: PackShort } {
  const cause = needsYouOf({ state: row.state as State, transitions: row.transitions });
  if (cause === null || cause.kind !== "pack") return {};
  const named = knownNeeds(cause.missing);
  return { packShort: { missing: named.length > 0 ? named : (pack?.missing ?? []) } };
}

/** What the page adds (`meta.adds`, issue 1143), read as defensively as
 *  every other key here. The ask stands only while the page is still held:
 *  one the founder has since edited into review is no longer waiting. */
function addsAt(meta: Record<string, unknown> | null, state: string): { adds?: PageAdds } {
  const value = meta?.adds as { claims?: unknown; short?: unknown } | null | undefined;
  if (value === null || value === undefined || !Array.isArray(value.claims)) return {};
  const claims = (value.claims as unknown[]).flatMap((entry) => {
    const each = entry as { claim?: unknown; business?: unknown } | null;
    return typeof each?.claim === "string" ? [{ claim: each.claim, business: each.business === true }] : [];
  });
  return { adds: { claims, ask: value.short === true && state === "needs_attention" } };
}

/** Which pages code chose to link and what the check at publish found
 *  (`meta.links`, `meta.linkCheck`; issue 1391), read as defensively as
 *  every other key here. A page written before either was recorded reads as
 *  nothing chosen and no check made. */
function linkRecordAt(meta: Record<string, unknown> | null): LinkRecord {
  const chosen = (Array.isArray(meta?.links) ? (meta.links as unknown[]) : []).flatMap((entry) => {
    const link = entry as { url?: unknown; source?: unknown; why?: unknown } | null;
    if (typeof link?.url !== "string" || typeof link.source !== "string") return [];
    const why = typeof link.why === "object" && link.why !== null ? (link.why as { kind?: unknown; words?: unknown }) : null;
    return [{ url: link.url, source: link.source, why }];
  });
  const factUrls = (Array.isArray(meta?.factsUsed) ? (meta.factsUsed as unknown[]) : []).flatMap((entry) => {
    const url = (entry as { url?: unknown } | null)?.url;
    return typeof url === "string" ? [url] : [];
  });
  const raw = meta?.linkCheck as { links?: unknown; removed?: unknown } | null | undefined;
  const check =
    raw === null || raw === undefined || !Array.isArray(raw.links)
      ? null
      : {
          links: (raw.links as unknown[]).flatMap((entry) => {
            const link = entry as { url?: unknown; status?: unknown } | null;
            return typeof link?.url === "string" && typeof link.status === "string" ? [{ url: link.url, status: link.status }] : [];
          }),
          removed: (Array.isArray(raw.removed) ? (raw.removed as unknown[]) : []).flatMap((entry) => {
            const link = entry as { url?: unknown; text?: unknown; kind?: unknown } | null;
            return typeof link?.url === "string" && typeof link.text === "string"
              ? [{ url: link.url, text: link.text, kind: link.kind === "source" ? ("source" as const) : ("site" as const) }]
              : [];
          }),
        };
  return { chosen, factUrls, check };
}

function stringAt(meta: Record<string, unknown> | null, key: string): string | null {
  const value = meta?.[key];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/** A list of the customer's own strings off `meta`, or empty. Read
 *  defensively for the reason every `meta` read here is: the column is JSON
 *  and a row written by an older pipeline carries no such key (#927, #931). */
function textsAt(meta: Record<string, unknown> | null, key: string): readonly string[] {
  const value = meta?.[key];
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "");
}

/** The facts a page was written from, each with the page it was read from
 *  (#931's done-when).
 *
 *  **Two shapes are read, and only one is written.** #927 wrote plain
 *  passages and #931 writes `{ passage, url }`; a draft generated between
 *  the two carries the older shape, and its facts are still the facts this
 *  page was written from. So a bare string is read as a passage whose source
 *  is unknown, and the card says so rather than dropping the sentence — a
 *  fact with no address is exactly what the card exists to surface. */
function factsUsedAt(
  meta: Record<string, unknown> | null,
  at: Date
): readonly { passage: string; url: string | null; ageDays?: number }[] {
  const value = meta?.factsUsed;
  if (!Array.isArray(value)) return [];
  // The pack holds the same passages with the day each was read (D59).
  const readAt = new Map((readPack(meta)?.facts ?? []).map((fact) => [fact?.passage, fact?.readAt]));
  const out: { passage: string; url: string | null; ageDays?: number }[] = [];
  for (const entry of value) {
    if (typeof entry === "string" && entry.trim() !== "") {
      out.push({ passage: entry, url: null });
      continue;
    }
    if (entry === null || typeof entry !== "object") continue;
    const row = entry as { passage?: unknown; url?: unknown; readAt?: unknown };
    if (typeof row.passage !== "string" || row.passage.trim() === "") continue;
    out.push({ passage: row.passage, url: typeof row.url === "string" ? row.url : null, ...ageOf(row.readAt ?? readAt.get(row.passage), at) });
  }
  return out;
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
export function claimStateOf(claimCheck: unknown): ClaimState {
  const verdict = readRecordedVerdict(claimCheck);
  if (verdict === null || verdict.state === "unrun") return { state: "outstanding" };
  if (verdict.state === "failed") {
    return { state: "failed", matchedEntry: verdict.matchedEntry, at: verdict.at };
  }
  return checkedAgainstNothing(verdict)
    ? { state: "nothing_to_check" }
    : { state: "passed", at: verdict.at };
}

/** When the page-ready mail left, off `drafts.told`; `null` where the
 *  record does not say a mail did. */
export function emailedAtOf(told: DraftRow["told"]): Date | null {
  if (told?.mailed !== true || typeof told.sentAt !== "string") return null;
  const at = new Date(told.sentAt);
  return Number.isNaN(at.getTime()) ? null : at;
}

/** Whether the last battery recorded a rule this text breaks (#789). A row
 *  no battery has recorded anything for breaks none it can name. */
export function rulesFailedOf(ruleFailures: unknown): boolean {
  return (readRecordedRules(ruleFailures) ?? []).length > 0;
}

/** The engine's own read, with every way it can fail folded into `null`.
 *  Lazily, the way this screen reaches nothing else at module load: a
 *  static import of the engine barrel from here would pull its store into
 *  every module that names this file's types. */
async function readChoice(opportunityId: string): Promise<Choice | null> {
  try {
    const { explainChoice } = await import("@/lib/opportunities");
    return await explainChoice(opportunityId);
  } catch {
    return null;
  }
}

/**
 * What this page is for (issue 867): the opportunity §7 chose, read through
 * the same `explainChoice` the day panel reads, and projected by the same
 * `pageTargetOf`. The draft screen and the calendar therefore state one
 * fact one way.
 *
 * `unknown` covers every way there is nothing to state — a draft written
 * before the column was filled, and a row whose opportunity has been purged
 * — and the screen words one sentence for it rather than a block of blanks.
 * A read that throws is `unknown` too: this block explains a page, and a
 * page is still readable without it.
 */
/** The search this page targets, or `""` for a row that targets none (a
 *  Fix) or one that could not be read. #928's check is about a topic, and a
 *  page with no topic is compared against nothing. */
async function targetQueryOf(opportunityId: string | null): Promise<string> {
  if (opportunityId === null) return "";
  const choice = await readChoice(opportunityId);
  if (choice === null || choice.evidence.family === "fix") return "";
  return choice.evidence.query;
}

async function targetOf(opportunityId: string | null): Promise<DraftTarget> {
  if (opportunityId === null) return { kind: "unknown" };
  const choice = await readChoice(opportunityId);
  if (choice === null) return { kind: "unknown" };
  const search = choice.evidence.family === "fix" ? "" : choice.evidence.query;
  const target = pageTargetOf({
    choice,
    askedAs: askedAs(choice, search),
    doneWhen: doneWhen(choice),
    // The evidence's own measurement date, never today's: an unmeasured
    // value carries the date the pass could not read it on.
    at: choice.evidence.family === "fix" ? new Date(0) : choice.evidence.volume.at,
  });
  if (target === null) return { kind: "fix" };
  const evidence = choice.evidence;
  return {
    kind: "target",
    target,
    why: {
      fit: choice.businessFit === 3 ? "answer" : choice.businessFit === 2 ? "helps" : null,
      rival: evidence.family === "write" || evidence.family === "earn" ? evidence.rival.domain : null,
      planReason: choice.planReason ?? null,
    },
    update: evidence.family === "improve",
  };
}

/**
 * What the editor's live rule pass reads (issue 932): the customer's own
 * never-claim list and rivals off the `sites` row, and the searches and
 * type off the opportunity this page answers.
 *
 * **The brief's passages are not read here.** `writtenFrom.facts` above
 * already carries them, off the same `drafts.meta` key, because #931's
 * *Written from your business* card draws them — one record, read once.
 *
 * **Every failure is `NO_RULE_FACTS`, never a throw.** This screen's job is
 * to show a page; a founder whose lists could not be read still gets the
 * page, the editor and every rule that needs the text alone, and the save
 * still runs the whole battery and still holds the page. A screen that
 * 500'd because a `sites` select failed would be trading the whole of the
 * feature for part of one.
 */
async function ruleFactsOf(siteId: string, opportunityId: string | null): Promise<RuleFacts> {
  try {
    // Lazily, like `readChoice` below it and for the same reason: a static
    // import of the engine's store from here would pull it into every
    // module that names this file's types.
    const { generateStore } = await import("@/lib/generate/store");
    const site = await generateStore().siteFacts(siteId);
    if (site === null) return NO_RULE_FACTS;

    if (opportunityId === null) {
      return { doNotClaim: site.doNotClaim, rivals: site.rivals, queries: [], pageType: null };
    }
    const { opportunityById } = await import("@/lib/opportunities");
    const { targetSearches } = await import("@/lib/generate/pipeline");
    const { pageTypeOf } = await import("@/lib/opportunities/page-type");
    const opportunity = await opportunityById(opportunityId);
    return {
      doNotClaim: site.doNotClaim,
      rivals: site.rivals,
      // The battery's own projection of "the searches this row targets",
      // not a second reading of the same columns.
      queries: opportunity === null ? [] : targetSearches(opportunity),
      pageType: opportunity === null ? null : pageTypeOf(opportunity),
    };
  } catch (error) {
    console.warn(JSON.stringify({ event: "draft_rule_facts_unread", detail: String(error) }));
    return NO_RULE_FACTS;
  }
}

/**
 * SPEC §7 (2026-09-20, #928) — what this page was held against.
 *
 * Two facts, both about the site's own pages: how many the index holds, and
 * the closest of them to this page's topic. The closeness is
 * `known-content`'s own measure over the database's own narrowing — the same
 * two the derivation used — and `linked` is read off this page's body, so
 * the sentence that says the page links to it is checked rather than
 * claimed.
 *
 * `null` where the index holds nothing, or could not be read: the rail then
 * states the near-duplicate gate alone rather than naming a page or a
 * number it does not have.
 */
async function knownCheckFor(a: {
  siteId: string;
  query: string;
  body: string;
}): Promise<KnownCheck | null> {
  try {
    const { knownContentCount, knownContentNear, closestKnown } = await import("@/lib/known-content");
    const pages = await knownContentCount(a.siteId);
    if (pages === 0) return null;
    const near = a.query.trim() === "" ? [] : await knownContentNear({ siteId: a.siteId, query: a.query });
    const match = closestKnown({ query: a.query }, near);
    return {
      pages,
      closest:
        match === null
          ? null
          : {
              title: match.page.title,
              url: match.page.url,
              linked: match.page.url !== null && a.body.includes(match.page.url),
            },
    };
  } catch {
    return null;
  }
}

export interface DraftSite {
  siteId: string;
  timeZone: string;
  mode: PublishingMode;
  /** The customer's own domain, so the viewer can draw the page in their own
   *  frame (#931). Passed rather than read: the session already resolved it
   *  and a second read could answer with a domain the session does not have. */
  domain: string;
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
  // One clock read for the screen: every fact's age is as of this read.
  const at = clock();
  // What became of this page (#217). One further read, made only once
  // the row above has proved this account owns the draft — asking first
  // would answer about a page the caller may not see. `pageRecordFor`
  // is the one read behind every surface that states a page's standing;
  // nothing here re-derives liveness from a column.
  const record = await pageRecordFor(a.draftId);
  const { pack } = packAt(row.meta, at);

  return {
    draftId: row.id,
    title: row.title,
    description: stringAt(row.meta, "description") ?? "",
    writtenAt: new Date(row.created_at),
    emailedAt: emailedAtOf(row.told),
    bodyMd,
    bodyMdGenerated: generated,
    // What the page was written from (#927, #931), as generation recorded
    // it. Empty for a draft written before it was recorded — the card is
    // then absent rather than empty, which is the honest answer for a page
    // nobody wrote a record for.
    writtenFrom: {
      profileItems: textsAt(row.meta, "profileItems"),
      facts: factsUsedAt(row.meta, at),
      ...(Array.isArray(row.meta?.marketFacts)
        ? {
            marketFacts: (row.meta.marketFacts as unknown[]).flatMap((entry) => {
              const fact = entry as { passage?: unknown; url?: unknown } | null;
              return typeof fact?.passage === "string" && typeof fact.url === "string"
                ? [{ passage: fact.passage, url: fact.url }]
                : [];
            }),
          }
        : {}),
      ...(pack === undefined ? {} : { pack }),
    },
    ...addsAt(row.meta, row.state),
    linkRecord: linkRecordAt(row.meta),
    ...packShortAt(row, pack),
    domain: a.site.domain,
    state: row.state as State,
    // The fact §9's `never_entered_review` guard reads (#1180).
    enteredReview:
      Array.isArray(row.transitions) &&
      row.transitions.some((move: { to?: unknown } | null) => move?.to === "in_review"),
    firstEditedAt: firstEdited === null ? null : new Date(firstEdited),
    // §8's recorded fact, from its own column and through the one reader
    // (`@/lib/generate/fact`). `null` where generation recorded no
    // grounding: `assembleDraft` draws no highlight and no source line for
    // one, rather than an empty address beside a stand-in date (#268).
    groundedFact: readRecordedFact(row.grounded_fact),
    claim: claimStateOf(row.claim_check),
    mode: a.site.mode,
    // §9's veto window, and only where one is running: a page that is not
    // awaiting review has no time at which doing nothing publishes it.
    autoApprovesAt:
      row.state === "in_review" && row.veto_deadline !== null
        ? new Date(row.veto_deadline)
        : null,
    lastSavedAt: lastSaved === null ? null : new Date(lastSaved),
    record,
    // The page's own publication, after the same ownership proof.
    live: record?.address.offered === true ? await liveOfDraft(client, a.site.siteId, a.draftId, record.address.url, at) : null,
    takeDown: takeDownStanding({
      state: row.state as State,
      transitions: row.transitions,
      live: record?.address.offered === true,
      unpublishOutcome: record?.unpublishOutcome ?? null,
      now: at,
    }),
    recordedChecks: recordedChecks(row.rule_failures, readRecordedRun(row.meta)),
    rulesFailed: rulesFailedOf(row.rule_failures),
    // Read after the row above proved this account owns the draft, like the
    // page record: asking first would answer about a page the caller may
    // not see.
    target: await targetOf(row.opportunity_id),
    // #928, and after the same ownership proof: what the site already has,
    // and the closest of it to this page.
    knownCheck: await knownCheckFor({
      siteId: a.site.siteId,
      query: await targetQueryOf(row.opportunity_id),
      body: bodyMd,
    }),
    timeZone: a.site.timeZone,
    // Read after the row above proved this account owns the draft, like
    // the page record and the target.
    ruleFacts: await ruleFactsOf(a.site.siteId, row.opportunity_id),
  };
}

/** The newest publication of this draft that went live, with the weekly
 *  pass's reading of it, or `null`. */
async function liveOfDraft(client: MinimalClient, siteId: string, draftId: string, url: string, at: Date): Promise<LiveFacts | null> {
  const { data, error } = await client
    .from<{ published_at: string | null; destination: string; search_reading: unknown }>("publications")
    .select("published_at, destination, search_reading")
    .eq("draft_id", draftId)
    .eq("site_id", siteId);
  if (error !== null || data === null) return null;
  const row = data
    .filter((each) => each.published_at !== null)
    .sort((x, y) => y.published_at!.localeCompare(x.published_at!))[0];
  if (row === undefined) return null;
  const reading = readingOf(row.search_reading);
  return {
    since: new Date(row.published_at!),
    url,
    wordpress: row.destination === "wordpress",
    reading,
    label: reading === null ? null : verdict(reading, at),
  };
}
