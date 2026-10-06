// BUILD §8 · SPEC §7 (D41 stage 4) — the closed hard-rule vocabulary.
//
// Stage 4 is five checks — blocks, numbers, no placeholder cell, no
// near-repeat, no demo or navigation text — and D51's `title`, beside the
// guards D27 names:
// nothing invented, no unsafe markup, D20's honest row, and the never-claim
// list matched by its own words (D45). Every one is code. The one rule a
// model decides is `fit_claim`, kept by D44 for a listicle or comparison
// alone. `no_new_question_heading` retired with the outline it guarded (D41).
// `no_private_figure` went with issue 1187: `./figures.ts` says why.
//
// **What a rule is for** (owner, 2026-10-02, D27): to stop an obvious
// violation — an invented fact, person or review; a false claim about the
// business; an advert posing as an answer; unsafe markup — or to hold the
// page to its structure. Not a style filter, and a rule that stops a good
// page is a defect in the rule.
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
import type { TitleFault } from "./title";

/** The checks, in the order they run. `do_not_claim` is §8's fourth
 *  rule and `fit_claim` is the fit check; both live in `../claims/`. Every
 *  other member is a deterministic pass over finished text in this
 *  directory. */
export type HardRule =
  | "grounding"
  | "rival_source"
  | "no_invented_people"
  | "no_unsourced_testimonial"
  /** SPEC §7 (D20, issue 1136): on a market comparison the business is in
   *  the table and never ranks itself "#1 best" (`./honest.ts`). */
  | "honest_row"
  | "no_hidden_text"
  | "no_machine_address"
  | "near_duplicate"
  /** SPEC §7 · issue 475: rules 8–12, which read what the brief handed the
   *  model (`./brief.ts`). */
  | "no_invented_test"
  | "no_invented_provenance"
  | "traceable_numerals"
  | "first_block_answers"
  /** SPEC §7 (2026-09-29, issue 1137): the blocks every generated page
   *  carries (`./blocks.ts`). The one rule about structure. */
  | "required_blocks"
  /** SPEC §7 (D41 stage 4, issue 1250): no table cell is empty or says a
   *  value is missing (`./cells.ts`). */
  | "no_placeholder_cell"
  /** SPEC §7 (D41 stage 4, issue 1249): no sentence from the site's
   *  demo-phrase list or its menus (`./demo.ts`). */
  | "no_demo_text"
  /** SPEC §7 (owner, D51; issue 1266): the `<title>` is the search form —
   *  its length, its search term, one specific, the year's place, no banned
   *  pattern, no other page's title (`./title.ts`). */
  | "title"
  /** SPEC §7 (issue 1136; D44): no claim that the business serves a case the
   *  knowledge base does not support (`../claims/fit.ts`). */
  | "fit_claim"
  | "do_not_claim";

/** The closed list, in the order `runHardRules` runs them — so a failure
 *  list is comparable across runs. */
export const HARD_RULES: readonly HardRule[] = Object.freeze([
  "grounding",
  "rival_source",
  "no_invented_people",
  "no_unsourced_testimonial",
  "honest_row",
  "no_hidden_text",
  "no_machine_address",
  "near_duplicate",
  "no_invented_test",
  "no_invented_provenance",
  "traceable_numerals",
  "first_block_answers",
  "required_blocks",
  "no_placeholder_cell",
  "no_demo_text",
  "title",
  "fit_claim",
  "do_not_claim",
] as const);

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

/** Which page a candidate duplicated. Three sets, all of them this
 *  customer's: this rule never compares against another customer's page.
 *  That comparison is `../pipeline/elsewhere.ts` (issue 1144), which is not
 *  a rule and records no page. */
export type DuplicateKind = "published" | "measured" | "queued";

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
    /** The customer's own recorded words, read back from their list. */
    | { rule: "do_not_claim"; matchedEntry: string }
    /** The page's own sentences that claim a fit, as written. */
    | { rule: "fit_claim"; sentences: string[] }
    /** The numeral as it appears in the draft. */
    | { rule: "rival_source"; figure: string }
    | { rule: "traceable_numerals"; figure: string }
    /** Which block the page lacks — a handle, never a sentence. */
    | { rule: "required_blocks"; block: RequiredBlock }
    /** The cell's words, as the page has them. */
    | { rule: "no_placeholder_cell"; cell: string }
    /** The page's own sentence that is a demo or menu phrase. */
    | { rule: "no_demo_text"; sentence: string }
    /** What the title or its description fails — handles, never a sentence. */
    | { rule: "title"; faults: TitleFault[] };
}

/** Every site-scoped input the battery is called with — the **raw stored**
 *  inputs, so each rule module derives what it needs and no derived
 *  per-site artifact is stored anywhere. Four members and no fifth: a
 *  profile, a summary or an embedding has no member to arrive through. */
export interface SiteRuleInputs {
  businessName: string | null;
  domain: string;
  doNotClaim: string[];
  /** The rival domains and names recorded for the site. */
  rivals: string[];
}

/** The three sets a candidate is compared against, all this customer's.
 *  `rendered` is the words a reader of that page meets, never its
 *  Markdown — the same derivation on both sides of every comparison. */
export interface ComparisonSet {
  published: Array<{ ref: string; title: string; rendered: string }>;
  measured: Array<{ ref: string; title: string; rendered: string }>;
  queued: Array<{ ref: string; title: string; rendered: string }>;
}
