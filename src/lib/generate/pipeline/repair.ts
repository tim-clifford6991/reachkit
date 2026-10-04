// #1178 — a stopped draft is repaired from its failures, not re-rolled blind.
//
// Two things, both read off the battery's own failures:
//
//   1. **A repair in code** for the four rules whose breach is mechanical —
//      a sentence that should not be there, a heading that should not be
//      there, or an opening block of the wrong shape. Nothing here writes a
//      word: a repair drops a sentence or a heading, links a figure to the
//      customer's own page that states it, or splits and joins the opening.
//      The battery is then run again over the repaired text, so a repair is
//      never trusted — it is checked by the same rules as the model's page.
//
//   2. **What the next attempt is told** (`fixNotes`): each rule the page
//      broke and the sentences that broke it, so a regeneration is written
//      against its failures rather than from the same inputs blind.
//
// Deterministic, no I/O. The rules' own text model (`../rules/text.ts`) is
// the only notion of a block and a sentence used here, so a repair and the
// check that reads it cannot disagree about where a sentence ends.
import { ANSWER_FIRST_BLOCK_CHARS } from "@/lib/config/constants";
import {
  INVENTED_PROVENANCE_RES,
  INVENTED_TEST_RES,
  isPhraseBreach,
  pageTraceableNumerals,
  untraceableIn,
  type BriefRuleInputs,
} from "../rules/brief";
import { answerBoxOf } from "../rules/blocks";
import { checkInventedPeople, checkUnsourcedTestimonial } from "../rules/people";
import { factPageKeys, unsourcedRivalFigure } from "../rules/rivals";
import {
  blocksOf,
  hasLink,
  linksOf,
  renderOf,
  sentencesOf,
  sourceBlocksOf,
  splitSentences,
} from "../rules/text";
import { selfRankedIn } from "../rules/honest";
import type { HardRule, RuleFailure } from "../rules/types";

/** The rules a repair in code is tried for, in the order it is applied. The
 *  opening is last because dropping a sentence can change what opens. */
export const MECHANICAL_RULES: readonly HardRule[] = Object.freeze([
  "no_invented_provenance",
  "traceable_numerals",
  // Issue 1135: a rival's figure left without its page is linked to the
  // fact's page that states it. Nothing is dropped.
  "rival_source",
  "first_block_answers",
] as const);

/** A rule the first attempt broke and the sentences that broke it, as the
 *  next attempt's prompt carries them. Model-facing only, never shown. */
export interface FixNote {
  rule: HardRule;
  sentences: string[];
}

/** What the rules about the business's own name read. */
export interface SiteNames {
  businessName: string | null;
  domain: string;
}

/** One rule's repair, as the row records it (`drafts.meta.repairs`). */
export interface RepairRecord {
  rule: HardRule;
  cleared: boolean;
}

export interface RepairInputs {
  brief: BriefRuleInputs;
  /** The customer's own pages the page's facts were read from, by address,
   *  with the text the measurement read on them. */
  sources: readonly { url: string; text: string }[];
  /** The rivals recorded for the site, for the rival-figure repair. */
  rivals?: readonly string[];
}

