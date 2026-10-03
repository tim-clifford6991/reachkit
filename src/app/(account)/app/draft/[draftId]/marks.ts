// SPEC §7 (2026-09-20, #908) — "A sentence that breaks a hard rule or
// matches the never-claim list is marked where it stands as it is typed."
//
// This module answers one question, for the buffer as it now stands: which
// rules does this text break, and where in it. It is the editor's lint
// source (issue 932) and the preview's mark comes from the same answer, so
// the underline in the text and the mark on the page cannot point at
// different sentences.
//
// **It implements no rule.** Every verdict below is `@/lib/generate/rules`'
// own function, called with the same arguments the battery calls it with —
// `runHardRules` is the list, and a rule renamed or retyped there is a
// compile error here. The never-claim half is `literalClaimMatch`, the very
// comparison `claimCheck` makes before it spends anything on a model. A
// second implementation of any of them is the thing this file exists to
// avoid: the mark a founder sees while typing and the verdict that holds
// the page would then be two opinions about the same words.
//
// **Thirteen of the seventeen run here. Four do not, and are named.**
//
//   `grounding`          reads the *source page's* text as the measurement
//                        fetched it — a document this screen does not hold
//                        and would have to fetch to hold. Its break is
//                        already on the screen in its own words: the
//                        grounded block prints the fact the edit removed.
//   `near_duplicate`     compares the page against every other page of the
//                        site (published, measured and queued). That corpus
//                        is the site's whole content; shipping it to a
//                        browser to underline one sentence is not a trade
//                        worth making, and the rule is not sentence-shaped
//                        in any case — its answer is about the page.
//   `no_private_figure`  is built from the stored report and every
//                        opportunity (`buildPrivateFigureRegister`). Same
//                        objection, same size.
//
//   `required_blocks`    binds what ReachKit generates and asks nothing of
//                        a founder's own edit (issue 1137): a page they
//                        rewrote into five sections has broken no rule.
//
// The first three still run on every save, where they always have, and all three
// still hold the page. What this file changes is *when the founder hears
// about the other thirteen*, not which rules decide.
//
// **Where a break is placed.** A `RuleFailure` carries a handle and, for
// four of the rules, a recorded value — never a sentence and never an
// offset (`rules/types.ts` says why). So a break is placed one of three
// ways, in this order:
//
//   1. **By the value it names.** `do_not_claim` names the customer's own
//      entry; `rival_source`, `traceable_numerals` and `no_private_figure`
//      name the numeral as it appears. The value is found in the source and
//      the mark is widened to the sentence holding it. That is the one the
//      done-when asks for: "typing a never-claim phrase underlines it".
//   2. **By asking the rule again, block by block.** For a rule whose own
//      implementation iterates `blocksOf`, the offending block is the first
//      block the same function still reports when it is handed that block
//      alone. The rule is the oracle; nothing here re-decides it. The
//      blocks are `sourceBlocksOf`'s — the splitter the rules themselves
//      use, now carrying the offsets it always computed.
//   3. **Not at all.** A rule whose answer is about the page rather than a
//      sentence — `brand_gap` reads an opening window, `page_frame` counts
//      mentions across the whole of it — gets a mark at the head of the
//      document and a sentence that says so. Guessing a span for one of
//      those would be the rule implemented a second time, badly.
"use client";

import type { CopyKey } from "@/lib/presentation/copy";
import { literalClaimMatch } from "@/lib/generate/claims/literal";
import { checkBrandGap } from "@/lib/generate/rules/brandgap";
import {
  checkFirstBlockAnswers,
  checkInventedProvenance,
  checkInventedTest,
  checkNewQuestionHeading,
  checkTraceableNumerals,
  type BriefRuleInputs,
} from "@/lib/generate/rules/brief";
import { checkPageFrame } from "@/lib/generate/rules/frame";
import { checkHiddenText } from "@/lib/generate/rules/hidden";
import { checkMachineAddress } from "@/lib/generate/rules/machine";
import { checkInventedPeople, checkUnsourcedTestimonial } from "@/lib/generate/rules/people";
import { checkRivalSource } from "@/lib/generate/rules/rivals";
import { renderOf, sourceBlocksOf, withoutReferenceLists } from "@/lib/generate/rules/text";
import type { HardRule, RuleFailure } from "@/lib/generate/rules/types";
import type { OpportunityType } from "@/lib/opportunities/types";

