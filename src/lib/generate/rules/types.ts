// BUILD §8 — the closed hard-rule vocabulary.
//
// §8 states seven hard rules "enforced in code, not prompts". Read as
// checks over a finished draft they are ten, because three of §8's rules
// are two checks each: rule 2 ("no invented people") is an attributed
// quotation and an unsourced testimonial; rule 1's grounding and rule 6's
// rival sourcing are joined by the register of figures only ReachKit holds,
// which is the same promise ("every figure a reader meets is one they can
// open a source for") applied to the customer's own numbers.
//
// Nothing in this file computes and nothing in it speaks: it is types plus
// one frozen list, so an eleventh rule is a compile error at every call
// site rather than a value some module has to remember to reject.
//
// **There is no `message` anywhere in `RuleFailure`.** A failure carries a
// handle and stored values — the customer's own recorded words, a numeral
// as it appears in the draft, the page a candidate duplicated — and never a
// sentence, because a sentence the product speaks is a copy key and a
// sentence a model wrote is not shown at all.
import type { Opportunity } from "@/lib/opportunities";
import type { StoredReport } from "@/lib/scan/report";

/** The ten checks, in the order they run. `do_not_claim` is §8's fourth
 *  rule and lives in `../claims/`; every other member is a deterministic
 *  pass over finished text in this directory. */
export type HardRule =
  | "grounding"
  | "rival_source"
  | "no_private_figure"
  | "no_invented_people"
  | "no_unsourced_testimonial"
  | "brand_gap"
  | "no_hidden_text"
  | "no_machine_address"
  | "near_duplicate"
  | "do_not_claim";

/** The closed list, in the order `runHardRules` runs them — so a failure
 *  list is comparable across runs. */
export const HARD_RULES: readonly HardRule[] = Object.freeze([
  "grounding",
  "rival_source",
  "no_private_figure",
  "no_invented_people",
  "no_unsourced_testimonial",
  "brand_gap",
  "no_hidden_text",
  "no_machine_address",
  "near_duplicate",
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
    | { rule: "no_private_figure"; figure: string };
}

/** Every site-scoped input the battery is called with — the **raw stored**
 *  inputs, so each rule module derives what it needs and no derived
 *  per-site artifact is stored anywhere. Six members and no seventh: a
 *  profile, a summary or an embedding has no member to arrive through.
 *
 *  `report` and `opportunities` are the two places every figure the product
 *  measured for a site is held, and they are what the private-figure
 *  register is built from. */
export interface SiteRuleInputs {
  businessName: string | null;
  domain: string;
  doNotClaim: string[];
  /** The rival domains and names recorded for the site. */
  rivals: string[];
  report: StoredReport;
  opportunities: Opportunity[];
}

/** The three sets a candidate is compared against, all this customer's.
 *  `rendered` is the words a reader of that page meets, never its
 *  Markdown — the same derivation on both sides of every comparison. */
export interface ComparisonSet {
  published: Array<{ ref: string; title: string; rendered: string }>;
  measured: Array<{ ref: string; title: string; rendered: string }>;
  queued: Array<{ ref: string; title: string; rendered: string }>;
}
