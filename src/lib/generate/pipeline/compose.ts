// SPEC §7 (2026-09-29, *What every page carries*, issue 1137; D41, D42) —
// the page, put together in code from the parts the writer returned.
//
// The writer returns the short answer, the takeaways, one body per section
// of its type's template, the closing line and the buyer questions, and this
// module lays them out: the `:::answer` box, the `:::takeaways` box, each
// section under its heading in the template's order, the closing line last.
// So the blocks' order and the heading levels are the page's by construction,
// not by the model's good behaviour — the round-1 review's instruction
// (owner, 2026-10-02): "enforce these in code, not only in the prompt".
//
// `tidy` is the rest of that review, applied to every string a reader will
// meet: a prompt's fact labels are stripped; "actually" is cut; a pull-quote
// that is not a handed passage word for word is dropped (a quotation is
// admitted only word for word — SPEC §7, *Two pools of facts*); a sentence
// of legal, removal or refund text, a demo caption and a byline or date line
// are dropped (the page prints its own byline and dates); and a promise of
// the business's own is said at most twice. Nothing here writes a word: it
// lays out, cuts and drops, and the battery reads what is left.
//
// Deterministic, no I/O.
import { PAGE_BLOCKS, TITLE } from "@/lib/config/constants";
import { FACT_LABEL_RE } from "../rules/blocks";
import { SENTENCE_END_RE, isQuestionShaped, renderOf, sourceBlocksOf } from "../rules/text";
import type { Template } from "../templates";
import type { DraftBody, FaqEntry, PageParts } from "./write";

export interface TidyInputs {
  /** The passages the brief selected, word for word. */
  facts: readonly string[];
  /** What the business promises, in its own words (`profile.promises`). */
  promises: readonly string[];
  /** The target search and the searches it absorbed. */
  queries: readonly string[];
  /** Names that keep their capital in a heading: the business, its rivals. */
  names: readonly string[];
  /** Each passage with the page it was read from, so a pull-quote of one
   *  that came back without its link is given it (SPEC §7, 2026-09-29, D5:
   *  "renders as a quotation with a small link to its source"). */
  sources?: readonly { passage: string; url: string }[];
  /** An update's live page and the current year (D51): the page keeps the
   *  live title, and its year moves only where the body changed. */
  live?: { title: string; markdown: string; year: number };
  /** Which of the titles the writer proposed is the page's (issue 1389),
   *  told the page they are for. Absent, it is the first. */
  pickTitle?: (proposed: readonly string[], on: { description: string; sections: readonly LaidSection[] }) => string;
}

const collapse = (text: string): string => text.replace(/\s+/g, " ").trim();
const lower = (text: string): string => collapse(text).toLowerCase();

// ── One title case across the site ──────────────────────────────────────

/** A word that is capitalised because of what it is, not where it stands:
 *  an acronym (`SEO`), a camel-cased name (`ChatGPT`, `WordPress`), a word
 *  with a digit (`GA4`). */
function ownsItsCapital(word: string): boolean {
  const letters = word.replace(/[^\p{L}\d]/gu, "");
  return /\d/.test(letters) || /\p{Lu}/u.test(letters.slice(1)) || (letters.length <= 1 && letters === "I");
}

/** Words that are capitalised mid-sentence somewhere in `texts` — the proper
 *  nouns this page's own prose and facts establish. */
