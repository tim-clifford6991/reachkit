// BUILD §4.6 — the draft view's one shape: every word that would publish,
// what it is grounded in, what the claim check said, and what happens if
// the customer does nothing.
//
// "'Read the full page' opens the **draft view** (full page render,
// grounded-fact highlight with its source line, claim-check badge,
// Approve/Edit/Veto, and the 'what happens if you do nothing' info box)."
//
// `assembleDraft` is pure — facts in, model out. Reading the facts is
// `provider.ts`'s, and today that is a fixture (this issue builds the draft
// view on fixture data behind the typed provider; §8's generation (#43),
// §7's opportunities (#40) and §9's publishing (#45, #46) supply the real
// ones later). Keeping the assembly pure is what lets every REQ-045
// criterion be decided by a test with no database at all.
//
// **This module writes nothing and truncates nothing.** `bodyMd` is
// returned in full: REQ-045 criterion 1 is "every word that would publish
// … with nothing withheld or summarised", and there is no code path here
// that shortens a body, so none can be introduced by accident.
import type { LinkRecord } from "./links-panel";
import type { CopyKey } from "@/lib/presentation/copy";
import type { RecordedFact } from "@/lib/generate/fact";
import type { PackNeed } from "@/lib/generate/templates/types";
import type { PageRecord } from "@/lib/publish/record";
import type { PageReading } from "@/lib/measure/page-reading";
import type { Label } from "@/lib/opportunities/verdicts/types";
import type { TakeDownStanding } from "@/lib/publish/take-down/standing";
import type { PageTarget } from "../../_shell/page-target";
import type { PageType, PlanReason } from "@/lib/opportunities/types";
import { weekStartFor } from "@/lib/scan/weekly/week";
import type { RecordedChecks } from "@/lib/generate/rules/types";
import type { PublishingMode } from "../../_shell/model";
import type { State } from "../../calendar/stages";
import { factPresentIn } from "./grounded";

/** REQ-045 criterion 3's four outcomes. `nothing_to_check` is the empty
 *  do-not-claim list and is never a silent pass; `outstanding` is the state
 *  a save leaves behind (criterion 9) and shows no outcome at all. */
export type ClaimState =
  | { state: "passed"; at: Date }
  | { state: "failed"; matchedEntry: string; at: Date }
  | { state: "outstanding" }
  | { state: "nothing_to_check" };

/** Criterion 1 and REQ-093 criterion 2: what ReachKit wrote is labelled as
 *  this page's generated content, and the label never presents the
 *  customer's own words as text ReachKit generated. Two states, page-level
 *  — never a per-span diff, which mislabels on rewording (the archived
 *  BP-044 decision 1 states the argument in full). */
export type Authorship =
  { edited: false } | { edited: true; firstEditedAt: Date };

/** Criteria 2 and 8. The recorded passage, the address it was read from,
 *  the date it was read, and whether that verbatim passage still occurs in
 *  the body as it now stands. The passage is never rewritten to match an
 *  edit.
 *
 *  The three recorded members are `RecordedFact`'s own words (issue #415):
 *  this view states what §8 wrote down, and calling it by a second name
 *  here is how the screen came to read a shape nothing writes. `present`
 *  is the one member that is not recorded — it is recomputed below. */
export interface Grounded extends RecordedFact {
  present: boolean;
}

/** What `Grounded` reads as on a draft generation recorded no grounding
 *  for: nothing to mark, no address to print and no day to state (#268).
 *  The screen draws no highlight, no source line and no dropped-grounding
 *  note for it. */
const NO_GROUNDING: Grounded = Object.freeze({
  passage: "",
  url: "",
  readAt: null,
  present: false,
});

/** Criterion 4, "what will happen if you do nothing": the page goes live
 *  on its own when the veto window expires (autopilot only — owner
 *  2026-10-08, issue 1337). */
export interface DoNothing {
  /** The sentence to draw, or `null` where there is nothing to say: an
   *  autopilot page with no veto window left (a published or vetoed one)
   *  has no time at which doing nothing publishes it, and its key's
   *  sentence is "It publishes at {at} unless you stop it." — a promise
   *  with no `at` to make it with. */
  key: CopyKey | null;
  publishesAt: Date | null;
}