/**
 * Every site-scoped fact the thirteen live rules read, and no more.
 *
 * All of them are small and all of them are already on this screen: the
 * customer's own lists, their own brand and domain, the searches the row
 * targets, the passages the brief chose and the headings of the page as
 * ReachKit wrote it. Nothing here is a corpus, a report or a register —
 * which is the whole reason those three rules are the save's.
 */
export interface MarkInputs {
  /** The title as it now stands. The frame rule reads it. */
  title: string;
  businessName: string | null;
  domain: string;
  /** The customer's own never-claim list, word for word as they recorded it. */
  doNotClaim: readonly string[];
  rivals: readonly string[];
  opportunityType: OpportunityType | null;
  /** What the brief handed the writer — rules 8–12 read nothing else. */
  brief: BriefRuleInputs;
}

/**
 * The thirteen rules this file can decide, and the sentence each speaks.
 *
 * A total record over the subset, so a rule added to `marks.ts` with no
 * sentence is a compile error rather than a mark that underlines a
 * sentence and says nothing about why. The three the save keeps are
 * deliberately absent: this screen never speaks for a check it did not
 * run, which is `checks.ts`'s own rule applied to a lint mark.
 */
export const BREAK_COPY_KEY = Object.freeze({
  rival_source: "draft.editor.break.rival-source",
  no_invented_people: "draft.editor.break.no-invented-people",
  no_unsourced_testimonial: "draft.editor.break.no-unsourced-testimonial",
  brand_gap: "draft.editor.break.brand-gap",
  page_frame: "draft.editor.break.page-frame",
  no_hidden_text: "draft.editor.break.no-hidden-text",
  no_machine_address: "draft.editor.break.no-machine-address",
  no_invented_test: "draft.editor.break.no-invented-test",
  no_invented_provenance: "draft.editor.break.no-invented-provenance",
  no_new_question_heading: "draft.editor.break.no-new-question-heading",
  traceable_numerals: "draft.editor.break.traceable-numerals",
  first_block_answers: "draft.editor.break.first-block-answers",
  do_not_claim: "draft.editor.break.do-not-claim",
} as const satisfies Readonly<Partial<Record<HardRule, CopyKey>>>);

/** The rules the editor decides live. Its members are exactly the keys
 *  above, so the two cannot drift. */
export type LiveRule = keyof typeof BREAK_COPY_KEY;

/** One rule this text breaks, and where it stands. */
export interface Break {
  rule: LiveRule;
  /** The span in the Markdown. `from === to === 0` is a rule that speaks
   *  for the page rather than for a sentence (see the header, case 3). */
  from: number;
  to: number;
  /** The customer's own recorded words, where the rule named them — the
   *  never-claim entry it matched. Never anything this product wrote. */
  entry?: string;
  /** The numeral as it appears in the draft, where the rule named one. */
  figure?: string;
}

/** Whether a break points at a span a reader can be shown. */
export function isPlaced(found: Break): boolean {
  return found.to > found.from;
}

/**
 * The sentence holding `at`, in the source's own coordinates.
 *
 * `SENTENCE_END_RE`'s rule, applied to the block rather than to the
 * document: a sentence ends at `.`, `!` or `?` followed by whitespace.
 * `rules/text.ts` owns that definition and states why it is deliberately
 * over-eager; this walks the same boundaries outward from an offset
 * instead of splitting into a list, which is the same rule read the other
 * way round.
 */
