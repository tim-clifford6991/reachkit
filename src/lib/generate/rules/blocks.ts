// SPEC §7 (2026-09-29, *What every page carries*, issue 1137; D41 stage 4,
// *Blocks*; D42) — the one structure rule, `required_blocks`.
//
// The owner's ruling of 2026-10-02 (D27) says what the hard rules are for:
// "to guard the content for obvious violations, and sticking to a structure."
// This is the structure half, and since D42 the structure is the type's
// template: a generated page carries the short-answer box, three to five key
// takeaways, the template's sections in the template's order — each headed as
// the question a reader asks and opening with its own answer — the block the
// template requires (a table, numbered steps, a dated source on each change),
// a link to the business's own site, the buyer questions stored beside it, a
// closing line that points at one action, and a body inside the template's
// length. The round-1 review of 2026-10-02 adds one thing a page never
// carries: a prompt's own fact label.
//
// The page is laid out in code (`../pipeline/compose.ts`), so this rule is
// what holds where the writer returned something else. The 40–60 words of the
// answer box are `first_block_answers`'s.
//
// **It binds what ReachKit generates.** A caller that passes no `blocks` —
// the customer's own edit — is asked nothing here: a founder who rewrites
// their page into five sections has not broken a rule.
//
// Lexical and deterministic, like every rule beside it: it reads lines, not
// a tree, so the editor's bundle never has to carry a Markdown parser for it.
import { PAGE_BLOCKS } from "@/lib/config/constants";
import { bodyWords, sectionWords, type LengthRange } from "../length";
import type { Template } from "../templates";
import { hasLink, headingKey, sourceBlocksOf, type SourceBlock } from "./text";
import type { RuleFailure } from "./types";

/** The blocks a page can be stopped for, in the order they are checked. */
export type RequiredBlock =
  | "fact_label"
  | "answer_box"
  | "takeaways"
  | "sections"
  | "question_headings"
  | "section_opening"
  | "table"
  | "steps"
  /** Issue 1486: more of a how-to's steps are the business's own than its
   *  template allows. */
  | "own_steps"
  | "dated_sources"
  | "verdict"
  | "business_section"
  | "faq"
  | "closing"
  | "length";

export interface BlockRuleInputs {
  /** The type's template: the page's sections, blocks and length. */
  template: Template;
  /** The sections as the page was laid out, each with the template key it
   *  fills (`drafts.meta.sections`). */
  sections: readonly { key: string; heading: string }[];
  /** The words of body text the page is held to; `null` where it has no
   *  range — an update with no live page to measure against. */
  length: LengthRange | null;
  /** The buyer questions stored beside the page (`drafts.meta.faq`). */
  faq: readonly { question: string; answer: string }[];
  /** The business's own domain: what makes a link "to its product". */
  domain: string;
  /** A listicle's rivals, as its table names them (D52, issue 1267): the
   *  verdict names one. Absent, the verdict is not read. */
  rivals?: readonly string[];
  /** Issue 1508: the product a page of alternatives is about, where its
   *  table has its row. The page then carries its section once; never
   *  otherwise. It is not among `rivals`. */
  baseline?: string;
  /** The business's name: a step that names it, or links its own site, is
   *  the business's own (issue 1486). */
  businessName?: string | null;
}

/** A prompt's label for a fact — `[F7]`, `[M39]`, `[F7, F8]` — which is the
 *  writer's bookkeeping and never the reader's (round-1 review, 2026-10-02). */
export const FACT_LABEL_RE = /\[\s*[FM]\d+(?:\s*,\s*[FM]\d+)*\s*\]/;

const FENCE_RE = /^[ \t]*:::[ \t]*([\w-]*)[ \t]*$/;
const HEADING_RE = /^[ \t]*(#{1,6})[ \t]+(.*)$/;
const LIST_ITEM_RE = /^[ \t]*(?:[-*+]|\d+[.)])[ \t]+/;
const TABLE_DELIMITER_RE = /^[ \t]*\|?[ \t]*:?-{3,}:?[ \t]*(?:\|[ \t]*:?-{3,}:?[ \t]*)*\|?[ \t]*$/;
/** The one heading that is not a question: the list of market sources. */
const SOURCES_RE = /^(?:sources|references)$/i;

const NUMBERED_RE = /^[ \t]*\d+[.)][ \t]+/;
/** A date written out or in figures: "3 October 2026", "October 3, 2026",
 *  "2026-10-03", "October 2026". */