/**
 * What this page is for (issue 867), in the three states a draft can be in.
 *
 * `fix` and `unknown` are kept apart because they are different facts: a
 * Fix page has no market target — it repairs something on the site, and no
 * search, volume or band is owed for it — while `unknown` is a row whose
 * opportunity could not be read at all. Neither is a block of blanks.
 */
/**
 * Why this topic was picked (SPEC §4, 2026-10-10; issue 1395): what the
 * pass stored on the row beyond the target's own numbers. The business fit
 * is a category in words — the stored 0–3 is never printed — and a topic
 * below `helps` is never written, so it has no word here. `rival` is the
 * site the pass recorded as answering the search today; `null` where it
 * recorded none, which is not a claim that nobody does.
 */
export interface TargetWhy {
  readonly fit: "answer" | "helps" | null;
  readonly rival: string | null;
  /** The points the committed week placed it by (`opportunities.plan_reason`). */
  readonly planReason?: PlanReason | null;
}

export type DraftTarget =
  | { kind: "target"; target: PageTarget; why?: TargetWhy; update?: boolean }
  | { kind: "fix" }
  | { kind: "unknown" };

/**
 * What the page was written from, as generation recorded it (#927, #931).
 *
 * SPEC §7 (2026-09-20): the review screen shows "*written from your
 * business* — each fact, quote and promise used and where it was read".
 *
 * **Read off the record, never re-derived.** The profile a page was written
 * from may have changed since — the customer may have removed an item the
 * day after the page was written — and the card's job is to say what *this
 * page* stands on. So both lists come from `drafts.meta`, which the writer
 * filled at generation, and this screen interprets nothing.
 */
export interface WrittenFrom {
  /** The profile items the prompt carried: what the business does, sells,
   *  promises, serves and says. Empty where the site had no profile. */
  readonly profileItems: readonly string[];
  /** The passages the brief chose, each with the page it was read from.
   *  `url` is `null` on a draft written before #931 recorded it. */
  readonly facts: readonly {
    readonly passage: string;
    readonly url: string | null;
    /** Whole days since the passage was read (SPEC §7, D59, issue 1287),
     *  as of this read of the draft. Absent where the page kept no date
     *  for it: a draft written before the pack. */
    readonly ageDays?: number;
  }[];
  /** The market facts the page was handed, each with the public page it
   *  was read from (issue 1135). Read by the editor's live rules, so a
   *  number a cited page states is not marked. Absent on a page written
   *  before the research step. */
  readonly marketFacts?: readonly { readonly passage: string; readonly url: string }[];
  /** The context pack the page was written from (`drafts.meta.pack`, SPEC
   *  §7, D41; issue 1252). Absent on a page written before the pack. */
  readonly pack?: PackView;
}

/** How many of the site's pages the pack's fold lists before it counts. */
export const PACK_PAGES_SHOWN = 10;

/**
 * The context pack as the *Written from your business* card reads it (SPEC
 * §7, 2026-10-04, D41: "readable on the draft screen under *written from
 * your business*"; issue 1252).
 *
 * The groups the card draws and nothing else of the stored object: the
 * business facts already list above the fold, and the profile, the live
 * page's text and the measurements are the writer's inputs in bulk, not
 * lines a founder reads here. Every value is a string, so the view crosses
 * to the browser as it is.
 */
export interface PackView {
  /** The target question the page answers. */
  readonly question: string;
  /** The market facts: each passage, the public page it was read off, and
   *  the moment it was read (ISO). */
  readonly claims: readonly {
    readonly passage: string;
    readonly url: string;
    readonly title: string;
    readonly readAt: string;
    /** Whole days since it was read (D59); absent where `readAt` is no date. */
    readonly ageDays?: number;
  }[];
  /** The site's own pages the writer knew about — the first
   *  `PACK_PAGES_SHOWN`, each by its title or its question. */
  readonly pages: readonly string[];
  /** How many more the pack held than are listed. */
  readonly pagesMore: number;
  readonly neverClaim: readonly string[];
  /** What the template asked that the pack lacked, by handle. */
  readonly missing: readonly PackNeed[];
}

/** One short noun phrase per thing a pack can lack. Total over `PackNeed`,
 *  so a new need is a compile error here rather than a blank line. */