export function properNouns(texts: readonly string[], names: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const name of names) for (const word of name.split(/\s+/)) if (word !== "") out.add(word.toLowerCase());
  for (const text of texts) {
    // Prose only: a heading or a table's header row is capitalised by its
    // writer's habit, which is the thing being corrected.
    const prose = text.split("\n").filter((line) => !/^[ \t]*(?:#|\|)/.test(line)).join("\n");
    for (const sentence of renderOf(prose).split(/(?<=[.!?:])\s+|\n+/)) {
      const words = sentence.split(/\s+/).filter(Boolean);
      for (const word of words.slice(1)) {
        const bare = word.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
        if (/^\p{Lu}\p{Ll}/u.test(bare)) out.add(bare.toLowerCase());
      }
    }
  }
  return out;
}

/** A title or heading in sentence case (issue 1137, the round-1 review's
 *  "one title case across the site"): the first word capitalised, and after
 *  it only the words that own their capital or are proper nouns. A heading
 *  with at most one other capitalised word is already in sentence case — the
 *  one word is a name — and is left exactly as written. */
export function sentenceCase(text: string, proper: ReadonlySet<string>): string {
  const bareOf = (token: string): string => token.replace(/^[^\p{L}\d]+|[^\p{L}\d]+$/gu, "");
  const tokens = text.split(/\s+/).filter(Boolean);
  const plain = tokens.slice(1).map(bareOf).filter((bare) => bare.length >= 4 && !ownsItsCapital(bare));
  const capitalised = plain.filter((bare) => /^\p{Lu}/u.test(bare)).length;
  if (capitalised < 2 || capitalised * 2 < plain.length) {
    return text.replace(/\p{L}/u, (letter) => letter.toUpperCase());
  }
  let afterBreak = false;
  return tokens
    .map((token, index) => {
      const bare = bareOf(token);
      const keep = afterBreak;
      afterBreak = /[:?!.]$/.test(token);
      if (bare === "" || keep || ownsItsCapital(bare)) return token;
      if (index === 0) return token.replace(/\p{L}/u, (letter) => letter.toUpperCase());
      if (proper.has(bare.toLowerCase().replace(/[’']s$/, ""))) return token;
      return token.replace(bare, bare.toLowerCase());
    })
    .join(" ");
}

// ── What a page never says ──────────────────────────────────────────────

/** Legal, removal and refund text (round-1 review). A page whose own target
 *  search asks about one of these is exempt: that is its subject. */
const LEGAL_RE =
  /\b(?:refund(?:s|ed|able)?|money[- ]back|removal requests?|takedown|right to (?:be forgotten|erasure)|terms (?:of service|of use|and conditions)|privacy policy|cookie policy|all rights reserved|data processing agreement)\b/i;
/** A caption that says what it sits beside is an example — "Demo data",
 *  "An example business." — as `measure/prose.ts` drops them from the facts.
 *  Not a sentence that merely opens with the word. */
const DEMO_RE =
  /^(?:this is )?(?:an? )?(?:example|demo|sample)(?: \p{L}+){0,2}[.:]?$|\b(?:example|demo|sample) (?:business|company|data|dashboard|account|report|site|store)\b/iu;
const DEMO_CAPTION_MAX_CHARS = 60;
/** A byline or a date line in the body. The page prints its own, from what
 *  setup recorded and what publishing did. */
const BYLINE_RES: readonly RegExp[] = [
  // A name and little else: "By Friday the team had moved" is a sentence.
  /^(?:[Bb]y|[Ww]ritten by|[Aa]uthor:?)\s+\p{Lu}[^\s]*(?:\s+[^\s]+){0,6}$/u,
  /^(?:last updated|updated on|published on|posted on|first published)\b/i,
];
const ACTUALLY_OPENS_RE = /(^|[.!?]\s+)actually,?\s+(\p{L})/giu;
const ACTUALLY_RE = /\s+actually\b,?/gi;
const LABELS_RE = new RegExp(FACT_LABEL_RE.source, "g");
const LABEL_LINK_RE = new RegExp(`${FACT_LABEL_RE.source}\\(([^)\\s]+)\\)`, "g");
const MARKER_RE = /^[ \t]*(?:>[ \t]?|#{1,6}[ \t]+|(?:[-*+]|\d+[.)])[ \t]+)/;

function hostOf(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return href;
  }
}

/** One string a reader meets, without the labels and without "actually". */
export function tidyText(text: string): string {
  return text
    // "Link text is the source's name": a label used as a link's text
    // becomes the host of the page it links.
    .replace(LABEL_LINK_RE, (_match, href: string) => `[${hostOf(href)}](${href})`)
    .replace(LABELS_RE, "")
    // A sentence that lost its opening word keeps its capital.
    .replace(ACTUALLY_OPENS_RE, (_match, lead: string, letter: string) => lead + letter.toUpperCase())
    .replace(ACTUALLY_RE, "")
    .replace(/[ \t]+([.,;!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ");
}

const QUOTE_MIN_CHARS = 20;

/** The 4-word runs of a promise: what makes a sentence a repeat of it. */
function runsOf(promise: string): string[] {
  const words = lower(promise).replace(/[^\p{L}\d\s]/gu, "").split(" ").filter(Boolean);
  if (words.length <= 4) return words.length >= 3 ? [words.join(" ")] : [];
  return words.slice(0, words.length - 3).map((_, i) => words.slice(i, i + 4).join(" "));
}

/**
 * The body without what a page never says. Sentence by sentence, in the
 * rules' own notion of a block and a sentence, so a later check reads the
 * same text this left.
 */
export function tidy(markdown: string, a: TidyInputs): string {
  // A passage short enough to be a name is not a quotation's source.
  const facts = a.facts.map(lower).filter((fact) => fact.length >= QUOTE_MIN_CHARS);
  const legalIsSubject = a.queries.some((query) => LEGAL_RE.test(query));
  const promises = a.promises.map(runsOf).filter((runs) => runs.length > 0);
  const said = promises.map(() => 0);

  const edits: { from: number; to: number; text: string }[] = [];
  for (const block of sourceBlocksOf(markdown)) {
    // A heading and a table row are structure: their words are tidied, and
    // they are never dropped a sentence at a time.
    if (/^[ \t]*#{1,6}[ \t]+/.test(block.raw) || block.raw.trimStart().startsWith("|")) {
      const cleaned = tidyText(block.raw);
      if (cleaned !== block.raw) edits.push({ from: block.from, to: block.to, text: cleaned });
      continue;
    }
    // A pull-quote stands only where it is a handed passage, word for word.
    if (block.quoted) {
      const words = lower(renderOf(block.raw)).replace(/^["“]|["”]$/g, "");
      if (!facts.some((fact) => fact.includes(words) || words.includes(fact))) {
        edits.push({ from: block.from, to: block.to, text: "" });
      } else if (!/\]\(/.test(block.raw)) {
        // The passage's own page, where the quote came back without it; a
        // quote of a passage with no page to name is dropped.
        const source = a.sources?.find((held) => lower(held.passage).includes(words) || words.includes(lower(held.passage)));
        edits.push({
          from: block.from,
          to: block.to,
          text: source === undefined ? "" : `${block.raw.trimEnd()} ([${hostOf(source.url)}](${source.url}))`,
        });
      }
      continue;
    }
    const marker = MARKER_RE.exec(block.raw)?.[0] ?? "";
    const kept: string[] = [];
    for (const piece of block.raw.slice(marker.length).split(SENTENCE_END_RE)) {
      const words = collapse(renderOf(piece));
      if (BYLINE_RES.some((pattern) => pattern.test(words))) continue;
      if (DEMO_RE.test(words) && words.length <= DEMO_CAPTION_MAX_CHARS) continue;
      if (!legalIsSubject && LEGAL_RE.test(words)) continue;
      const repeats = promises.flatMap((runs, index) =>
        runs.some((run) => lower(words).replace(/[^\p{L}\d\s]/gu, "").includes(run)) ? [index] : []
      );
      if (repeats.some((index) => said[index]! >= PAGE_BLOCKS.taglineRepeats)) continue;
      for (const index of repeats) said[index]!++;
      kept.push(piece);
    }
    const text = kept.length === 0 ? "" : tidyText(marker + kept.join(" "));
    if (text !== block.raw) edits.push({ from: block.from, to: block.to, text });
  }

  let out = markdown;
  for (const edit of edits.sort((x, y) => y.from - x.from)) {
    out = out.slice(0, edit.from) + edit.text + out.slice(edit.to);
  }
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

// ── The page, laid out ──────────────────────────────────────────────────

/** One line: no block marker, no fence, no line break. */
function oneLine(text: string): string {
  return collapse(text.replace(/^[ \t]*:::.*$/gm, "").replace(/^[ \t]*(?:#{1,6}|[-*+]|>)[ \t]+/gm, ""));
}

const cellsOf = (row: string): number => row.trim().replace(/^\||\|$/g, "").split("|").length;
const DELIMITER_RE = /^[ \t]*\|?[ \t]*:?-{3,}:?[ \t]*(?:\|[ \t]*:?-{3,}:?[ \t]*)*\|?[ \t]*$/;

/** A table whose delimiter row has fewer cells than its header is no table
 *  to a parser: the row is rewritten with one `---` for every column. */
function mendTables(lines: readonly string[]): string[] {
  return lines.map((line, index) => {
    const header = lines[index - 1];
    if (header === undefined || !header.trim().startsWith("|") || !DELIMITER_RE.test(line)) return line;
    const columns = cellsOf(header);
    return cellsOf(line) === columns ? line : `|${" --- |".repeat(columns)}`;
  });
}

/** A section's body under an H2: its own heading is the outline's, so a
 *  repeat of it is cut, and any heading inside is an H3. */
function sectionBody(body: string, heading: string): string {
  const key = lower(heading).replace(/[?!.:]+$/, "");
  return mendTables(body.replace(/\r\n?/g, "\n").split("\n"))
    .filter((line) => !/^[ \t]*:::/.test(line))
    .flatMap((line) => {
      const found = /^[ \t]*#{1,6}[ \t]+(.*)$/.exec(line);
      if (found === null) return [line];
      return lower(found[1]!).replace(/[?!.:]+$/, "") === key ? [] : [`### ${found[1]!.trim()}`];
    })
    .join("\n")
    .trim();
}

/** The buyer questions as they are stored: whole pairs, tidied, the first
 *  six. Fewer than three is the structure rule's to refuse. */
export function faqOf(entries: readonly FaqEntry[]): FaqEntry[] {
  return entries
    .map((entry) => ({ question: tidyText(collapse(entry.question)), answer: tidyText(collapse(entry.answer)) }))
    .filter((entry) => entry.question !== "" && entry.answer !== "")
    .slice(0, PAGE_BLOCKS.faq.max);
}

const wordsIn = (text: string): number => (text.match(/\S+/g) ?? []).length;

/**
 * The short answer held to its words (SPEC §7, 2026-09-29: 40–60). One that
 * runs over is cut after the last sentence that still fits, where what is
 * left is itself an answer of 40 words or more — nothing is written, a
 * sentence is dropped. One that cannot be cut to fit stands as written, and
 * `first_block_answers` stops it.
 */
export function fitAnswer(answer: string): string {
  const { min, max } = PAGE_BLOCKS.answerWords;
  if (wordsIn(answer) <= max) return answer;
  const sentences = answer.split(SENTENCE_END_RE);
  for (let keep = sentences.length - 1; keep >= 1; keep--) {
    const cut = sentences.slice(0, keep).join(" ");
    const count = wordsIn(cut);
    if (count <= max) return count >= min ? cut : answer;
  }
  return answer;
}

/** The short-answer box as Markdown. */
export function answerBox(answer: string): string {
  return `:::answer\n${fitAnswer(tidyText(oneLine(answer)))}\n:::`;
}

/**
 * The body with its closing line under it. The line points at one action,
 * which is a link: one that carries none is itself made the link to
 * `action` — no word is added.
 */
export function withClosing(bodyMarkdown: string, closing: string, action: string): string {
  const line = closing === "" || /\]\(/.test(closing) ? closing : `[${closing.replace(/[[\]]/g, "")}](${action})`;
  return [bodyMarkdown.trimEnd(), line].filter(Boolean).join("\n\n");
}

/** What a section's heading reads as on the page: tidied, in sentence case,
 *  and a question — a heading shaped as one gets its mark. */
function headingOf(text: string, proper: ReadonlySet<string>, cased: ReadonlyMap<string, string>): string {
  const heading = recased(sentenceCase(tidyText(collapse(text.replace(/^[#\s]+/, ""))), proper), cased);
  return heading.endsWith("?") || !isQuestionShaped(heading) ? heading : `${heading.replace(/[.:!]+$/, "")}?`;
}

/** The words that own a capital somewhere in `texts` — "ChatGPT", "AI",
 *  "WordPress" — by their lowercase form. */
function ownCapitals(texts: readonly string[]): Map<string, string> {
  const out = new Map<string, string>([["i", "I"]]);
  for (const text of texts) {
    for (const token of renderOf(text).split(/\s+/)) {
      const bare = token.replace(/^[^\p{L}\d]+|[^\p{L}\d]+$/gu, "").replace(/[’']s$/, "");
      if (bare.length > 1 && ownsItsCapital(bare) && !out.has(bare.toLowerCase())) out.set(bare.toLowerCase(), bare);
    }
  }
  return out;
}

/** A title or heading with those words given their capitals back: a search
 *  typed in lowercase ("why does chatgpt…") is not how the page spells it. */
function recased(text: string, cased: ReadonlyMap<string, string>): string {
  return text.replace(/[\p{L}\d]+/gu, (word) => (word === word.toLowerCase() ? (cased.get(word) ?? word) : word));
}

/** The first paragraph of a section's body, as plain words. */
function openingOf(body: string): string {
  return collapse(renderOf(body.split(/\n{2,}/).find((block) => block.trim() !== "") ?? ""));
}

/** The template slot a returned section fills: a writer numbering a repeated
 *  section ("question_2", "option-3") still names its slot. */
function slotKey(key: string): string {
  return key.trim().toLowerCase().replace(/[\s_-]*\d+$/, "");
}

/** A meta description over its most keeps the whole sentences that fit,
 *  where that leaves it long enough (D51). Nothing is cut mid-sentence: a
 *  description still outside its range is the `title` check's to stop. */
function fitDescription(text: string): string {
  const { min, max } = TITLE.description;
  if ([...text].length <= max) return text;
  const sentences = text.split(SENTENCE_END_RE);
  let kept = "";
  for (const sentence of sentences) {
    const next = kept === "" ? sentence : `${kept} ${sentence}`;
    if ([...next].length > max) break;
    kept = next;
  }
  return [...kept].length >= min ? kept : text;
}

/** An update's title (D51): the live page's own, its year moved to this one
 *  only where a section no longer reads as the live page has it. */
function liveTitle(live: NonNullable<TidyInputs["live"]>, bodies: readonly string[]): string {
  // The words a reader meets, so a link or a line break is not a change.
  const stands = lower(renderOf(live.markdown));
  const changed = bodies.some((body) => !stands.includes(lower(renderOf(body))));
  return changed ? live.title.replace(/\b20\d\d\b/g, String(live.year)) : live.title;
}

/** One section as the page carries it, recorded with the row
 *  (`drafts.meta.sections`) so the blocks check knows which heading is which
 *  of the template's sections. */
export interface LaidSection {
  key: string;
  heading: string;
  /** How many numbered items it lists, where it lists two or more: a count
   *  the page's title may state (issue 1389, "in 5 steps"). */
  items?: number;
}

export interface LaidPage {
  body: DraftBody;
  /** The closing line, apart: it is laid out after the body's links. */
  closing: string;
  faq: FaqEntry[];
  sections: LaidSection[];
  /** An update's note of what changed; empty otherwise. */
  updated: string;
}

/**
 * The page, laid out from the writer's parts in the template's order (SPEC
 * §7, D42: "one fixed template each"): the short-answer box, the takeaways,
 * then each section under its heading — the template's sections in turn, a
 * repeated one as often as the writer returned it up to its most, and a
 * section whose key the template does not have left out. An update keeps
 * the order the writer returned, which is the live page's.
 *
 * `closing` is returned apart from the body because the page's links are
 * settled over the body first (`../links/apply.ts` may append the chosen
 * pages the text did not reach), and the closing line is the page's last
 * word after that.
 */
export function layoutPage(parts: PageParts, template: Template, a: TidyInputs): LaidPage {
  const proper = properNouns([...parts.sections.map((section) => section.body), ...a.facts], a.names);
  const cased = ownCapitals([...parts.sections.map((section) => section.body), parts.answer, ...a.facts]);
  const written = parts.sections.filter((section) => section.body.trim() !== "" && section.heading.trim() !== "");
  const ordered = template.sections.flatMap((slot) =>
    written.filter((section) => slotKey(section.key) === slot.key).slice(0, slot.repeat?.max ?? 1)
  );
  const seen = new Set<string>();
  const sections = ordered.flatMap((section) => {
    const heading = headingOf(section.heading, proper, cased);
    const key = lower(heading);
    if (heading === "" || seen.has(key)) return [];
    seen.add(key);
    return [{ key: slotKey(section.key), heading, body: sectionBody(section.body, heading) }];
  });
  const takeaways = parts.takeaways
    .map((item) => tidyText(oneLine(item)))
    .filter((item) => item !== "")
    .slice(0, PAGE_BLOCKS.takeaways.max);
  const lead = [answerBox(parts.answer), `:::takeaways\n${takeaways.map((item) => `- ${item}`).join("\n")}\n:::`];
  const text = sections.map((section) => `## ${section.heading}${section.body === "" ? "" : `\n\n${section.body}`}`);
  const cleaned = (text: string): string => recased(sentenceCase(tidyText(collapse(text)), proper), cased);
  const description = fitDescription(tidyText(collapse(parts.description)));
  const laid = sections.map(({ key, heading, body }) => {
    const items = body.split("\n").filter((line) => /^\d+[.)]\s/.test(line)).length;
    return { key, heading, ...(items > 1 ? { items } : {}) };
  });
  const proposed = parts.titles.map(cleaned).filter((each) => each !== "");
  const title =
    a.live === undefined
      ? (a.pickTitle?.(proposed, { description, sections: laid }) ?? proposed[0] ?? "")
      : liveTitle(a.live, sections.map((section) => tidy(section.body, a)));
  return {
    body: {
      title,
      // The H1 is the title (issue 1389): a page says one thing to a searcher
      // and to a reader.
      heading: title,
      slug: parts.slug,
      description,
      bodyMarkdown: `${lead.join("\n\n")}\n\n${tidy(text.join("\n\n"), a)}`,
    },
    closing: tidyText(oneLine(parts.closing)),
    // D42, Q&A: the page's own questions are its FAQ data, and it stores no
    // others — each question with the paragraph that answers it.
    faq:
      template.blocks.faq === null
        ? sections
            .filter((section) => section.key === "question")
            .map((section) => ({ question: section.heading, answer: openingOf(section.body) }))
            .filter((entry) => entry.answer !== "")
        : faqOf(parts.faq),
    sections: laid,
    updated: tidyText(oneLine(parts.updated)),
  };
}
