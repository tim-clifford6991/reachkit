// #1178 — a stopped draft is repaired from its failures, not re-rolled blind.
//
// Two things, both read off the battery's own failures:
//
//   1. **A repair in code** for the rules whose breach is mechanical. Nothing here writes a word: a repair drops a
//      sentence (and what refers back to it) or a heading, links a figure to the page that states it, or splits and
//      joins the opening. The battery then reads the repaired text again, so a repair is never trusted.
//
//   2. **What the next attempt is told** (`fixNotes`): each rule the page broke and the sentences that broke it, so a
//      regeneration is written against its failures rather than from the same inputs blind.
//
// Deterministic, no I/O. The rules' own text model (`../rules/text.ts`) is the only notion of a block and a sentence
// used here, so a repair and the check that reads it cannot disagree about where a sentence ends.
import { literalClaimMatch } from "../claims/literal";
import { widenNumberLinks } from "../links/text";
import { ANSWER_FIRST_BLOCK_CHARS } from "@/lib/config/constants";
import {
  INVENTED_PROVENANCE_RES,
  INVENTED_TEST_RES,
  isPhraseBreach,
  pageTraceableNumerals,
  poolPassages,
  untraceableIn,
  withheldMeasurements,
  type BriefRuleInputs,
} from "../rules/brief";
import { ownMeasurementIn } from "../rules/figures";
import { PAGE_BLOCKS, PROSE } from "@/lib/config/constants";
import { answerBoxOf, renumberSteps } from "../rules/blocks";
import { brandTokens, namesBrand } from "../rules/brand";
import { checkInventedPeople, checkUnsourcedTestimonial } from "../rules/people";
import { proseScore, sentenceKey, type ProseRuleInputs } from "../rules/prose";
import { checkRivalNegative, checkRivalScope, checkRivalSource, deniedRivals, factPageKeys, namedRivals, unsourcedRivalFigure, type NamedRival } from "../rules/rivals";
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
import { leaningSections } from "../rules/standalone";
import type { Language } from "@/lib/locale/locales";
import type { HardRule, RuleFailure } from "../rules/types";
import { languagePack } from "@/lib/locale/language";
import { urlKey } from "../links/select";
import type { Template } from "../templates";
import type { ContextPack } from "./pack";
import { linkedPassage } from "./compose";
import type { PageParts } from "./write";

/** The rules a repair in code is tried for, in the order it is applied. The
 *  opening is last because dropping a sentence can change what opens. */