export const PACK_NEED_COPY: Readonly<Record<PackNeed, CopyKey>> = Object.freeze({
  options: "publish.needs-you.pack.need.options",
  own_price: "publish.needs-you.pack.need.own_price",
  difference: "publish.needs-you.pack.need.difference",
  facts_on_topic: "publish.needs-you.pack.need.facts_on_topic",
  outside_sources: "publish.needs-you.pack.need.outside_sources",
  product_page: "publish.needs-you.pack.need.product_page",
  measured_questions: "publish.needs-you.pack.need.measured_questions",
  changed_figures: "publish.needs-you.pack.need.changed_figures",
  buyer_questions: "publish.needs-you.pack.need.buyer_questions",
  recent_results: "publish.needs-you.pack.need.recent_results",
  live_page: "publish.needs-you.pack.need.live_page",
  new_fact: "publish.needs-you.pack.need.new_fact",
});

/** The handles of a recorded reason that this build has a phrase for. A
 *  handle it does not know is dropped rather than printed. */
export function knownNeeds(handles: readonly string[]): PackNeed[] {
  return handles.filter((handle): handle is PackNeed => Object.hasOwn(PACK_NEED_COPY, handle));
}

/**
 * What this page adds (SPEC §7, 2026-09-29, D12; issue 1143): the sentences
 * of the page that say something neither the target's top results nor the
 * customer's own pages say, as generation listed them (`drafts.meta.adds`).
 * Absent on a page written before the list was made.
 */
/**
 * A page that was not written because its context pack was short (SPEC §7,
 * D41 stage 2; issue 1252): "the page stops naming what is missing". The
 * handles are the ones the stop recorded on its own transition; where that
 * names none, the stored pack's.
 */
export interface PackShort {
  readonly missing: readonly PackNeed[];
}

export interface PageAdds {
  readonly claims: readonly { readonly claim: string; readonly business: boolean }[];
  /** The page is held for adding too little, and waits on a fact only the
   *  founder has. */
  readonly ask: boolean;
}

/** Whether there is anything to show. A page whose record carries neither
 *  list draws no card, rather than an empty one — a draft written before
 *  the record existed is not a page written from nothing. */
export function writtenFromIsEmpty(w: WrittenFrom): boolean {
  return w.profileItems.length === 0 && w.facts.length === 0 && w.pack === undefined;
}

/**
 * The site-scoped facts the editor's live rule pass reads (issue 932).
 *
 * SPEC §7 (2026-09-20): "A sentence that breaks a hard rule or matches the
 * never-claim list is marked where it stands as it is typed." Marking it as
 * it is typed means deciding it in the browser, and these four are
 * everything the thirteen rules that *can* be decided there read —
 * `marks.ts` names the three that cannot, and why.
 *
 * **Four small values, and no fifth.** Every one is the customer's own and
 * every one is a row this screen can reach for the price of a `sites`
 * select: their never-claim list, their rivals, the searches the row
 * targets and its type. Nothing here is a report, a corpus or a register —
 * a screen opened to read one page does not read the site's whole content
 * to underline a sentence in it.
 *
 * **The brief's passages are not here**, and that is the merge with #931
 * paying for itself: `WrittenFrom.facts` above already carries them, off
 * the same `drafts.meta` key, because the viewer's *Written from your
 * business* card draws them. One record, read twice.
 */
export interface RuleFacts {
  /** Word for word as the customer recorded it — the entry a break names
   *  back to them is read out of this list, never out of a model. */
  readonly doNotClaim: readonly string[];
  /** The rival domains and names recorded for the site. */
  readonly rivals: readonly string[];
  /** The target search and every search the row absorbed. */
  readonly queries: readonly string[];
  /** The page's type (SPEC §7, issue 1136), which decides whether the
   *  honest row applies at all. `null` where the row could not be read or
   *  has none — and then that rule decides nothing, exactly as it decides
   *  nothing in the battery. */
  readonly pageType: PageType | null;
}

/** What `RuleFacts` reads as where nothing could be read. Every list empty
 *  and no type: the live pass then reports only the rules that need the
 *  text alone, which is fewer than the save runs and never more. A live
 *  pass that under-reports is a founder told about a break a moment later,
 *  on the save; one that over-reported would be this screen accusing them
 *  of a break the battery does not hold. */
export const NO_RULE_FACTS: RuleFacts = Object.freeze({
  doNotClaim: [],
  rivals: [],
  queries: [],
  pageType: null,
});