const DATE_RE =
  /\b(?:\d{4}-\d{2}-\d{2}|(?:\d{1,2}\s+)?(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+(?:\d{1,2},?\s+)?\d{4})\b/i;

/** The page's tables, each as its lines. */
function tablesOf(lines: readonly string[]): string[][] {
  const out: string[][] = [];
  for (let at = 1; at < lines.length; at++) {
    if (!TABLE_DELIMITER_RE.test(lines[at]!) || !lines[at]!.includes("|") || !lines[at - 1]!.trim().startsWith("|")) continue;
    let end = at + 1;
    while (end < lines.length && lines[end]!.trim().startsWith("|")) end++;
    out.push(lines.slice(at - 1, end));
    at = end;
  }
  return out;
}

const wordCount = (text: string): number => (text.match(/\S+/g) ?? []).length;

interface Container {
  name: string;
  lines: string[];
  /** The line the opening fence stands on. */
  at: number;
}

/** The page's containers, in order: `:::answer` … `:::`. */
function containersOf(lines: readonly string[]): Container[] {
  const out: Container[] = [];
  let open: Container | null = null;
  lines.forEach((line, index) => {
    const fence = FENCE_RE.exec(line);
    if (fence === null) {
      open?.lines.push(line);
      return;
    }
    if (open === null && fence[1] !== "") {
      open = { name: fence[1]!, lines: [], at: index };
      out.push(open);
    } else {
      open = null;
    }
  });
  return out;
}

/** The words inside the page's short-answer box, or `null` where the page
 *  does not open with one. `first_block_answers` counts these. */
export function answerBoxOf(markdown: string): string | null {
  const lines = markdown.split("\n");
  const first = lines.findIndex((line) => line.trim() !== "");
  if (first < 0 || FENCE_RE.exec(lines[first]!)?.[1] !== "answer") return null;
  const box = containersOf(lines)[0];
  return box === undefined ? null : box.lines.join(" ").replace(/\s+/g, " ").trim();
}

/** How many words the short-answer box holds; 0 where there is none. */
export function answerBoxWords(markdown: string): number {
  const box = answerBoxOf(markdown);
  return box === null ? 0 : wordCount(box);
}

interface Section {
  heading: string;
  blocks: SourceBlock[];
}

/** The page's H2 sections, each with the blocks under it. */
function sectionsOf(markdown: string): Section[] {
  const out: Section[] = [];
  for (const block of sourceBlocksOf(markdown)) {
    const heading = HEADING_RE.exec(block.raw);
    if (heading !== null && heading[1]!.length === 2) {
      out.push({ heading: heading[2]!.trim(), blocks: [] });
    } else {
      out[out.length - 1]?.blocks.push(block);
    }
  }
  return out;
}

function isParagraph(block: SourceBlock | undefined): boolean {
  if (block === undefined || block.quoted) return false;
  return !HEADING_RE.test(block.raw) && !LIST_ITEM_RE.test(block.raw) && !block.raw.trimStart().startsWith("|");
}

function linksOwnSite(raw: string, domain: string): boolean {
  const own = domain.replace(/^www\./, "").toLowerCase();
  return [...raw.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].some((match) => {
    try {
      const host = new URL(match[1]!).hostname.replace(/^www\./, "").toLowerCase();
      return host === own || host.endsWith(`.${own}`);
    } catch {
      return false;
    }
  });
}

/** A step is the business's own where it links the business's site or says
 *  its name, or its domain's own label ("acme" of acme.com), as a word. */
function namesBusiness(raw: string, blocks: BlockRuleInputs): boolean {
  if (linksOwnSite(raw, blocks.domain)) return true;
  const said = ` ${raw.toLowerCase().replace(/\]\([^)]*\)/g, "]").replace(/[^\p{L}\p{N}]+/gu, " ")} `;
  const label = blocks.domain.replace(/^www\./, "").split(".")[0]?.toLowerCase() ?? "";
  const name = (blocks.businessName ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  return [name, label].some((word) => word.length > 2 && said.includes(` ${word} `));
}

/** The first required block the page lacks, or `null` where it has all. */
export function missingBlock(a: { markdown: string; title: string; blocks: BlockRuleInputs }): RequiredBlock | null {
  const { markdown, blocks } = a;
  const faqText = blocks.faq.map((entry) => `${entry.question} ${entry.answer}`).join(" ");
  if (FACT_LABEL_RE.test(markdown) || FACT_LABEL_RE.test(a.title) || FACT_LABEL_RE.test(faqText)) return "fact_label";

  const lines = markdown.split("\n");
  const containers = containersOf(lines);
  if (answerBoxOf(markdown) === null) return "answer_box";

  const takeaways = containers.find((container) => container.name === "takeaways");
  const items = takeaways?.lines.filter((line) => LIST_ITEM_RE.test(line)).length ?? 0;
  if (items < PAGE_BLOCKS.takeaways.min || items > PAGE_BLOCKS.takeaways.max) return "takeaways";

  const levels = lines.flatMap((line) => {
    const heading = HEADING_RE.exec(line);
    return heading === null ? [] : [heading[1]!.length];
  });
  const { template } = blocks;
  const asked = sectionsOf(markdown).filter((section) => !SOURCES_RE.test(section.heading));
  // The page's sections are the ones it was laid out with, each filling a
  // slot of the template, in the template's order and inside its repeats.
  if (asked.length !== blocks.sections.length) return "sections";
  if (asked.some((section, index) => headingKey(section.heading) !== headingKey(blocks.sections[index]!.heading))) return "sections";
  let at = 0;
  for (const slot of template.sections) {
    let count = 0;
    while (blocks.sections[at]?.key === slot.key) {
      at++;
      count++;
    }
    // Issue 1508: the baseline's section is the page's where it has one.
    const range = slot.when === "alternatives" ? (blocks.baseline === undefined ? { min: 0, max: 0 } : { min: 1, max: 1 }) : slot.repeat;
    if (count < (range?.min ?? 1) || count > (range?.max ?? 1)) return "sections";
  }
  if (at !== blocks.sections.length) return "sections";
  // H2 then H3, in order: nothing above an H2, nothing below an H3.
  if (levels.some((level) => level < 2 || level > 3) || levels[0] !== 2) return "sections";
  // An update's headings are the live page's own.
  if (template.type !== "update" && asked.some((section) => !section.heading.endsWith("?"))) return "question_headings";
  if (asked.some((section) => !isParagraph(section.blocks[0]))) return "section_opening";

  const keyed = asked.map((section, index) => ({ ...section, key: blocks.sections[index]!.key }));
  if (template.blocks.table !== undefined) {
    // The customer and the template's rivals, down the side or across the
    // top: that many rows under the header, or that many columns beside the
    // first.
    const wanted = template.blocks.table.rivals + 1;
    const holds = tablesOf(lines).some(
      (table) => table.length - 2 >= wanted || table[0]!.trim().replace(/^\||\|$/g, "").split("|").length - 1 >= wanted
    );
    if (!holds) return "table";
  }
  if (template.blocks.steps !== undefined) {
    const steps = keyed
      .filter((section) => template.sections.find((slot) => slot.key === section.key)?.block === "steps")
      .flatMap((section) => section.blocks)
      .filter((block) => NUMBERED_RE.test(block.raw));
    if (steps.length < template.blocks.steps.min || steps.length > template.blocks.steps.max) return "steps";
    const own = template.blocks.steps.own;
    if (own !== undefined && steps.filter((step) => namesBusiness(step.raw, blocks)).length > own) return "own_steps";
  }
  if (template.blocks.datedSources === true) {
    const repeated = new Set(template.sections.filter((slot) => slot.repeat !== undefined).map((slot) => slot.key));
    const dated = (section: Section): boolean => {
      const raw = section.blocks.map((block) => block.raw).join("\n");
      return hasLink(raw) && DATE_RE.test(raw);
    };
    if (keyed.some((section) => repeated.has(section.key) && !dated(section))) return "dated_sources";
  }
  // D52: a self-promoting page's verdict names a rival — the case where it
  // is the better pick. That it says so is asked of the writer; a verdict
  // that names none cannot have.
  if (blocks.rivals !== undefined) {
    const verdict = keyed
      .filter((section) => section.key === "which_to_choose")
      .flatMap((section) => section.blocks.map((block) => block.raw))
      .join("\n")
      .toLowerCase();
    if (!blocks.rivals.some((rival) => rival.trim() !== "" && verdict.includes(rival.trim().toLowerCase()))) return "verdict";
  }
  if (!asked.some((section) => section.blocks.some((block) => linksOwnSite(block.raw, blocks.domain)))) {
    return "business_section";
  }

  if (template.blocks.faq !== null) {
    const faq = blocks.faq.length;
    if (faq < template.blocks.faq.min || faq > template.blocks.faq.max) return "faq";
  }

  const last = [...sourceBlocksOf(markdown)].reverse().find(isParagraph);
  if (last === undefined || !hasLink(last.raw)) return "closing";

  // The length, in words of body text, counted on the page as laid out.
  if (blocks.length !== null) {
    // An update is measured as its live page was: by the words under its
    // headings.
    const words = template.type === "update" ? sectionWords(markdown) : bodyWords(markdown);
    if (words < blocks.length.floor || words > blocks.length.ceiling) return "length";
  }
  return null;
}

export function checkRequiredBlocks(a: {
  markdown: string;
  title: string;
  /** `null` for text this product did not generate, which owes no block. */
  blocks: BlockRuleInputs | null;
}): RuleFailure | null {
  if (a.blocks === null) return null;
  const block = missingBlock({ markdown: a.markdown, title: a.title, blocks: a.blocks });
  return block === null ? null : { rule: "required_blocks", detail: { rule: "required_blocks", block } };
}
