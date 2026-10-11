// SPEC §7 (owner, 2026-10-10, issue 1390) — the prose check: a page that
// reads as machine-written is not published as it is.
//
// The one rule about how a page reads. Every other rule guards a fact or the
// page's structure (D27); this one counts the habits a reader recognises a
// generated page by, each of them in code:
//
//   * dashes used as a sentence joint, by the thousand words;
//   * a sentence said three times, or a run of words said over and over — a
//     tagline is said at most twice (`PAGE_BLOCKS.taglineRepeats`);
//   * a list whose items all turn on the same label ("— result:");
//   * sentences all of one length;
//   * and, on an English page, the turns of phrase a model reaches for
//     (`./prose-english.ts`, and `slopless` through `./prose-lint.ts`).
//
// **Measured, not judged.** `proseScore` is the page's counts and nothing
// else; `proseFaults` holds them to `PROSE`, whose thresholds were set
// against pages people wrote (`docs/walk/prose-gate.md`, rewritten by `npm
// run eval:content -- --prose`). A count a page somebody wrote reaches is
// not a fault.
//
// **What is not the writer's is not counted.** A heading, a table, a pull
// quote and the sources list are structure or somebody else's words; a
// business fact stated word for word keeps its own punctuation and turns of
// phrase; and the target search may be said as often as the page needs. A
// fact said over and over is still said over and over: the repeats are
// counted with the fact's words in.
//
// Deterministic, no I/O. A fault carries a handle, a count and the page's
// own words — never a sentence composed here.
import { PAGE_BLOCKS, PROSE } from "@/lib/config/constants";
import type { Language } from "@/lib/locale/locales";
import { ownTells, type Tell } from "./prose-english";
import { renderOf, sourceBlocksOf, splitSentences } from "./text";
import type { RuleFailure } from "./types";

/** What a page can be stopped for, in the order the faults are listed. */
export type ProseTell =
  | "dashes"
  | "repeated_sentence"
  | "repeated_phrase"
  | "list_scaffold"
  | "even_sentences"
  | "tell_phrases";

/** One habit the page has too much of: how often, and its own words. */
export interface ProseFault {
  tell: ProseTell;
  count: number;
  /** The page's own words that showed it, the most frequent first. Empty
   *  for a fault that is a measure of the whole page. */
  found: string[];
}

export interface ProseRuleInputs {
  /** The page's language: the phrase lists are English, the counts are not. */
  language: Language;
  /** Words that are not the writer's to vary: the pack's passages, which a
   *  page states word for word. */
  passages?: readonly string[];
  /** What the page may say as often as it needs: the target search, the
   *  business's name, a product's. */
  subjects?: readonly string[];
  /** What `slopless` flagged on the page (`./prose-lint.ts`), where the
   *  caller ran it. Absent, the page is held to the counts alone. */
  flagged?: readonly Tell[];
}

/** A phrase and how often the page says it. */
export interface Counted {
  text: string;
  count: number;
}

/** The page's counts. Everything `proseFaults` decides is read off this. */
export interface ProseScore {
  words: number;
  dashes: number;
  dashesPerThousand: number;
  /** The sentences of the page's paragraphs. */
  sentences: number;
  /** How much its sentences differ in length: the standard deviation of
   *  their word counts over the mean. `null` under `PROSE.evenSentences.minSentences`. */
  burstiness: number | null;
  repeatedSentences: Counted[];
  repeatedPhrases: Counted[];
  /** A label that three or more items of one list turn on. */
  scaffolds: Counted[];
  /** English only; empty on any other page. */
  tells: Tell[];
}

const collapse = (text: string): string => text.replace(/\s+/g, " ").trim();
const wordsOf = (text: string): string[] => text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? [];
const fold = (text: string): string => wordsOf(text.toLowerCase().replace(/[’]/g, "'")).join(" ");

/** A sentence as it is compared with another: its words, lower-cased. `null`
 *  for one too short to be heard as a repeat. */