export interface DraftView {
  draftId: string;
  title: string;
  /** The meta description (`drafts.meta.description`), which the founder
   *  edits beside the title and the body (#789). */
  description: string;
  /** UI-SPEC S16's provenance line: the day and time the page was written.
   *  It is the `drafts` row's own `created_at` — the moment §8 wrote the
   *  page — and never the last save, which is a different fact and is
   *  stated in its own place (S17's save line). `null` only where the facts
   *  carry none. */
  writtenAt: Date | null;
  /** When the page-ready mail left; `null` where no mail did. */
  emailedAt: Date | null;
  /** Every word that would publish. Never truncated, never summarised. */
  bodyMd: string;
  /** The text as generated, before any edit — what makes the authorship
   *  label truthful and what an unedited page's copy-out is identical to. */
  bodyMdGenerated: string;
  state: State;
  /** Whether the page ever entered review (#1180): a stopped page that
   *  never did may be edited, written again or skipped. */
  enteredReview: boolean;
  authorship: Authorship;
  grounded: Grounded;
  claim: ClaimState;
  doNothing: DoNothing;
  lastSavedAt: Date | null;
  /**
   * What became of this page (issue #217): the address it is or was
   * readable at, what ReachKit's one check saw, what the last unpublish
   * call found, and REQ-060 criterion 4's line where a delivery wrote into
   * no SEO plugin.
   *
   * **Handed through whole, and never re-derived here.** `PageRecord` is
   * the one read behind every surface that states a page's standing, and
   * `assembleDraft` is a pure assembly: it decides nothing about liveness,
   * picks no key, and would be the second place the record's facts were
   * interpreted if it did. `null` where nothing could be read for this
   * draft — a shape, not a placeholder, and the block is simply absent.
   */
  record: PageRecord | null;
  /** The page's own publication, for a page that went live (board
   *  `PageDetail`); `null` for one that never did. */
  live: LiveFacts | null;
  /** *Stop this page* on a live page, the stopped state after (R9). */
  takeDown: TakeDownStanding;
  /** The Checks list: the last battery, rule by rule. Empty where none is
   *  recorded — the rail then draws no row for them, rather than deducing
   *  a pass from the fact that the draft reached review (`checks.ts`
   *  states the argument). */
  recordedChecks: RecordedChecks;
  /** SPEC §7 (2026-09-20, #928): what this page was held against — how many
   *  pages the site already has, and the closest of them to this page's
   *  topic. `null` for a site whose index holds nothing, and then the rail
   *  states the gate alone: there is no page to name and no number worth
   *  stating. */
  knownCheck: KnownCheck | null;
  /** The last battery found a rule this text breaks, so it is held from
   *  publishing until a save passes (#789). */
  rulesFailed: boolean;
  /** What this page is optimising for (issue 867) — the opportunity's own
   *  stored evidence, projected once for this screen and the day panel. */
  target: DraftTarget;
  /** The site-local zone every date this view states is expressed in. */
  timeZone: string;
  /** What this page was written from (#931). */
  writtenFrom: WrittenFrom;
  /** What this page adds (issue 1143). */
  adds?: PageAdds;
  /** Which pages code chose to link and what the check at publish found
   *  (issue 1391). Absent reads as nothing recorded. */
  linkRecord?: LinkRecord;
  /** The page rests unwritten because its pack was short (issue 1252). */
  packShort?: PackShort;
  /** The customer's own frame: the name and the address the page publishes
   *  at, so the viewer can draw the page as a reader will meet it (#931). */
  publisher: Publisher;
  /** What the editor's live rule pass reads (issue 932). */
  ruleFacts: RuleFacts;
  /** The customer's own domain. The live pass takes its brand tokens from
   *  it — `marks.ts` says why it does not take the measured brand — and it
   *  is the address the search-result pane shows. */
  domain: string;
}

/** The customer's own page frame, as the viewer draws it.
 *
 *  Their name and their address and nothing of ReachKit's: SPEC §7 asks for
 *  the page "in the customer's own page frame", and a mark of ours on it
 *  would be the one thing the frame exists to show is absent. */
/** When the page went live and where, the weekly pass's stored reading of
 *  it, and the label that reading earns (`verdicts/verdict.ts`). */
export interface LiveFacts {
  since: Date;
  url: string;
  wordpress: boolean;
  reading: PageReading | null;
  label: Label | null;
}