export const MECHANICAL_RULES: readonly HardRule[] = Object.freeze([
  "no_invented_provenance",
  "traceable_numerals",
  // Issue 1135: a rival's figure left without its page is linked to the
  // fact's page that states it; a sentence still unsourced is dropped.
  "rival_source",
  // Issue 1485: a sentence that denies a rival something no source says is
  // dropped. The FAQ is the fix call's.
  "rival_negative",
  // Issue 2375: a sentence the fit check named is dropped, unless it is the
  // whole short answer. No word is written.
  "fit_claim",
  // Issue 1390: a sentence said a third time is dropped. The rest of what
  // the prose check counts takes a writer, and goes to the fix call.
  "plain_prose",
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
  /** The sentences the repair dropped, where it records them (issue 2375). */
  dropped?: string[];
}

export interface RepairInputs {
  brief: BriefRuleInputs;
  /** The customer's own pages the page's facts were read from, by address,
   *  with the text the measurement read on them. */
  sources: readonly { url: string; text: string }[];
  /** The rivals recorded for the site, for the rival-figure repair; the business's own pages (`domain`) never source one's figure. */
  rivals?: readonly string[]; domain?: string;
  /** The same rivals with their market names (issue 1485). */
  rivalsNamed?: readonly NamedRival[];
  /** What the prose check reads, so a phrase it counts too often is dropped by its own count. */
  prose?: ProseRuleInputs;
  /** The sentences the fit check named (`fit_claim`'s `detail.sentences`). */
  fit?: readonly string[];
}

/** A table's row, and the rule under its header. */
const TABLE_ROW_RE = /^[ \t]*\|.*\|[ \t]*$/;
const TABLE_RULE_RE = /^[ \t|:-]+$/;
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

/** The numeral standing alone — not the "12" inside "120" or "1.25", and
 *  not the "2" glued into "B2B" (issue 1507). */
function numeralRe(raw: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\d.,])${escaped(raw)}(?![\\p{L}\\d])`, "u");
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

/** Each sentence of each block outside a table through `fn`: a string replaces it, `null` drops it, and a block left
 *  with no sentence is dropped whole, as is one where a kept sentence after a dropped one refers back to it. A table's
 *  rows are never sentences. */
function mapSentences(markdown: string, fn: (piece: string) => string | null, language: Language = "en"): string {
  const edits: Edit[] = [], refers = languagePack(language).refersBack;
  for (const block of sourceBlocksOf(markdown)) {
    if (TABLE_ROW_RE.test(block.raw.split("\n")[0]!)) continue;
    const marker = MARKER_RE.exec(block.raw)?.[0] ?? "";
    const pieces = splitSentences(block.raw.slice(marker.length));
    const mapped = pieces.map(fn);
    if (mapped.every((piece, index) => piece === pieces[index])) continue;
    const kept = mapped.filter((piece): piece is string => piece !== null && piece.trim() !== "");
    const orphaned = mapped.some((piece, n) => piece !== null && mapped.slice(0, n).includes(null) && refers.test(wordsOf(piece)));
    edits.push({ from: block.from, to: block.to, text: kept.length === 0 || orphaned ? "" : marker + kept.join(" ") });
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
  // On number boundaries, so "4 of" is never read off "14 of".
  const states = needle === null ? null : new RegExp(`(?<![\\p{L}\\d.,])${escaped(needle.toLowerCase())}(?![\\p{L}\\d])`, "u");
  return states === null ? null : (sources.find((source) => states.test(collapse(source.text).toLowerCase()))?.url ?? null);
}

function repairNumerals(markdown: string, inputs: RepairInputs): string {
  const traceable = pageTraceableNumerals(markdown, inputs.brief);
  const withheld = withheldMeasurements(inputs.brief);
  return mapSentences(markdown, (piece) => {
    // Issue 1490: the site's own measurement on a page that is not research
    // goes with its sentence; linking it to the report would still state it.
    if (ownMeasurementIn(wordsOf(piece), withheld) !== null) return null;
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
    // Issue 1391: a link's text is never a bare figure — it takes in the
    // words the figure counts.
    return widenNumberLinks(out);
  }, inputs.prose?.language);
}

/** A rival's figure with no fact's page beside it, linked to the page among the facts' that states it as the sentence
 *  uses it, the named rival's own first. One no page states is left for the battery; a table is left whole. */
function repairRivalFigures(markdown: string, inputs: RepairInputs): string {
  const rivals = inputs.rivals ?? [], pages = factPageKeys(inputs.sources.map((source) => source.url));
  if (rivals.length === 0) return markdown;
  return mapSentences(markdown, (piece) => {
    const text = wordsOf(piece);
    const figure = unsourcedRivalFigure({ text, hasLink: hasLink(piece), links: linksOf(piece) }, rivals, pages);
    if (figure === null) return piece;
    const named = rivals.map((rival) => rival.trim().toLowerCase().split(/[.\s]/)[0] ?? "").filter((label) => label.length > 2 && text.toLowerCase().includes(label));
    const host = (url: string) => (/^[a-z]+:\/\/(?:www\.)?([^/]+)/i.exec(url)?.[1] ?? "").toLowerCase();
    const own = (url: string) => named.some((label) => host(url).includes(label));
    const d = inputs.domain?.toLowerCase().replace(/^www\./, "");
    const theirs = inputs.sources.filter((source) => d === undefined || (host(source.url) !== d && !host(source.url).endsWith(`.${d}`)));
    const url = sourceOf(figure, text, theirs.sort((a, b) => Number(own(b.url)) - Number(own(a.url))));
    return url === null ? piece : piece.replace(numeralRe(figure), `[${figure}](${url})`);
  });
}

/** The page without each sentence `rival_source` still fails when handed it alone. */
function withoutUnsourcedRivals(markdown: string, inputs: RepairInputs): string {
  const rivals = inputs.rivals ?? [];
  const named = inputs.rivalsNamed ?? namedRivals(rivals, null);
  const factPages = [...inputs.sources.map((source) => source.url), ...(inputs.brief.marketFacts ?? []).map((fact) => fact.url)];
  return withoutRivalBreaches(markdown, (piece) => checkRivalSource({ markdown: piece, rivals: [...rivals], factPages }) !== null || checkRivalScope({ markdown: piece, rivals: named, facts: inputs.brief.marketFacts }) !== null, inputs.prose?.language);
}

/** The page without each sentence a rival rule still fails handed alone; a table keeps its block and loses only such a row. */
function withoutRivalBreaches(markdown: string, fails: (piece: string) => boolean, language?: Language): string {
  return mapSentences(withoutRows(markdown, (_, raw) => fails(raw)).markdown, (piece) => (fails(piece) ? null : piece), language);
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

/** The page without a sentence's third saying and every one after it: the
 *  tagline cap (`PAGE_BLOCKS.taglineRepeats`), held in code. A heading, a
 *  table row and a pull quote are not sentences of the writer's. A phrase
 *  the prose check counts too often goes the same way: the sentences that
 *  carry it past `PROSE.repeatedPhrase`'s count are dropped, the first ones
 *  and the opening's kept. */
function dropSaidAgain(markdown: string, phrases: readonly string[]): string {
  const said = new Map<string, number>();
  const carried = new Map<string, number>();
  const { longWords, longTimes, shortTimes } = PROSE.repeatedPhrase;
  const allowed = (phrase: string): number => (phrase.split(" ").length >= longWords ? longTimes : shortTimes) - 1;
  const edits: Edit[] = [];
  let opening = true;
  for (const block of sourceBlocksOf(markdown)) {
    if (block.quoted || /^[ \t]*#{1,6}[ \t]+/.test(block.raw) || block.raw.trimStart().startsWith("|")) continue;
    const marker = MARKER_RE.exec(block.raw)?.[0] ?? "";
    const pieces = splitSentences(block.raw.slice(marker.length));
    const kept = pieces.filter((piece) => {
      const key = sentenceKey(wordsOf(piece));
      if (key === null) return true;
      const count = (said.get(key) ?? 0) + 1;
      said.set(key, count);
      const over = phrases.filter((phrase) => ` ${key} `.includes(` ${phrase} `));
      for (const phrase of over) carried.set(phrase, (carried.get(phrase) ?? 0) + 1);
      // The opening answers the search, so a later saying goes instead.
      if (opening) return true;
      return count <= PAGE_BLOCKS.taglineRepeats && over.every((phrase) => carried.get(phrase)! <= allowed(phrase));
    });
    opening = false;
    if (kept.length !== pieces.length) edits.push({ from: block.from, to: block.to, text: kept.length === 0 ? "" : marker + kept.join(" ") });
  }
  return applyEdits(markdown, edits);
}

/** A tagline's shorter core is counted only once the whole tagline is no
 *  longer said too often, so the prose check is read again after each pass. */
const PHRASE_PASSES = 3;

function dropRepeats(markdown: string, prose: ProseRuleInputs | undefined): string {
  let out = dropSaidAgain(markdown, []);
  for (let pass = 0; prose !== undefined && pass < PHRASE_PASSES; pass++) {
    const phrases = proseScore(out, prose).repeatedPhrases.map((phrase) => phrase.text);
    const next = phrases.length === 0 ? out : dropSaidAgain(out, phrases);
    if (next === out) break;
    out = next;
  }
  return out;
}

/** The repairable rules among a battery's failures, in repair order. */
export function repairable(failed: readonly RuleFailure[]): HardRule[] {
  const rules = new Set(failed.map((failure) => failure.rule));
  return MECHANICAL_RULES.filter((rule) => rules.has(rule));
}

/** The page with each named rule repaired in code. Returns the input
 *  unchanged where no repair applied; the caller re-runs the battery. */
export function repairMechanical(markdown: string, rules: readonly HardRule[], inputs: RepairInputs): string {
  return repairRecorded(markdown, rules, inputs).markdown;
}

/** `repairMechanical`, with the sentences each rule's repair dropped where it records them. */
export function repairRecorded(
  markdown: string,
  rules: readonly HardRule[],
  inputs: RepairInputs
): { markdown: string; dropped: Partial<Record<HardRule, string[]>> } {
  const dropped: Partial<Record<HardRule, string[]>> = {};
  const language = inputs.prose?.language, leaned = (text: string) => (language === undefined ? [] : leaningSections(text, language));
  let out = markdown;
  for (const rule of MECHANICAL_RULES) {
    if (!rules.includes(rule)) continue;
    const prior = out;
    if (rule === "no_invented_provenance") {
      out = mapSentences(out, (piece) => (isPhraseBreach({ raw: piece, text: wordsOf(piece) }, INVENTED_PROVENANCE_RES, inputs.brief) ? null : piece), language);
    } else if (rule === "traceable_numerals") {
      out = repairNumerals(out, inputs);
    } else if (rule === "rival_source") {
      out = withoutUnsourcedRivals(repairRivalFigures(out, inputs), inputs);
    } else if (rule === "rival_negative") {
      const rivals = inputs.rivalsNamed ?? namedRivals(inputs.rivals ?? [], null);
      out = withoutRivalBreaches(out, (piece) => deniedRivals(wordsOf(piece), rivals).length > 0 && checkRivalNegative({ markdown: piece, rivals, facts: inputs.brief.marketFacts }) !== null, language);
    } else if (rule === "fit_claim") {
      const unfit = withoutUnfit(out, inputs.fit ?? [], language);
      out = unfit.markdown;
      if (unfit.dropped.length > 0) dropped.fit_claim = unfit.dropped;
    } else if (rule === "plain_prose") {
      out = dropRepeats(out, inputs.prose);
    } else {
      out = repairFirstBlock(out);
    }
    // A section left opening on a sentence that leans on one the repair dropped is a new fault: that repair is not made.
    if (out !== prior && leaned(out).some((heading) => !leaned(prior).includes(heading))) out = prior;
    if (out === prior) delete dropped[rule];
  }
  // Issue 1507: a step dropped with its sentence leaves no gap in the count.
  return { markdown: out === markdown ? out : renumberSteps(out), dropped };
}

/** A stored FAQ without the pairs whose answer the rival-negative rule fails on its own: all of them go, or none where
 *  what is left would fall short of the template's least, and the battery then keeps the failure. Of the rules whose
 *  sentence a repair drops, only this one reads the FAQ. */
export function withoutBrokenPairs(
  faq: readonly { question: string; answer: string }[],
  a: { min: number; rivals: readonly NamedRival[]; facts: BriefRuleInputs["marketFacts"] }
): { faq: { question: string; answer: string }[]; dropped: string[] } {
  const broken = faq.filter((entry) => checkRivalNegative({ markdown: "", faq: [entry], rivals: a.rivals, facts: a.facts }) !== null);
  if (broken.length === 0 || faq.length - broken.length < a.min) return { faq: [...faq], dropped: [] };
  return { faq: faq.filter((entry) => !broken.includes(entry)), dropped: broken.map((entry) => entry.question) };
}

/** The page without each sentence that states a do-not-claim entry word for word, and the sentences dropped. */
export function withoutClaimed(markdown: string, list: readonly string[]): { markdown: string; dropped: string[] } {
  return withoutSentences(markdown, (words) => list.length > 0 && literalClaimMatch(words, list) !== null);
}

/** The page and its FAQ without each sentence the writer wrote about its own inputs (`writerNotes`): a list item that
 *  holds one goes whole with its line break, and a FAQ answer left empty goes with its question. Only the count is logged. */
export function withoutWriterNotes<Q extends { answer: string }>(markdown: string, faq: readonly Q[], notes: RegExp | undefined): { markdown: string; faq: Q[]; dropped: number } {
  if (notes === undefined) return { markdown, faq: [...faq], dropped: 0 };
  let dropped = 0;
  const drop = (text: string): string => {
    const edits: Edit[] = [];
    for (const block of sourceBlocksOf(text)) {
      const marker = MARKER_RE.exec(block.raw)?.[0] ?? "";
      const pieces = splitSentences(block.raw.slice(marker.length));
      const kept = pieces.filter((piece) => !notes.test(wordsOf(piece)));
      if (kept.length === pieces.length) continue;
      dropped += pieces.length - kept.length;
      const gone = /[-*+\d]/.test(marker) || kept.length === 0;
      edits.push({ from: block.from, to: gone && text[block.to] === "\n" ? block.to + 1 : block.to, text: gone ? "" : marker + kept.join(" ") });
    }
    return edits.length === 0 ? text : renumberSteps(applyEdits(text, edits));
  };
  const out = { markdown: drop(markdown), faq: faq.map((entry) => ({ ...entry, answer: drop(entry.answer) })).filter((entry) => entry.answer.trim() !== ""), dropped };
  if (dropped > 0) console.log(JSON.stringify({ event: "writer_note_dropped", count: dropped }));
  return out;
}

/** The page without each sentence `drops` takes, by the reader's words, and the sentences dropped. */
function withoutSentences(markdown: string, drops: (words: string) => boolean, language?: Language): { markdown: string; dropped: string[] } {
  const dropped: string[] = [];
  const out = mapSentences(markdown, (piece) => {
    if (!drops(wordsOf(piece))) return piece;
    dropped.push(wordsOf(piece));
    return null;
  }, language);
  return { markdown: dropped.length === 0 ? markdown : renumberSteps(out), dropped };
}

/** Issue 2375: the page without each sentence or table row the fit check named, and what was dropped. A sentence
 *  that is the whole short answer (`:::answer`) stays, and `fit_claim` with it; a block left short is a warning. */
export function withoutUnfit(markdown: string, sentences: readonly string[], language?: Language): { markdown: string; dropped: string[] } {
  const named = new Set(sentences);
  const rows = withoutRows(markdown, (row) => named.has(row));
  let out = rows.markdown;
  const dropped = [...rows.dropped];
  for (const sentence of named) {
    const next = withoutSentences(out, (words) => words === sentence, language);
    if (next.dropped.length === 0 || answerBoxOf(next.markdown) === "") continue;
    out = next.markdown;
    dropped.push(...next.dropped);
  }
  return { markdown: out, dropped };
}

/** The page without each table row, never its header, whose rendered words `drops` takes, and those rows. */
function withoutRows(markdown: string, drops: (row: string, raw: string) => boolean): { markdown: string; dropped: string[] } {
  const dropped: string[] = [];
  const lines = markdown.split("\n");
  const kept = lines.filter((line, n) => {
    if (!TABLE_ROW_RE.test(line) || TABLE_RULE_RE.test(line) || TABLE_RULE_RE.test(lines[n + 1] ?? "") || !drops(wordsOf(line), line)) return true;
    dropped.push(wordsOf(line));
    return false;
  });
  return { markdown: dropped.length === 0 ? markdown : kept.join("\n"), dropped };
}

/** The page with nothing said of the business: each table row and each sentence outside a table that names it. */
export function withoutBusiness(markdown: string, site: SiteNames): { markdown: string; dropped: string[] } {
  const tokens = brandTokens(site);
  const rows = withoutRows(markdown, (row) => namesBrand(row, tokens));
  const prose = withoutSentences(rows.markdown, (words) => namesBrand(words, tokens));
  return { markdown: prose.markdown, dropped: [...rows.dropped, ...prose.dropped] };
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
        .filter((_, index) => checkUnsourcedTestimonial({ markdown: sourceBlocksOf(markdown)[index]!.raw, ...(brief.marketFacts === undefined ? {} : { quotable: poolPassages(brief) }) }) !== null)
        .map((block) => block.text);
    case "no_invented_test":
      return sentences.filter((s) => isPhraseBreach(s, INVENTED_TEST_RES, brief)).map((s) => s.text);
    case "no_invented_provenance":
      return sentences.filter((s) => isPhraseBreach(s, INVENTED_PROVENANCE_RES, brief)).map((s) => s.text);
    case "traceable_numerals": {
      const traceable = pageTraceableNumerals(markdown, brief);
      const withheld = withheldMeasurements(brief);
      return sourceBlocksOf(markdown)
        .flatMap((block) => splitSentences(block.raw))
        .filter((piece) => untraceable(piece, traceable).length > 0 || ownMeasurementIn(wordsOf(piece), withheld) !== null)
        .map(wordsOf);
    }
    case "rival_negative":
      return failure.detail !== undefined && failure.detail.rule === "rival_negative" ? [failure.detail.sentence] : [];
    case "rival_source": {
      const said = failure.detail !== undefined && failure.detail.rule === "rival_source" ? failure.detail.sentence : undefined;
      if (said !== undefined) return [said];
      const figure = failure.detail !== undefined && "figure" in failure.detail ? failure.detail.figure : null;
      if (figure === null) return [];
      return sentences.filter((s) => !s.hasLink && numeralRe(figure).test(s.text)).map((s) => s.text);
    }
    case "no_placeholder_cell":
      return failure.detail !== undefined && "cell" in failure.detail ? [failure.detail.cell] : [];
    case "no_demo_text":
      return failure.detail !== undefined && failure.detail.rule === "no_demo_text" ? [failure.detail.sentence] : [];
    // By the headings they name; the pipeline and the fix brief say what each asks.
    case "distinct_headings":
    case "standalone_lead":
      return failure.detail !== undefined && "headings" in failure.detail ? failure.detail.headings : [];
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
    // Each habit by its handle; the pipeline says each in full (`proseNotes`).
    case "plain_prose":
      return failure.detail !== undefined && failure.detail.rule === "plain_prose" ? failure.detail.faults.map((fault) => fault.tell) : [];
    // What the title fails, by handle; the pipeline says each in full.
    case "title":
      return failure.detail !== undefined && failure.detail.rule === "title" ? failure.detail.faults : [];
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

const wordCount = (text: string): number => (text.match(/\S+/g) ?? []).length;

/** The short answer with a linked business passage after the writer's leading sentences that leave room for it: the fit
 *  fact where it has a page, else the first of the pack's own that fits. Unchanged where it links one already or none fits. */
function answerWithFact(answer: string, pack: ContextPack): string {
  const fit = pack.fitFact?.url == null ? [] : [{ passage: pack.fitFact.passage, url: pack.fitFact.url }];
  const linked = [...fit, ...pack.facts];
  const own = new Set(linked.flatMap((fact) => urlKey(fact.url) ?? []));
  if (linksOf(answer).some((url) => own.has(urlKey(url) ?? ""))) return answer;
  const sentences = splitSentences(answer.trim());
  const { min, max } = PAGE_BLOCKS.answerWords;
  const boxes = linked.map((fact) => linkedPassage(fact.passage, fact.url)).flatMap((fact) => {
    let kept = 0;
    while (kept < sentences.length && wordCount([...sentences.slice(0, kept + 1), fact].join(" ")) <= max) kept++;
    return kept === 0 ? [] : [[...sentences.slice(0, kept), fact].join(" ")];
  });
  // A box within its words is preferred, the fit fact first.
  return boxes.find((box) => wordCount(box) >= min) ?? boxes[0] ?? answer;
}

/** Owner P2b and P3 (2026-11-16): a page whose row names its fit fact states a business passage, word for word and
 *  linked, in its short answer, and the fit fact in its business section. Code adds what the writer left out and writes
 *  no other word but the section's heading. A founder's fact has no page to link, so its section is left to the writer. */
export function withFitFact(parts: PageParts, a: { pack: ContextPack; template: Pick<Template, "sections">; businessName: string | null }): PageParts {
  const fit = a.pack.fitFact;
  if (fit === undefined) return parts;
  const answer = answerWithFact(parts.answer, a.pack);
  if (fit.url === null) return { ...parts, answer };
  const asked = a.template.sections.some((slot) => slot.key === "business");
  const written = parts.sections.some((section) => section.key === "business" && section.body.trim() !== "");
  if (!asked || written || a.businessName === null) return { ...parts, answer };
  const heading = languagePack(a.pack.locale?.language ?? "en").businessHeading(a.businessName);
  const sections = [...parts.sections.filter((section) => section.key !== "business"), { key: "business", heading, body: `> ${linkedPassage(fit.passage, fit.url)}` }];
  return { ...parts, answer, sections };
}
