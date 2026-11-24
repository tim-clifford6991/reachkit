// BUILD §8 · SPEC §7 (D41 stage 4) — the closed hard-rule vocabulary.
//
// Stage 4 is four checks — blocks, numbers, no placeholder cell, no
// near-repeat — and D51's `title`, beside the guards D27 names:
// nothing invented, no unsafe markup, and the never-claim list matched by
// its own words (D45), which holds the site's demo text too. Every one is code. The one rule a
// model decides is `fit_claim`, kept by D44 for a listicle or comparison
// alone. `no_new_question_heading` retired with the outline it guarded (D41).
// `no_private_figure` went with issue 1187: `./figures.ts` says why.
//
// **What a rule is for** (owner, 2026-10-02, D27): to stop an obvious
// violation — an invented fact, person or review; a false claim about the
// business; an advert posing as an answer; unsafe markup — or to hold the
// page to its structure. A rule that stops a good page is a defect in the
// rule. One rule reads how the page is worded, and no other does:
// `plain_prose` (owner, 2026-10-10, issue 1390), which counts the habits a
// reader knows a generated page by and holds each to what people's own
// pages reach (`./prose.ts`).
//
// Nothing in this file computes and nothing in it speaks: it is types plus
// one frozen list, so a new rule is a compile error at every call
// site rather than a value some module has to remember to reject.
//
// **There is no `message` anywhere in `RuleFailure`.** A failure carries a
// handle and stored values — the customer's own recorded words, a numeral
// as it appears in the draft, the page a candidate duplicated — and never a
// sentence, because a sentence the product speaks is a copy key and a
// sentence a model wrote is not shown at all.
import type { RequiredBlock } from "./blocks";
import type { ProseFault } from "./prose";
import type { TitleFault } from "./title";

/** The checks, in the order they run. `do_not_claim` is §8's fourth
 *  rule and `fit_claim` is the fit check; both live in `../claims/`. Every
 *  other member is a deterministic pass over finished text in this
 *  directory. */
export type HardRule =
  | "grounding"
  /** SPEC §7: a rival's claim links the rival's own page and keeps its plan, and nothing is denied of a rival that no
   *  stored source denies (`./rivals.ts`). */
  | "rival_claim"
  /** SPEC §7: no invented person, review, test, case study or self-ranked "#1" (`./people.ts`, `./brief.ts`, `./honest.ts`). */
  | "nothing_invented"
  /** SPEC §7: nothing hidden from the reader and nothing addressed to a machine (`./hidden.ts`); the kind goes in `detail`. */
  | "unsafe_markup"
  | "near_duplicate"
  /** SPEC §7 · issue 475: the rules that read what the brief handed the model (`./brief.ts`). */
  | "traceable_numerals"
  | "first_block_answers"
  /** SPEC §7 (2026-09-29, issue 1137): the blocks every generated page
   *  carries (`./blocks.ts`). The one rule about structure. */
  | "required_blocks"
  /** SPEC §7 (D41 stage 4, issue 1250): no table cell is empty or says a
   *  value is missing (`./cells.ts`). A warning. */
  | "no_placeholder_cell"
  /** SPEC §7 (owner, D61; issue 1295): no two H2s of a Q&A share most of
   *  their words or their opening (`./headings.ts`). */
  | "distinct_headings"
  /** SPEC §7 (owner, D51; issue 1266): the `<title>` is the search form —
   *  its length, its search term, one specific, the year's place, no banned
   *  pattern, no other page's title (`./title.ts`). */
  | "title"
  /** SPEC §7 (owner, 2026-10-10; issue 1390): the page does not read as
   *  machine-written — its dashes, its repeats, its list labels, its
   *  sentence lengths and its turns of phrase (`./prose.ts`). */
  | "plain_prose"
  /** SPEC §7 (2026-10-17, issue 1486): a how-to or a Q&A links at least
   *  `sourcesNeed` of the public pages its pack read claims off
   *  (`./cites.ts`). */
  | "cites_market"
  /** SPEC §7 (owner P2b, 2026-11-16): each H2 section's first sentence answers on its own (`./standalone.ts`). */
  | "standalone_lead"
  /** SPEC §7 (issue 1136; D44): no claim that the business serves a case the
   *  knowledge base does not support (`../claims/fit.ts`). */
  | "fit_claim"
  | "do_not_claim";