export interface Publisher {
  /** What the frame calls them. The domain today — see `publisherOf` for
   *  why, and for what would change it. */
  readonly name: string;
  /** The address this page is or will be readable at. */
  readonly url: string;
  /** Whether that address is the **recorded** one a delivery made live, or
   *  the site's own origin standing in for an address nothing has decided
   *  yet. A row that stated a path for a page in review would be inventing
   *  the destination's slug, so *What gets published* says which it is
   *  instead of printing a host as though it were the page's address. */
  readonly addressRecorded: boolean;
}

/** SPEC §7 (2026-09-20, #928) — what the known-content check has to say
 *  about this page: the size of the index it was held against, and the
 *  closest page in it. `linked` is read off this page's own body, so the
 *  sentence claiming the page links to it is checked rather than assumed. */
export interface KnownCheck {
  pages: number;
  closest: { title: string; url: string | null; linked: boolean } | null;
}

/** Everything the draft view reads, before it is a model. One shape, so the
 *  fixture and a future query answer the same question. */
export interface DraftFacts {
  draftId: string;
  title: string;
  description: string;
  /** The `drafts` row's `created_at` — when the page was written. */
  writtenAt: Date | null;
  /** When the page-ready mail left for this page; `null` where none did. */
  emailedAt?: Date | null;
  bodyMd: string;
  bodyMdGenerated: string;
  state: State;
  /** Whether §9's record shows the page in review at any point (#1180). */
  enteredReview: boolean;
  /** Set on the first save that changed the text; `null` on a draft the
   *  customer has not edited. */
  firstEditedAt: Date | null;
  /** What the page was written from, as generation recorded it (#931). */
  writtenFrom: WrittenFrom;
  /** What the page adds, as generation listed it (issue 1143). */
  adds?: PageAdds;
  /** `meta.links` and `meta.linkCheck` (issue 1391). */
  linkRecord?: LinkRecord;
  /** Set where the page rests in `needs_attention` because its context
   *  pack was short of what its template asks (issue 1252). */
  packShort?: PackShort;
  /** The customer's own domain (#931). */
  domain: string;
  /** The passage and its source, as recorded at generation — `null` where
   *  generation recorded no grounding. `present` is **not** a recorded
   *  value: it is recomputed in `assembleDraft` against `bodyMd`, so a body
   *  and a highlight can never disagree. */
  groundedFact: RecordedFact | null;
  claim: ClaimState;
  /** §9's publishing mode, read from the shell's one preference. */
  mode: PublishingMode;
  /** §9's veto window: when this page goes out if nothing is done. `null`
   *  under copilot, and `null` for a page that is not awaiting review. */
  autoApprovesAt: Date | null;
  lastSavedAt: Date | null;
  /** The page's own record, or `null` where none could be read (#217). */
  record: PageRecord | null;
  /** Absent for a page that never went live. */
  live?: LiveFacts | null;
  /** Live or stopped (R9); absent draws neither. */
  takeDown?: TakeDownStanding;
  /** §8's battery, as generation recorded it. Empty is the honest answer
   *  for a draft it recorded nothing for. */
  recordedChecks: RecordedChecks;
  /** SPEC §7 (2026-09-20, #928): what this page was held against — how many
   *  pages the site already has, and the closest of them to this page's
   *  topic. `null` for a site whose index holds nothing, and then the rail
   *  states the gate alone: there is no page to name and no number worth
   *  stating. */
  knownCheck: KnownCheck | null;
  rulesFailed: boolean;
  /** The opportunity this draft was written from, as this screen states it
   *  (issue 867). `unknown` where the row could not be read. */
  target: DraftTarget;
  timeZone: string;
  /** What the editor's live rule pass reads (issue 932). `NO_RULE_FACTS`
   *  where nothing could be read. */
  ruleFacts: RuleFacts;
}

/** The key criterion 4's outcome is spoken through. Named by the mode §9
 *  names, never by a renderer. */
export const DO_NOTHING_COPY_KEY: Readonly<Record<PublishingMode, CopyKey>> =
  Object.freeze({
    autopilot: "draft.do-nothing.autopilot",
  });

/** Criterion 4. */
export function doNothingOf(facts: DraftFacts): DoNothing {
  // **Autopilot with no window left says nothing at all.** `store.ts` reads
  // `autoApprovesAt` as non-null only while a page is `in_review`, so every
  // published, vetoed or stopped page on an autopilot site arrives here with
  // none — and the autopilot sentence takes a `{at}` slot. Naming the key
  // anyway made `copy()` throw the moment a customer on autopilot opened a
  // page that had already gone out: `copy(): "draft.do-nothing.autopilot"
  // requires slot "at"`, and the whole screen 500'd. The rule this follows
  // is the draft view's own, stated in `PageRecord`: no row without a fact.
  const publishesAt = facts.autoApprovesAt;
  return {
    key: publishesAt === null ? null : DO_NOTHING_COPY_KEY[facts.mode],
    publishesAt,
  };
}