export function sentenceKey(sentence: string): string | null {
  const key = fold(sentence);
  return key.split(" ").length < PROSE.repeatedSentence.minWords ? null : key;
}
const perThousand = (count: number, words: number): number => (words === 0 ? 0 : Math.round((count / words) * 10000) / 10);

const HEADING_RE = /^[ \t]*#{1,6}[ \t]+/;
const LIST_ITEM_RE = /^[ \t]*(?:[-*+]|\d+[.)])[ \t]+/;
/** A dash that joins two halves of a sentence: an em dash, an en dash set
 *  off by spaces (the German Gedankenstrich), or two hyphens. A range
 *  ("2019–2024") is none. */
const DASH_RE = /—|\s–\s|\s--\s/g;
/** A label inside a list item, after a dash or a full stop: "— result:". */
const SCAFFOLD_RE = /(?:[—–]|\s-|[.;!?])\s+(\p{L}[\p{L} ]{1,24}?)\s?:\s/gu;

interface Piece {
  /** The words without a passage stated word for word. */
  text: string;
  /** The words as the reader meets them, passages included. */
  full: string;
  /** The list this item is in; `null` for a paragraph. */
  list: number | null;
}

/** The writer's own prose: paragraphs and list items, without the headings,
 *  the tables, the pull quotes and the passages stated word for word. */
function piecesOf(markdown: string, passages: readonly string[]): Piece[] {
  const held = passages.map(collapse).filter((passage) => passage.length >= 20);
  const out: Piece[] = [];
  let list = 0;
  let inList = false;
  for (const block of sourceBlocksOf(markdown)) {
    const item = LIST_ITEM_RE.test(block.raw);
    if (!item && inList) list++;
    inList = item;
    if (block.quoted || HEADING_RE.test(block.raw) || block.raw.trimStart().startsWith("|")) continue;
    const full = collapse(renderOf(block.raw));
    let text = full;
    for (const passage of held) text = text.split(passage).join(" ");
    text = collapse(text);
    if (full !== "") out.push({ text, full, list: item ? list : null });
  }
  return out;
}

/** That prose as Markdown a linter reads: a paragraph a block, a list as a
 *  list. What `./prose-lint.ts` is handed, so both halves of the check read
 *  the same words. */
export function proseText(markdown: string, passages: readonly string[] = []): string {
  return piecesOf(markdown, passages)
    .filter((piece) => piece.text !== "")
    .map((piece, index, kept) => {
      const item = piece.list !== null;
      const joined = item && kept[index - 1]?.list === piece.list ? "\n" : "\n\n";
      return `${index === 0 ? "" : joined}${item ? "- " : ""}${piece.text}`;
    })
    .join("");
}

function counted(counts: ReadonlyMap<string, number>, least: number): Counted[] {
  return [...counts]
    .filter(([, count]) => count >= least)
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count || b.text.length - a.text.length || a.text.localeCompare(b.text));
}

/** The longest run of words a repeated phrase is read to: longer than a
 *  tagline, so one is given whole. */
const RUN_MAX_WORDS = 30;

/** The runs of words the page says over and over: a long run
 *  (`longWords` or more) `longTimes` times, a short one `shortTimes` times.
 *  Each is given once, as the longest run said that often — "rivals instead
 *  of you", not its halves. A run inside a subject is the page's topic. */
function repeatedRuns(sentences: readonly string[], subjects: readonly string[]): Counted[] {
  const { longWords, longTimes, shortWords, shortTimes } = PROSE.repeatedPhrase;
  const folded = sentences.map((sentence) => fold(sentence).split(" ").filter(Boolean));
  const topics = subjects.map(fold).filter(Boolean);
  const kept: Counted[] = [];
  for (let size = RUN_MAX_WORDS; size >= shortWords; size--) {
    const counts = new Map<string, number>();
    for (const words of folded) {
      for (let at = 0; at + size <= words.length; at++) {
        const run = words.slice(at, at + size).join(" ");
        counts.set(run, (counts.get(run) ?? 0) + 1);
      }
    }
    for (const run of counted(counts, size >= longWords ? longTimes : shortTimes)) {
      if (kept.some((held) => held.text.includes(run.text))) continue;
      if (topics.some((topic) => topic.includes(run.text) || run.text.includes(topic))) continue;
      kept.push(run);
    }
  }
  return kept.sort((a, b) => b.count - a.count || b.text.length - a.text.length);
}

