// scripts/eval-content/grade.ts — the code half of the grader (#1132, #1158).
//
// Everything on a page that can be counted is counted here, in code, over
// the product's own Markdown model (`parseMarkdown`, the one serialiser the
// screen, the hosted page and WordPress share): the required blocks, the
// answer box's words, the length against the one target the writer reads,
// leaked fact labels, repeated sentences, empty table cells, the site's own
// navigation and demo text, the sources list, and every number traced to
// where it came from.
//
// What cannot be counted is judged in pairs, blind (`./judge.ts`), and what
// a page adds is listed code first (`./adds.ts`). Round 1 (#1153) had one
// small-tier call score a page 0–3 from the topic and the top results'
// titles; it gave a stopped 417-word draft the same 3/3 as the reference
// page, and that call is gone (#1158).
//
// The rubric reads SPEC §7's 2026-09-29 lines (*What every page carries*,
// *Length and the writer*). Byline and dates are the hosted page's chrome
// (#1140), not the draft's, so they are not checked here.
import { PAGE_BLOCKS } from "@/lib/config/constants";
import { bodyWords, lengthTargetFor } from "@/lib/generate/length";
import { FACT_LABEL_RE } from "@/lib/generate/rules/blocks";
import { sentencesOf } from "@/lib/generate/rules/text";
import type { OpportunityType } from "@/lib/opportunities/types";
import { headingsUnderTitle, parseMarkdown, type Block, type Inline } from "@/lib/publish/render/markdown";

function inlineText(nodes: readonly Inline[]): string {
  return nodes.map((node) => ("text" in node ? node.text : inlineText(node.children))).join("");
}

export function blockText(block: Block): string {
  switch (block.kind) {
    case "heading":
    case "paragraph":
    case "quote":
      return inlineText(block.children);
    case "list":
      return block.items.map(inlineText).join(" ");
    case "code":
      return block.text;
    case "table":
      return [block.head, ...block.rows].map((row) => row.map(inlineText).join(" ")).join(" ");
    case "answer":
    case "takeaways":
      return block.children.map(blockText).join(" ");
    case "guides":
      return block.items.map((item) => item.label).join(" ");
    case "rule":
      return "";
  }
}

function links(nodes: readonly Inline[]): string[] {
  return nodes.flatMap((node) =>
    node.kind === "link" ? [node.href, ...links(node.children)] : "children" in node ? links(node.children) : []
  );
}

export function blockLinks(block: Block): string[] {
  switch (block.kind) {
    case "heading":
    case "paragraph":
    case "quote":
      return links(block.children);
    case "list":
      return block.items.flatMap(links);
    case "table":
      return [block.head, ...block.rows].flatMap((row) => row.flatMap(links));
    case "answer":
    case "takeaways":
      return block.children.flatMap(blockLinks);
    default:
      return [];
  }
}

const words = (text: string): number => (text.match(/\S+/g) ?? []).length;

