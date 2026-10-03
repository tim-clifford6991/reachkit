// BUILD §8 — the closed hard-rule vocabulary.
//
// §8 states seven hard rules "enforced in code, not prompts". Read as
// checks over a finished draft they are nine, because rule 2 ("no invented
// people") is two checks: an attributed quotation and an unsourced
// testimonial. Issue 475 adds five more that read the brief, issue 900 adds
// `page_frame` — the one rule about stance rather than about a claim — and
// issue 1137 adds `required_blocks`, the one about structure: sixteen in
// all. `no_private_figure` was one more until issue 1187 measured it:
// `./figures.ts` says why it went.
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

/** The sixteen checks, in the order they run. `do_not_claim` is §8's fourth
 *  rule and lives in `../claims/`; every other member is a deterministic
 *  pass over finished text in this directory. */
export type HardRule =
  | "grounding"
  | "rival_source"
  | "no_invented_people"
  | "no_unsourced_testimonial"
  | "brand_gap"
  /** SPEC §7 (2026-09-19, issue 900): the page's stance, beside `brand_gap`'s
   *  opening bound, because they are the same promise at two scales — the
   *  reader's question comes first, and stays first. */
  | "page_frame"
  | "no_hidden_text"
  | "no_machine_address"
  | "near_duplicate"
  /** SPEC §7 · issue 475: rules 8–12, which read what the brief handed the
   *  model (`./brief.ts`). */
  | "no_invented_test"
  | "no_invented_provenance"
  | "no_new_question_heading"
  | "traceable_numerals"
  | "first_block_answers"
  /** SPEC §7 (2026-09-29, issue 1137): the blocks every generated page
   *  carries (`./blocks.ts`). The one rule about structure. */
  | "required_blocks"
  | "do_not_claim";

/** The closed list, in the order `runHardRules` runs them — so a failure
 *  list is comparable across runs. */
export const HARD_RULES: readonly HardRule[] = Object.freeze([
  "grounding",
  "rival_source",
  "no_invented_people",
  "no_unsourced_testimonial",
  "brand_gap",
  "page_frame",
  "no_hidden_text",
  "no_machine_address",
  "near_duplicate",
  "no_invented_test",
  "no_invented_provenance",
  "no_new_question_heading",
  "traceable_numerals",
  "first_block_answers",
  "required_blocks",
  "do_not_claim",
] as const);

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
 *  customer's: nothing is ever compared against another customer's page. */
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
    /** The numeral as it appears in the draft. */
    | { rule: "rival_source"; figure: string }
    | { rule: "traceable_numerals"; figure: string }
    /** Which block the page lacks — a handle, never a sentence. */
    | { rule: "required_blocks"; block: RequiredBlock };
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