function sentenceAround(source: string, at: number, length: number): { from: number; to: number } {
  let from = 0;
  for (let i = at - 1; i > 0; i--) {
    if (/[.!?]/.test(source[i - 1] ?? "") && /\s/.test(source[i] ?? "")) {
      from = i;
      break;
    }
  }
  let to = source.length;
  for (let i = at + length; i < source.length; i++) {
    if (/[.!?]/.test(source[i - 1] ?? "") && /\s/.test(source[i] ?? "")) {
      to = i;
      break;
    }
  }
  while (from < to && /\s/.test(source[from] ?? "")) from += 1;
  while (to > from && /\s/.test(source[to - 1] ?? "")) to -= 1;
  return { from, to };
}

/**
 * Where a value the rule named stands in the source, widened to its
 * sentence — or `null` where it does not stand there literally.
 *
 * The search is made on the Markdown and then, failing that, block by block
 * on the words a reader meets: a never-claim entry the customer recorded
 * plainly may be typed with emphasis inside it (`free **forever**`), and
 * the rule matched the reader's words, so the mark has to be able to find
 * them there too. Where the reader's words are the only place it occurs the
 * whole block is marked, because a rendered offset is not a source offset
 * and mapping one to the other is a guess.
 */
function placeValue(markdown: string, value: string): { from: number; to: number } | null {
  const needle = value.trim();
  if (needle.length === 0) return null;

  const direct = markdown.toLocaleLowerCase("en-US").indexOf(needle.toLocaleLowerCase("en-US"));
  if (direct >= 0) return sentenceAround(markdown, direct, needle.length);

  const wanted = needle.replace(/\s+/g, " ").toLocaleLowerCase("en-US");
  for (const block of sourceBlocksOf(markdown)) {
    const read = renderOf(block.raw).replace(/\s+/g, " ").toLocaleLowerCase("en-US");
    if (read.includes(wanted)) return { from: block.from, to: block.to };
  }
  return null;
}

/** A rule this product places by asking the rule itself about one block at
 *  a time — every member's own implementation iterates `blocksOf`, so a
 *  block it reports in isolation is a block it reported in the whole. */
const BLOCK_SCOPED: Readonly<Partial<Record<HardRule, (markdown: string) => RuleFailure | null>>> =
  Object.freeze({
    no_hidden_text: (markdown) => checkHiddenText({ markdown }),
    no_machine_address: (markdown) => checkMachineAddress({ rendered: renderOf(markdown) }),
    no_unsourced_testimonial: (markdown) => checkUnsourcedTestimonial({ markdown }),
  });

/** The first block the rule still reports when handed that block alone. */
function placeByAsking(markdown: string, rule: HardRule, inputs: MarkInputs): { from: number; to: number } | null {
  const ask = BLOCK_SCOPED[rule] ?? askWithInputs(rule, inputs);
  if (ask === undefined) return null;
  for (const block of sourceBlocksOf(markdown)) {
    if (ask(block.raw) !== null) return { from: block.from, to: block.to };
  }
  return null;
}

/** The block-scoped rules that need a site fact as well as the text. Kept
 *  apart from the table above only because they close over `inputs`. */
function askWithInputs(
  rule: HardRule,
  inputs: MarkInputs
): ((markdown: string) => RuleFailure | null) | undefined {
  if (rule === "no_invented_people") {
    return (markdown) => checkInventedPeople({ markdown, businessName: inputs.businessName });
  }
  if (rule === "no_invented_test") {
    return (markdown) => checkInventedTest({ markdown, brief: inputs.brief });
  }
  if (rule === "no_invented_provenance") {
    return (markdown) => checkInventedProvenance({ markdown, brief: inputs.brief });
  }
  if (rule === "traceable_numerals") {
    // Reached only where the value search failed — a numeral the rule
    // named but that is not in the source as written.
    return (markdown) => checkTraceableNumerals({ markdown, brief: inputs.brief });
  }
  if (rule === "no_new_question_heading") {
    // Its scope is a heading, and a heading is a block. Asked with the same
    // brief, so a heading the outline already had is not reported.
    return (markdown) => checkNewQuestionHeading({ markdown, brief: inputs.brief });
  }
  return undefined;
}