function hostOf(href: string): string | null {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** The length a page is held to: the product's own target (issue 1138), so
 *  the grader and the writer cannot hold different ones. */
export function targetOf(type: OpportunityType, query: string): { floor: number; ceiling: number; kind: string } | null {
  return lengthTargetFor({ type, targetQuery: query });
}

export interface Checklist {
  words: number;
  target: { floor: number; ceiling: number; kind: string } | null;
  /** Each required block, and whether the draft carries it. `null` where the
   *  block is not required of this page. */
  blocks: Record<string, boolean | null>;
  businessFacts: number;
  /** Distinct public pages the body links to, off the business's own domain. */
  marketFacts: number;
  /** Passages the draft stood on that appear on three or more of the site's
   *  pages — navigation, by SPEC §5's drafted rule of 2026-09-29. */
  navigationFacts: number;
  /** Words inside the short-answer box; 0 where the page has none. */
  answerWords: number;
  /** A prompt's fact labels printed on the page (`[F7]`, `[M39]`). */
  factLabels: number;
  /** Sentences the page says twice. */
  duplicateSentences: string[];
  /** Table cells that hold nothing, or only a dash. */
  emptyCells: number;
  /** The site's own navigation and demo text, found on the page. */
  sitePhrases: string[];
  /** The Sources list: the pages it names off the business's own domain,
   *  how many answered when read, and how many are not one of the target's
   *  top results. `null` where nothing was read to say. */
  sources: { listed: number; resolved: number | null; beyondTop: number | null };
}

/** What was read off the network for a page: the target's top results, and
 *  whether each page it cites answered. */
export interface SourceEvidence {
  topResults: readonly string[];
  /** `null` for an address nobody tried. */
  resolves: (href: string) => boolean | null;
}

const fold = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

const tokens = (text: string): string[] => fold(text).replace(/[^\p{L}\p{N}€$%' ]+/gu, " ").split(" ").filter(Boolean);

/** Every run of `n` words in a text, folded. */
export function grams(text: string, n: number): Set<string> {
  const list = tokens(text);
  const out = new Set<string>();
  for (let i = 0; i + n <= list.length; i++) out.add(list.slice(i, i + n).join(" "));
  return out;
}

/** Whether two texts share a run of `n` words. */
export function sharesRun(text: string, against: ReadonlySet<string>, n: number): boolean {
  for (const gram of grams(text, n)) if (against.has(gram)) return true;
  return false;
}

const SITE_RUN = 5;
/** Demo widgets and form furniture: a bullet or an arrow between labels, the
 *  demo's placeholder domains, a countdown. */
const DEMO_RE = /[·▲→]|example\.(?:com|net|org)|\b\d+ h \d+ m\b/;

/**
 * The site's navigation and demo text: a sentence that stands on three or
 * more of its pages (header, menu, footer), and a sentence of a demo widget.
 * Returned as the runs of `SITE_RUN` words they are made of.
 */
export function sitePhraseGrams(pages: readonly { text: string }[]): Set<string> {
  const sentences = pages.map((page) => page.text.split(/(?<=[.!?])\s+/).map((each) => each.trim()).filter(Boolean));
  const out = new Set<string>();
  sentences.forEach((list) => {
    for (const sentence of list) {
      const everywhere = sentences.filter((other) => other.includes(sentence)).length >= 3;
      if (!everywhere && !DEMO_RE.test(sentence)) continue;
      for (const gram of grams(sentence, SITE_RUN)) out.add(gram);
    }
  });
  return out;
}

export function checklist(a: {
  bodyMarkdown: string;
  type: OpportunityType;
  query: string;
  domain: string;
  businessName: string;
  factsUsed: readonly { passage: string; url: string }[];
  faq: unknown;
  pages: readonly { text: string }[];
  evidence?: SourceEvidence;
}): Checklist {
  // Headings as the hosted page sets them: the shallowest becomes an H2.
  const blocks = headingsUnderTitle(parseMarkdown(a.bodyMarkdown));
  const own = a.domain.replace(/^www\./, "");
  const isOwn = (href: string) => {
    const host = hostOf(href);
    return host !== null && (host === own || host.endsWith(`.${own}`));
  };

  const headings = blocks.flatMap((block, index) => (block.kind === "heading" ? [{ block, index }] : []));
  const h2 = headings.filter(({ block }) => block.level === 2);
  const firstH2 = h2[0]?.index ?? blocks.length;
  const first = blocks[0];
  const answerWords = first?.kind === "answer" ? words(blockText(first)) : 0;
  const lead = blocks.slice(0, firstH2);
  // The `:::takeaways` box's list (issue 1137), or — on a page written
  // before it — the first list above the first section.
  const box = lead.find((block) => block.kind === "takeaways");
  const takeaways = (box?.kind === "takeaways" ? box.children : lead).find((block) => block.kind === "list");
  const takeawayCount = takeaways?.kind === "list" ? takeaways.items.length : 0;

  let levelsInOrder = headings.length > 0 && headings[0]!.block.level === 2;
  for (let i = 1; i < headings.length; i++) {
    if (headings[i]!.block.level > headings[i - 1]!.block.level + 1 || headings[i]!.block.level < 2) levelsInOrder = false;
  }
  // The Sources list is the one heading that is not a question and the one
  // section that opens with a list (#1153's finding): it is asked neither.
  const asked = h2.filter(({ block }) => !/^(sources|references)$/i.test(inlineText(block.children).trim()));
  const opensWithAnswer =
    asked.length > 0 && asked.every(({ index }) => blocks[index + 1]?.kind === "paragraph" || blocks[index + 1]?.kind === "answer");

  const name = a.businessName.toLowerCase();
  const businessSection = h2.some(({ block, index }) => {
    const end = h2.find((next) => next.index > index)?.index ?? blocks.length;
    const section = blocks.slice(index, end);
    const text = section.map(blockText).join(" ").toLowerCase();
    return (inlineText(block.children).toLowerCase().includes(name) || text.includes(name)) && section.flatMap(blockLinks).some(isOwn);
  });

  const sourcesAt = headings.find(({ block }) => /\b(sources|references)\b/i.test(inlineText(block.children)));
  const listed = [
    ...new Set(sourcesAt === undefined ? [] : blocks.slice(sourcesAt.index + 1).flatMap(blockLinks).filter((href) => !isOwn(href))),
  ];
  const sources = listed.length > 0;
  const top = new Set((a.evidence?.topResults ?? []).map(hostOf));

  const last = [...blocks].reverse().find((block) => block.kind === "paragraph");
  const faq = Array.isArray(a.faq) ? a.faq.length : 0;
  const text = blocks.filter((block) => block.kind !== "guides").map(blockText).join(" ");

  const counts = new Map<string, number>();
  const labels = new RegExp(FACT_LABEL_RE.source, "g");
  // A label is the writer's bookkeeping, not part of what a sentence says.
  for (const sentence of sentencesOf(a.bodyMarkdown.replace(labels, ""))) {
    if (words(sentence.text) < 8) continue;
    counts.set(fold(sentence.text), (counts.get(fold(sentence.text)) ?? 0) + 1);
  }
  const emptyCells = blocks.flatMap((block) =>
    block.kind === "table" ? block.rows.flatMap((row) => row.filter((cell) => /^[\s—–-]*$/.test(inlineText(cell)))) : []
  ).length;
  const ofSite = sitePhraseGrams(a.pages);
  const sitePhrases = [...grams(text, SITE_RUN)].filter((gram) => ofSite.has(gram));
  const target = targetOf(a.type, a.query);

  const external = new Set(blocks.flatMap(blockLinks).filter((href) => hostOf(href) !== null && !isOwn(href)));
  const navigationFacts = a.factsUsed.filter(
    (fact) => a.pages.filter((page) => page.text.includes(fact.passage)).length >= 3
  ).length;

  return {
    words: bodyWords(a.bodyMarkdown),
    target,
    blocks: {
      "short answer (40–60 words)": answerWords >= PAGE_BLOCKS.answerWords.min && answerWords <= PAGE_BLOCKS.answerWords.max,
      "3–5 takeaways": takeawayCount >= PAGE_BLOCKS.takeaways.min && takeawayCount <= PAGE_BLOCKS.takeaways.max,
      "question headings": asked.length > 0 && asked.every(({ block }) => inlineText(block.children).trim().endsWith("?")),
      "H2 then H3, in order": levelsInOrder,
      "sections open with an answer": opensWithAnswer,
      "6–10 sections": asked.length >= 6 && asked.length <= 10,
      "a table": target?.kind === "comparison" ? blocks.some((block) => block.kind === "table") : null,
      "how the business handles it": businessSection,
      "3–6 buyer questions (meta.faq)": faq >= 3 && faq <= 6,
      "sources list": sources,
      "closing action": last !== undefined && links(last.kind === "paragraph" ? last.children : []).length > 0,
    },
    businessFacts: a.factsUsed.length,
    marketFacts: external.size,
    navigationFacts,
    answerWords,
    factLabels: (a.bodyMarkdown.match(labels) ?? []).length,
    duplicateSentences: [...counts].filter(([, n]) => n > 1).map(([sentence]) => sentence),
    emptyCells,
    sitePhrases,
    sources: {
      listed: listed.length,
      resolved: a.evidence === undefined ? null : listed.filter((href) => a.evidence!.resolves(href) === true).length,
      beyondTop: a.evidence === undefined ? null : listed.filter((href) => !top.has(hostOf(href))).length,
    },
  };
}

// ── Numbers ────────────────────────────────────────────────────────────

const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec";
const DATES = new RegExp(`\\b\\d{4}-\\d{2}-\\d{2}\\b|\\b\\d{1,2}(?:st|nd|rd|th)? (?:${MONTHS})\\b|\\b(?:${MONTHS}) \\d{1,2}(?:st|nd|rd|th)?\\b`, "g");

export interface Figure {
  n: string;
  /** The sign it carries: a percentage or a currency. */
  sign: "%" | "$" | "€" | "£" | null;
  /** The words beside it, which are what tell one small number from another. */
  prev: string;
  next: string;
}

const word = (text: string | undefined): string => (text ?? "").toLowerCase().replace(/[^\p{L}]/gu, "").slice(0, 4);

/** The figures a text states — not years, not the day of a date. */
export function figuresIn(text: string): Figure[] {
  const plain = text
    .replace(DATES, " ")
    // An abstract's TeX: `$40\%$` is 40%.
    .replace(/\$(\d[\d.,]*)\s?\\%\$/g, "$1%")
    .replace(/(\d)-(?=\p{L})/gu, "$1 ");
  return [...plain.matchAll(/(?<![A-Za-z\d.,])\d[\d,]*(?:\.\d+)?/g)].flatMap((m) => {
    const n = m[0].replace(/,+$/, "").replace(/,/g, "");
    if (n === "" || /^(19|20)\d{2}$/.test(n)) return [];
    const before = plain.slice(0, m.index);
    const after = plain.slice(m.index + m[0].length);
    const currency = /([$€£])\s?$/.exec(before)?.[1] as Figure["sign"] | undefined;
    const sign = currency ?? (/^\s?(?:(?:[–-]|to)\s?\d[\d.,]*\s?)?(?:%|percent\b)/.test(after) ? "%" : null);
    return [{ n, sign, prev: word(before.trim().split(/\s+/).pop()), next: word(after.trim().split(/\s+/)[0]) }];
  });
}

export const numbersIn = (text: string): string[] => figuresIn(text).map((figure) => figure.n);

/**
 * Whether a source states this figure. A number with a sign must carry the
 * same sign there, and a bare number under 100 must stand beside one of the
 * same words: "7 days" is not held by a page that says "7 tools".
 */
export function holds(source: string, figure: Figure): boolean {
  const small = figure.sign === null && /^\d{1,2}$/.test(figure.n);
  return figuresIn(source).some(
    (other) =>
      other.n === figure.n &&
      (figure.sign === null || other.sign === figure.sign) &&
      (!small || (figure.prev === "" && figure.next === "") || (figure.prev !== "" && other.prev === figure.prev) || (figure.next !== "" && other.next === figure.next))
  );
}

interface Unit {
  text: string;
  links: string[];
}

/** A paragraph, a list item, a table row: the span a figure and its source
 *  sit in together. */
export function units(blocks: readonly Block[]): Unit[] {
  return blocks.flatMap((block): Unit[] => {
    switch (block.kind) {
      case "list":
        return block.items.map((item) => ({ text: blockText({ kind: "paragraph", children: item }), links: blockLinks({ kind: "paragraph", children: item }) }));
      case "table":
        return block.rows.map((row) => {
          const asBlock = { kind: "paragraph" as const, children: row.flat() };
          return { text: blockText(asBlock), links: blockLinks(asBlock) };
        });
      case "answer":
      case "takeaways":
        return units(block.children);
      default:
        return [{ text: blockText(block), links: blockLinks(block) }];
    }
  });
}

export interface Trace {
  number: string;
  said: string;
  /** `traced`: a fact the page stood on holds it. `pool`: only the arm's
   *  wider pool holds it (the site's text, or facts it did not list).
   *  `unread`: its cited source could not be read. `invented`: nothing does. */
  verdict: "traced" | "pool" | "unread" | "invented";
  from: string;
}

/** Every figure on the page, and the fact that holds it. This is the whole
 *  of "invented figure": no model is asked (#1158). */
export function traceNumbers(a: {
  body: string;
  facts: readonly { text: string; source: string }[];
  pool: readonly { text: string; source: string }[];
  /** The pages the body links, as read: a figure beside a link is traced to
   *  that page. `null` is a page that did not answer. */
  linked?: ReadonlyMap<string, string | null>;
}): Trace[] {
  const out: Trace[] = [];
  // A cited page's title is not the page stating a number (issue 1135): the
  // list under the Sources heading is not read.
  let underSources = false;
  const read = headingsUnderTitle(parseMarkdown(a.body)).filter((block) => {
    if (block.kind === "heading") underSources = /^(sources|references)$/i.test(inlineText(block.children).trim());
    return !(underSources && block.kind === "list");
  });
  for (const unit of units(read)) {
    for (const figure of figuresIn(unit.text)) {
      const n = figure.n;
      const said = unit.text.length > 140 ? `${unit.text.slice(0, 137)}…` : unit.text;
      const beside = a.linked === undefined ? [] : unit.links.filter((href) => a.linked!.has(href)).map((href) => ({ href, text: a.linked!.get(href) ?? null }));
      const fromLink = beside.find((l) => l.text !== null && holds(l.text, figure));
      const fact = a.facts.find((f) => holds(f.text, figure));
      if (fromLink !== undefined) out.push({ number: n, said, verdict: "traced", from: fromLink.href });
      else if (fact !== undefined) out.push({ number: n, said, verdict: "traced", from: fact.source });
      else {
        const inPool = a.pool.find((f) => holds(f.text, figure));
        if (inPool !== undefined) out.push({ number: n, said, verdict: "pool", from: inPool.source });
        else if (beside.some((l) => l.text === null)) out.push({ number: n, said, verdict: "unread", from: beside.map((l) => l.href).join(" ") });
        else out.push({ number: n, said, verdict: "invented", from: "" });
      }
    }
  }
  return out;
}