/** The page's counts. */
export function proseScore(markdown: string, a: ProseRuleInputs): ProseScore {
  const pieces = piecesOf(markdown, a.passages ?? []);
  const text = pieces.map((piece) => piece.text).filter(Boolean).join("\n");
  const words = wordsOf(text).length;
  const dashes = (text.match(DASH_RE) ?? []).length;

  const paragraphs = pieces.filter((piece) => piece.list === null);
  const sentenceTexts = pieces.flatMap((piece) => splitSentences(piece.full).map(collapse)).filter((sentence) => sentence !== "");
  const lengths = paragraphs
    .flatMap((piece) => splitSentences(piece.full))
    .map((sentence) => wordsOf(sentence).length)
    .filter((length) => length > 0);
  const mean = lengths.reduce((sum, length) => sum + length, 0) / Math.max(1, lengths.length);
  const deviation = Math.sqrt(lengths.reduce((sum, length) => sum + (length - mean) ** 2, 0) / Math.max(1, lengths.length));
  const burstiness = lengths.length < PROSE.evenSentences.minSentences || mean === 0 ? null : Math.round((deviation / mean) * 100) / 100;

  const said = new Map<string, number>();
  const asWritten = new Map<string, string>();
  for (const sentence of sentenceTexts) {
    const key = sentenceKey(sentence);
    if (key === null) continue;
    said.set(key, (said.get(key) ?? 0) + 1);
    if (!asWritten.has(key)) asWritten.set(key, sentence);
  }
  const repeatedSentences = counted(said, 2).map((row) => ({ text: asWritten.get(row.text) ?? row.text, count: row.count }));

  const repeatedPhrases = repeatedRuns(sentenceTexts, a.subjects ?? [])
    // A sentence said again whole is the fault above, counted once.
    .filter((phrase) => !repeatedSentences.some((sentence) => fold(sentence.text).includes(phrase.text) && sentence.count >= phrase.count));

  const labels = new Map<string, number>();
  const lists = new Map<number, Piece[]>();
  for (const piece of pieces) if (piece.list !== null && piece.text !== "") lists.set(piece.list, [...(lists.get(piece.list) ?? []), piece]);
  for (const items of lists.values()) {
    const inList = new Map<string, number>();
    for (const item of items) {
      for (const label of new Set([...item.text.matchAll(SCAFFOLD_RE)].map((match) => match[1]!.toLowerCase().trim()))) {
        inList.set(label, (inList.get(label) ?? 0) + 1);
      }
    }
    for (const [label, count] of inList) if (count >= PROSE.listScaffold.minItems) labels.set(label, Math.max(labels.get(label) ?? 0, count));
  }

  const tells = a.language !== "en" ? [] : [...ownTells(text), ...(a.flagged ?? [])].sort((x, y) => y.count - x.count || x.text.localeCompare(y.text));
  return {
    words,
    dashes,
    dashesPerThousand: perThousand(dashes, words),
    sentences: lengths.length,
    burstiness,
    repeatedSentences,
    repeatedPhrases,
    scaffolds: counted(labels, PROSE.listScaffold.minItems),
    tells,
  };
}

const FOUND_MAX = 5;
const top = (rows: readonly { text: string }[]): string[] => rows.slice(0, FOUND_MAX).map((row) => row.text);