/**
 * Every rule the text as it now stands breaks, placed.
 *
 * Pure, and deliberately: it takes the buffer and the facts, and it reads
 * nothing else — so the editor can run it on a pause, the tests can run it
 * with no DOM, and the answer is the same in both.
 */
export function liveBreaks(source: string, inputs: MarkInputs): Break[] {
  // The sources list is not the page's own words (issue 1135): blanked,
  // with every offset kept, exactly as the battery reads the page.
  const body = withoutReferenceLists(source);
  const rendered = renderOf(body);
  const site = { businessName: inputs.businessName, domain: inputs.domain };

  const failures: RuleFailure[] = [];
  const push = (failure: RuleFailure | null): void => {
    if (failure !== null) failures.push(failure);
  };

  // The battery's own order (`HARD_RULES`), minus the three named in the
  // header, so a break list reads the way a recorded failure list reads.
  push(checkRivalSource({ markdown: body, rivals: [...inputs.rivals] }));
  push(checkInventedPeople({ markdown: body, businessName: inputs.businessName }));
  push(checkUnsourcedTestimonial({ markdown: body }));
  push(checkBrandGap({ rendered, ...site }));
  push(
    checkPageFrame({
      title: inputs.title,
      markdown: body,
      rendered,
      ...site,
      opportunityType: inputs.opportunityType,
      queries: inputs.brief.queries,
    })
  );
  push(checkHiddenText({ markdown: body }));
  push(checkMachineAddress({ rendered }));
  // The three that read the brief's **passages** run only where the brief
  // was recorded. Empty is "not recorded", never "no facts": against an
  // empty list `checkTraceableNumerals` reports every figure on the page
  // and `isHandedWords` can excuse nothing, so a draft written before
  // `meta.factsUsed` existed would be underlined end to end for saying
  // what it was told to say. The save still runs all three, against the
  // set the brief actually chose.
  if (inputs.brief.facts.length > 0) {
    push(checkInventedTest({ markdown: body, brief: inputs.brief }));
    push(checkInventedProvenance({ markdown: body, brief: inputs.brief }));
    push(checkTraceableNumerals({ markdown: body, brief: inputs.brief }));
  }
  // This one reads the brief's *headings*, which are `headingsOf` the page
  // as ReachKit wrote it — a value every draft has, recorded or not.
  push(checkNewQuestionHeading({ markdown: body, brief: inputs.brief }));
  push(checkFirstBlockAnswers({ markdown: body }));

  const breaks = failures.map((failure) => place(body, failure, inputs));

  // §8's fourth rule, string half. Last, as the battery runs it last.
  const matched = literalClaimMatch(body, inputs.doNotClaim);
  if (matched !== null) {
    const at = placeValue(body, matched);
    breaks.push({ rule: "do_not_claim", entry: matched, from: at?.from ?? 0, to: at?.to ?? 0 });
  }
  return breaks;
}

/** One failure, given a span. */
function place(markdown: string, failure: RuleFailure, inputs: MarkInputs): Break {
  const figure =
    failure.detail !== undefined && "figure" in failure.detail ? failure.detail.figure : undefined;

  const at =
    figure !== undefined
      ? placeValue(markdown, figure)
      : failure.rule === "first_block_answers"
        ? // Its own subject, by definition: "the first block that is not a
          // heading" is what the rule looks at and is where the break is.
          (sourceBlocksOf(markdown).find((block) => !/^[ \t]*#{1,6}[ \t]+/.test(block.raw)) ?? null)
        : placeByAsking(markdown, failure.rule, inputs);

  return { rule: failure.rule as LiveRule, figure, from: at?.from ?? 0, to: at?.to ?? 0 };
}