/** The closed list, in the order `runHardRules` runs them — so a failure
 *  list is comparable across runs. */
export const HARD_RULES: readonly HardRule[] = Object.freeze([
  "grounding",
  "rival_claim",
  "nothing_invented",
  "unsafe_markup",
  "near_duplicate",
  "traceable_numerals",
  "first_block_answers",
  "required_blocks",
  "no_placeholder_cell",
  "distinct_headings",
  "title",
  "plain_prose",
  "cites_market",
  "standalone_lead",
  "fit_claim",
  "do_not_claim",
] as const);

/** The rules that only warn (owner, 2026-11-08): recorded on the draft and shown in its Checks list, never a stop.
 *  Every other rule is harm and stops the page, so a new rule stops until it is named here. */
export const WARNING_RULES: ReadonlySet<HardRule> = new Set<HardRule>(["first_block_answers", "required_blocks", "no_placeholder_cell", "distinct_headings", "title", "plain_prose", "cites_market", "standalone_lead"]);

/** The two rules a new site's shortfall shows as (owner, 2026-11-18): recorded and counted in `meta.standard`, never drawn. */
export const HIDDEN_RULES: readonly HardRule[] = Object.freeze(["required_blocks", "cites_market"] as const);

/** The rules a caller switches on, each by an input it hands over or leaves
 *  out (`rulesAsked`, `./index.ts`). Every other rule reads every page. */
export const SWITCHED_RULES: readonly HardRule[] = Object.freeze([
  "required_blocks",
  "distinct_headings",
  "title",
  "plain_prose",
  "cites_market",
  "standalone_lead",
  "fit_claim",
  "do_not_claim",
] as const);

/** The last battery as the draft screen's Checks list reads it
 *  (`../record.ts` builds it), each list in `HARD_RULES` order. */
export interface RecordedChecks {
  /** Asked of this page, and not failed. */
  passed: readonly HardRule[];
  failed: readonly HardRule[];
  /** Not asked of this page. `null` where the run did not record what it
   *  asked, and then nothing is said about a switched rule. */
  skipped: readonly HardRule[] | null;
  /** How many of `passed` the run failed first and then cleared. */
  fixed: number;
  /** The rules recorded but not drawn (`HIDDEN_RULES`), which no total counts. Absent reads as none. */
  hidden?: readonly HardRule[];
  /** A failed rule's `detail.kind`, where its failure records one. Absent reads as none. */
  kinds?: Readonly<Partial<Record<HardRule, string>>>;
}

/** Nothing recorded: a row no battery has touched, or text not yet re-checked. */
export const NO_CHECKS: RecordedChecks = Object.freeze({ passed: [], failed: [], skipped: null, fixed: 0 });

/** The two rules with a module of their own in `../claims/`: the never-claim
 *  list, a literal match since D45, and the fit check, the one rule a model
 *  decides and only on a listicle or comparison (D44). Every other rule is a
 *  deterministic arm of the battery. */
export type ModelRule = "do_not_claim" | "fit_claim";

/** §8 hard rule 1: "≥1 verifiable fact from the customer's own live pages,
 *  carried with its source URL + read date". The passage is copied word for
 *  word from the content fetched on `readAt` and is never rewritten — the
 *  `drafts` trigger, not this type, is that invariant. */
export interface GroundedFact {
  url: string;
  readAt: Date;
  passage: string;
}

/** Which page a candidate duplicated: three sets of this customer's, and `elsewhere`, the pages written for other
 *  sites (D13), whose member is never named: its `ref` and `title` are empty. */