/** The score held to `PROSE`: each habit the page has too much of. */
export function proseFaults(score: ProseScore): ProseFault[] {
  const out: ProseFault[] = [];
  // A page too short to measure by the thousand is held to the count alone.
  if (score.dashes >= PROSE.dashes.least && score.dashesPerThousand > PROSE.dashes.perThousand) {
    out.push({ tell: "dashes", count: score.dashes, found: [] });
  }
  const sentences = score.repeatedSentences.filter((row) => row.count > PAGE_BLOCKS.taglineRepeats);
  if (sentences.length > 0) out.push({ tell: "repeated_sentence", count: sentences[0]!.count, found: top(sentences) });
  if (score.repeatedPhrases.length > 0) {
    out.push({ tell: "repeated_phrase", count: score.repeatedPhrases[0]!.count, found: top(score.repeatedPhrases) });
  }
  if (score.scaffolds.length > 0) out.push({ tell: "list_scaffold", count: score.scaffolds[0]!.count, found: top(score.scaffolds) });
  if (score.burstiness !== null && score.burstiness < PROSE.evenSentences.least) {
    out.push({ tell: "even_sentences", count: score.sentences, found: [] });
  }
  // One construction used again and again, or many of them together. A
  // stock word is counted with the rest and is no construction.
  const byPattern = new Map<string, number>();
  for (const tell of score.tells) if (tell.word !== true) byPattern.set(tell.pattern, (byPattern.get(tell.pattern) ?? 0) + tell.count);
  const habits = new Set([...byPattern].filter(([, count]) => count >= PROSE.tellPhrases.samePattern).map(([pattern]) => pattern));
  const tells = tellCount(score);
  if (habits.size > 0 || tells >= PROSE.tellPhrases.most) {
    const shown = habits.size > 0 && tells < PROSE.tellPhrases.most ? score.tells.filter((tell) => habits.has(tell.pattern)) : score.tells;
    out.push({ tell: "tell_phrases", count: shown.reduce((sum, tell) => sum + tell.count, 0), found: top(shown) });
  }
  return out;
}

/** How many tell phrases the page carries, every pattern together. */
export function tellCount(score: ProseScore): number {
  return score.tells.reduce((sum, tell) => sum + tell.count, 0);
}

/** The prose check. Asks nothing where `prose` is absent: a page a customer
 *  wrote or edited is theirs to word. */
export function checkProse(a: { markdown: string; prose: ProseRuleInputs | null }): RuleFailure | null {
  if (a.prose === null) return null;
  const faults = proseFaults(proseScore(a.markdown, a.prose));
  return faults.length === 0 ? null : { rule: "plain_prose", detail: { rule: "plain_prose", faults } };
}

const quoted = (found: readonly string[]): string => found.map((text) => `"${text}"`).join("; ");

/** What the fix call is told of each fault: the count against its limit and
 *  the page's own words. Model-facing only, never shown. */
export function proseNotes(faults: readonly ProseFault[]): string[] {
  return faults.map((fault) => {
    switch (fault.tell) {
      case "dashes":
        return `dashes: the page joins sentences with ${fault.count} dashes ("—" or " – "). Rewrite those sentences with a full stop, a comma or "and", and leave at most two; a dash inside a fact quoted word for word stays.`;
      case "repeated_sentence":
        return `repeated sentence: said ${fault.count} times — ${quoted(fault.found)}. Say it at most ${PAGE_BLOCKS.taglineRepeats} times on the whole page; where it stands again, write what that paragraph adds instead.`;
      case "repeated_phrase":
        return `repeated phrase: said ${fault.count} times — ${quoted(fault.found)}. Say it at most ${PAGE_BLOCKS.taglineRepeats} times; elsewhere say the point in other words or leave it out.`;
      case "list_scaffold":
        return `list label: ${fault.count} items of one list turn on the same label — ${quoted(fault.found)}. Write each item as its own sentence, with no label.`;
      case "even_sentences":
        return "sentence length: the sentences are all about one length. Mix short sentences of a few words with longer ones.";
      case "tell_phrases":
        return `stock phrasing: ${fault.count} turns of phrase a reader knows a generated page by — ${quoted(fault.found)}. Rewrite each as a plain statement of what is so.`;
    }
  });
}