/** The block markers a sentence edit keeps: a quote, a heading, a list item. */
const MARKER_RE = /^[ \t]*(?:>[ \t]?|#{1,6}[ \t]+|(?:[-*+]|\d+[.)])[ \t]+)/;
const NOTE_SENTENCES_MAX = 5;

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function wordsOf(markdownFragment: string): string {
  return collapse(renderOf(markdownFragment));
}

function escaped(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The numeral standing alone — not the "12" inside "120" or "1.25". */
function numeralRe(raw: string): RegExp {
  return new RegExp(`(?<![\\d.,])${escaped(raw)}(?![\\d])`);
}

interface Edit {
  from: number;
  to: number;
  text: string;
}

function applyEdits(markdown: string, edits: readonly Edit[]): string {
  let out = markdown;
  for (const edit of [...edits].sort((x, y) => y.from - x.from)) {
    out = out.slice(0, edit.from) + edit.text + out.slice(edit.to);
  }
  return out.replace(/\n{3,}/g, "\n\n").replace(/^\n+/, "");
}

/** Each sentence of each block through `fn`: a string replaces it, `null`
 *  drops it, and a block left with no sentence is dropped whole. */
function mapSentences(markdown: string, fn: (piece: string) => string | null): string {
  const edits: Edit[] = [];
  for (const block of sourceBlocksOf(markdown)) {
    const marker = MARKER_RE.exec(block.raw)?.[0] ?? "";
    const pieces = splitSentences(block.raw.slice(marker.length));
    const mapped = pieces.map(fn);
    if (mapped.every((piece, index) => piece === pieces[index])) continue;
    const kept = mapped.filter((piece): piece is string => piece !== null && piece.trim() !== "");
    edits.push({ from: block.from, to: block.to, text: kept.length === 0 ? "" : marker + kept.join(" ") });
  }
  return applyEdits(markdown, edits);
}

/** The numerals in a sentence the traceable-numerals rule fails it for. */
function untraceable(piece: string, traceable: ReadonlySet<string>): { raw: string; normalised: string }[] {
  return hasLink(piece) ? [] : untraceableIn(wordsOf(piece), traceable);
}

/** The customer's page that states this figure as the sentence uses it —
 *  the numeral with the word beside it, so a "2024" in a footer is never
 *  taken as the source of "2024 customers". `null` where none does. */
function sourceOf(raw: string, words: string, sources: RepairInputs["sources"]): string | null {
  const at = numeralRe(raw).exec(words);
  if (at === null) return null;
  const after = /^\s*(%|\p{L}+)/u.exec(words.slice(at.index + raw.length))?.[1];
  const before = /(\p{L}+)\s*$/u.exec(words.slice(0, at.index))?.[1];
  const needle =
    after === "%" ? `${raw}%` : after !== undefined ? `${raw} ${after}` : before !== undefined ? `${before} ${raw}` : null;
  if (needle === null) return null;
  const wanted = needle.toLowerCase();
  return sources.find((source) => collapse(source.text).toLowerCase().includes(wanted))?.url ?? null;
}

function repairNumerals(markdown: string, inputs: RepairInputs): string {
  const traceable = pageTraceableNumerals(markdown, inputs.brief);
  return mapSentences(markdown, (piece) => {
    const figures = untraceable(piece, traceable);
    if (figures.length === 0) return piece;
    const words = wordsOf(piece);
    let out = piece;
    for (const figure of figures) {
      const url = sourceOf(figure.raw, words, inputs.sources);
      // A figure no page of theirs states is dropped with its sentence.
      if (url === null) return null;
      out = out.replace(numeralRe(figure.raw), `[${figure.raw}](${url})`);
    }
    return out;
  });
}

/** A rival's figure with no fact's page beside it, linked to the page among
 *  the facts' that states that figure. One no page states is left for the
 *  next attempt to be told about. */
function repairRivalFigures(markdown: string, inputs: RepairInputs): string {
  const rivals = inputs.rivals ?? [];
  if (rivals.length === 0) return markdown;
  const pages = factPageKeys(inputs.sources.map((source) => source.url));
  return mapSentences(markdown, (piece) => {
    const figure = unsourcedRivalFigure(
      { text: wordsOf(piece), hasLink: hasLink(piece), links: linksOf(piece) },
      rivals,
      pages
    );
    if (figure === null || !piece.includes(figure)) return piece;
    const url = inputs.sources.find((source) => collapse(source.text).includes(figure))?.url;
    return url === undefined ? piece : piece.replace(figure, `[${figure}](${url})`);
  });
}

function fits(paragraph: string): boolean {
  return wordsOf(paragraph).length <= ANSWER_FIRST_BLOCK_CHARS.max;
}

/** The opening, made a paragraph inside the answer bound: an opening list's
 *  leading items are joined into one, and an over-long paragraph is split
 *  after the sentences that fit. Nothing is dropped. */
function repairFirstBlock(markdown: string): string {
  // A short-answer box is counted in words and written again by the model
  // that wrote it (`answerBoxRewrite`); cutting it here would cut an answer.
  if (answerBoxOf(markdown) !== null) return markdown;
  const source = sourceBlocksOf(markdown);
  const blocks = blocksOf(markdown);
  const first = blocks.findIndex((block) => !block.heading);
  const block = blocks[first];
  if (block === undefined || block.quoted) return markdown;

  if (block.listItem) {
    let end = first;
    while (blocks[end + 1]?.listItem === true) end++;
    const items = source.slice(first, end + 1).map((item) => {
      const text = item.raw.slice(MARKER_RE.exec(item.raw)?.[0].length ?? 0).trim();
      return /[.!?]$/.test(text) ? text : `${text}.`;
    });
    let taken = 0;
    while (taken < items.length && fits(items.slice(0, taken + 1).join(" "))) taken++;
    const lead = items.slice(0, taken).join(" ");
    if (taken === 0 || wordsOf(lead).length < ANSWER_FIRST_BLOCK_CHARS.min) return markdown;
    // The items left over stay a list, a blank line below the paragraph.
    const rest = taken <= end - first ? "\n" : "";
    return applyEdits(markdown, [{ from: source[first]!.from, to: source[first + taken - 1]!.to, text: lead + rest }]);
  }

  if (block.text.length <= ANSWER_FIRST_BLOCK_CHARS.max) return markdown;
  const sentences = splitSentences(source[first]!.raw);
  let taken = 0;
  while (taken < sentences.length && fits(sentences.slice(0, taken + 1).join(" "))) taken++;
  const lead = sentences.slice(0, taken).join(" ");
  if (taken === 0 || wordsOf(lead).length < ANSWER_FIRST_BLOCK_CHARS.min) return markdown;
  return applyEdits(markdown, [
    { from: source[first]!.from, to: source[first]!.to, text: `${lead}\n\n${sentences.slice(taken).join(" ")}` },
  ]);
}

/** The repairable rules among a battery's failures, in repair order. */
export function repairable(failed: readonly RuleFailure[]): HardRule[] {
  const rules = new Set(failed.map((failure) => failure.rule));
  return MECHANICAL_RULES.filter((rule) => rules.has(rule));
}

/** The page with each named rule repaired in code. Returns the input
 *  unchanged where no repair applied; the caller re-runs the battery. */
export function repairMechanical(markdown: string, rules: readonly HardRule[], inputs: RepairInputs): string {
  let out = markdown;
  for (const rule of MECHANICAL_RULES) {
    if (!rules.includes(rule)) continue;
    if (rule === "no_invented_provenance") {
      out = mapSentences(out, (piece) =>
        isPhraseBreach({ raw: piece, text: wordsOf(piece) }, INVENTED_PROVENANCE_RES, inputs.brief) ? null : piece
      );
    } else if (rule === "traceable_numerals") {
      out = repairNumerals(out, inputs);
    } else if (rule === "rival_source") {
      out = repairRivalFigures(out, inputs);
    } else {
      out = repairFirstBlock(out);
    }
  }
  return out;
}

function sentencesFor(
  markdown: string,
  failure: RuleFailure,
  brief: BriefRuleInputs,
  site?: SiteNames,
  title?: string
): string[] {
  const sentences = sentencesOf(markdown);
  switch (failure.rule) {
    // The rule is its own oracle: the blocks it still fails when handed each
    // alone are the ones that broke it.
    case "no_invented_people":
      return blocksOf(markdown)
        .filter((_, index) => checkInventedPeople({ markdown: sourceBlocksOf(markdown)[index]!.raw, businessName: site?.businessName ?? null }) !== null)
        .map((block) => block.text);
    case "no_unsourced_testimonial":
      return blocksOf(markdown)
        .filter((_, index) => checkUnsourcedTestimonial({ markdown: sourceBlocksOf(markdown)[index]!.raw }) !== null)
        .map((block) => block.text);
    case "no_invented_test":
      return sentences.filter((s) => isPhraseBreach(s, INVENTED_TEST_RES, brief)).map((s) => s.text);
    case "no_invented_provenance":
      return sentences.filter((s) => isPhraseBreach(s, INVENTED_PROVENANCE_RES, brief)).map((s) => s.text);
    case "traceable_numerals": {
      const traceable = pageTraceableNumerals(markdown, brief);
      return sourceBlocksOf(markdown)
        .flatMap((block) => splitSentences(block.raw))
        .filter((piece) => untraceable(piece, traceable).length > 0)
        .map(wordsOf);
    }
    case "rival_source": {
      const figure = failure.detail !== undefined && "figure" in failure.detail ? failure.detail.figure : null;
      if (figure === null) return [];
      return sentences.filter((s) => !s.hasLink && numeralRe(figure).test(s.text)).map((s) => s.text);
    }
    case "no_placeholder_cell":
      return failure.detail !== undefined && "cell" in failure.detail ? [failure.detail.cell] : [];
    case "no_demo_text":
      return failure.detail !== undefined && "sentence" in failure.detail ? [failure.detail.sentence] : [];
    case "do_not_claim":
      return failure.detail !== undefined && "matchedEntry" in failure.detail ? [failure.detail.matchedEntry] : [];
    case "fit_claim":
      return failure.detail !== undefined && "sentences" in failure.detail ? failure.detail.sentences : [];
    case "honest_row":
      // Empty where the page ranked nothing: the business is then missing
      // from the comparison table, which `honesty` tells the writer to build.
      return site === undefined
        ? []
        : selfRankedIn({ ...site, title: title ?? "", markdown, pageType: "market_comparison" });
    case "first_block_answers": {
      const first = blocksOf(markdown).find((block) => !block.heading);
      return first === undefined ? [] : [first.text];
    }
    // Not a sentence: the block the page lacks, by its handle.
    case "required_blocks":
      return failure.detail !== undefined && "block" in failure.detail ? [failure.detail.block] : [];
    default:
      return [];
  }
}

/** What the next attempt is told: every rule this page broke, with the
 *  sentences that broke it where a rule can point at them. */
export function fixNotes(
  markdown: string,
  failed: readonly RuleFailure[],
  brief: BriefRuleInputs,
  site?: SiteNames,
  /** The title as written, which `honest_row` reads beside the text. */
  title?: string
): FixNote[] {
  return failed.map((failure) => ({
    rule: failure.rule,
    sentences: [...new Set(sentencesFor(markdown, failure, brief, site, title))].slice(0, NOTE_SENTENCES_MAX),
  }));
}