export type DuplicateKind = "published" | "measured" | "queued" | "elsewhere";

/** Which of `nothing_invented`'s faults a page has: a person, a review, a self-ranked "#1", a test or a case study. */
export type InventedKind = "people" | "testimonial" | "ranked" | "test" | "provenance";

export interface RuleFailure {
  rule: HardRule;
  /** Only ever a stored value or a handle — never a sentence and never
   *  model output. */
  detail?:
    | {
        rule: "near_duplicate";
        duplicateOf: { kind: DuplicateKind; ref: string; title: string };
        similarity: number;
      }
    /** The customer's own recorded words, read back from their list; `demo`, a whole sentence of the site's demo or
     *  menu text, or a fact the customer switched off. */
    | { rule: "do_not_claim"; matchedEntry: string; source?: "demo" }
    /** The page's own sentences that claim a fit, as written. */
    | { rule: "fit_claim"; sentences: string[] }
    /** A rival's figure without its page, as the draft has it, or what the sentence got wrong about the rival's source
     *  (a third party's page where the rival's own was read, or a claim without its plan) and the page's own sentence. */
    | { rule: "rival_claim"; kind: "source"; figure: string; fault?: "third_party" | "plan"; sentence?: string }
    /** The page's own sentence that denies a rival something. */
    | { rule: "rival_claim"; kind: "negative"; sentence: string }
    | { rule: "nothing_invented"; kind: InventedKind }
    /** What the markup hides from a reader, or a sentence addressed to a machine. */
    | { rule: "unsafe_markup"; kind: "hidden" | "machine" }
    | { rule: "traceable_numerals"; figure: string }
    /** Which block the page lacks — a handle, never a sentence; `over`, its length is past the ceiling rather than under the floor. */
    | { rule: "required_blocks"; block: RequiredBlock; length?: true; over?: true }
    /** The cell's words, as the page has them. */
    | { rule: "no_placeholder_cell"; cell: string }
    /** The two headings that are too alike, as the page has them. */
    | { rule: "distinct_headings"; headings: [string, string] }
    /** What the title or its description fails — handles, never a sentence. */
    | { rule: "title"; faults: TitleFault[] }
    /** Each habit the page has too much of: a handle, a count and the
     *  page's own words. */
    | { rule: "plain_prose"; faults: ProseFault[] }
    /** How many of the pack's claim pages the body links, and how many it
     *  must. */
    | { rule: "cites_market"; cited: number; min: number }
    /** The H2 headings whose section opens on a sentence that leans on the one before, as the page has them. */
    | { rule: "standalone_lead"; headings: string[] };
}

/** Every site-scoped input the battery is called with — the **raw stored**
 *  inputs, so each rule module derives what it needs and no derived
 *  per-site artifact is stored anywhere: a profile, a summary or an
 *  embedding has no member to arrive through. */
export interface SiteRuleInputs {
  businessName: string | null;
  domain: string;
  doNotClaim: string[];
  /** The rival domains and names recorded for the site. */
  rivals: string[];
  /** `sites.timezone`, the zone a page's Sources list writes its read dates in. Absent reads as UTC. */
  timeZone?: string | null;
  /** A site with no page past the refresh floor: its pages are short by nature, so the Checks list draws no `HIDDEN_RULES` row. */
  young?: true;
}

/** The three sets a candidate is compared against, all this customer's.
 *  `rendered` is the words a reader of that page meets, never its
 *  Markdown — the same derivation on both sides of every comparison. */
export interface ComparisonSet {
  published: Array<{ ref: string; title: string; rendered: string }>;
  measured: Array<{ ref: string; title: string; rendered: string }>;
  queued: Array<{ ref: string; title: string; rendered: string }>;
  /** Pages written for other sites in the last `ELSEWHERE.months`, text alone. Absent reads as none. */
  elsewhere?: Array<{ ref: string; title: string; rendered: string }>;
}