/**
 * S16's "~{n} words", counted the way a reader would count them: runs of
 * non-space, over the Markdown as it stands.
 *
 * It counts the **source**, marks and all, because the source is what the
 * customer edits and what the count has to move with as they type. The set
 * writes the figure with a tilde in front of it for exactly this reason —
 * it is the page's length, not a promise about a destination's rendering
 * (REQ-045's own non-goal), and a count that pretended to be exact would be
 * claiming to know what a theme will do with a heading.
 */
export function wordCount(bodyMd: string): number {
  const trimmed = bodyMd.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** The weekly scan after a page goes live is the first to read it in Google
 *  and AI answers: the site's Monday of the following week, as a noon-UTC
 *  instant so formatting it in UTC names that calendar date. */
export function firstReadingOn(publishesAt: Date, timeZone: string): Date {
  const monday = weekStartFor({ at: new Date(publishesAt.getTime() + WEEK_MS), zone: timeZone });
  return new Date(`${monday}T12:00:00Z`);
}

export function assembleDraft(facts: DraftFacts): DraftView {
  return {
    draftId: facts.draftId,
    title: facts.title,
    description: facts.description,
    writtenAt: facts.writtenAt,
    emailedAt: facts.emailedAt ?? null,
    bodyMd: facts.bodyMd,
    bodyMdGenerated: facts.bodyMdGenerated,
    state: facts.state,
    enteredReview: facts.enteredReview,
    authorship:
      facts.firstEditedAt === null
        ? { edited: false }
        : { edited: true, firstEditedAt: facts.firstEditedAt },
    grounded:
      facts.groundedFact === null
        ? NO_GROUNDING
        : {
            ...facts.groundedFact,
            // Criterion 8, decided here rather than stored: the grounding
            // is still marked if the passage survived the edit and is no
            // longer marked if it was removed.
            present: factPresentIn(facts.bodyMd, facts.groundedFact.passage),
          },
    claim: facts.claim,
    doNothing: doNothingOf(facts),
    lastSavedAt: facts.lastSavedAt,
    record: facts.record,
    live: facts.live ?? null,
    takeDown: facts.takeDown ?? null,
    recordedChecks: facts.recordedChecks,
    knownCheck: facts.knownCheck,
    rulesFailed: facts.rulesFailed,
    target: facts.target,
    timeZone: facts.timeZone,
    writtenFrom: facts.writtenFrom,
    ...(facts.adds === undefined ? {} : { adds: facts.adds }),
    ...(facts.linkRecord === undefined ? {} : { linkRecord: facts.linkRecord }),
    ...(facts.packShort === undefined ? {} : { packShort: facts.packShort }),
    publisher: publisherOf(facts),
    ruleFacts: facts.ruleFacts,
    domain: facts.domain,
  };
}

/**
 * The customer's own frame (#931).
 *
 * **The address a reader would meet.** Where the page is live, or has been,
 * `record.address` holds the address ReachKit actually made it readable at
 * and that is the one to draw. Where it is not, the page has no address yet
 * — so the frame shows the site's own origin, which is where it will be.
 * Never a composed slug: a guessed path in a browser bar would be a
 * statement about an address nothing has recorded.
 *
 * **The name is the domain**, and that is a decision worth stating. What the
 * hosted page shows is the *publication's* publisher name, and a draft has
 * no publication; the crawl's `site_profiles.siteName` would be a second
 * database read on a screen the customer opens to read one page. A domain is
 * what a reader sees in a browser bar in any case, so the frame is honest
 * with the fact in hand rather than accurate at the price of a query. The
 * issue that gives this screen a profile read can put the name in.
 */
function publisherOf(facts: DraftFacts): Publisher {
  const recorded = facts.record?.address;
  return {
    name: facts.domain,
    url:
      recorded !== undefined && recorded.offered
        ? recorded.url
        : `https://${facts.domain}`,
    addressRecorded: recorded !== undefined && recorded.offered,
  };
}
