// SPEC §7 (2026-09-29, *What every page carries*; issue 1137) — the one
// structure rule, `required_blocks`.
//
// The owner's ruling of 2026-10-02 (D27) says what the hard rules are for:
// "to guard the content for obvious violations, and sticking to a structure."
// This is the structure half. A generated page carries, in order: the
// short-answer box, three to five key takeaways, six to ten sections headed
// as the questions a reader asks — each opening with its own answer — a
// table where the page compares, a section on how the business itself
// handles the question, and a closing line that points at one action; and
// it stores three to six buyer questions beside it. The round-1 review of
// 2026-10-02 adds one thing a page never carries: a prompt's own fact label.
//
// The prompt asks for all of it and the pipeline composes most of it
// (`../pipeline/compose.ts`), so this rule is what holds where the model
// did something else — and what an edit by a later pass is checked against.
// The 40–60 words of the answer box are `first_block_answers`'s, which is
// the rule for "does not open with an answer".
//
// **It binds what ReachKit generates.** A caller that passes no `blocks` —
// the customer's own edit, the lead's free page — is asked nothing here: a
// founder who rewrites their page into five sections has not broken a rule.
//
// Lexical and deterministic, like every rule beside it: it reads lines, not
// a tree, so the editor's bundle never has to carry a Markdown parser for it.
import { PAGE_BLOCKS } from "@/lib/config/constants";
import { hasLink, sourceBlocksOf, type SourceBlock } from "./text";
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
  | "business_section"
  | "faq"
  | "closing";

export interface BlockRuleInputs {
  /** Whether the outline holds a comparison, so the page owes a table. */
  compares: boolean;
  /** The buyer questions stored beside the page (`drafts.meta.faq`). */
  faq: readonly { question: string; answer: string }[];
  /** The business's own domain: what makes a link "to its product". */
  domain: string;
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
  const sections = sectionsOf(markdown);
  const asked = sections.filter((section) => !SOURCES_RE.test(section.heading));
  if (asked.length < PAGE_BLOCKS.sections.min || asked.length > PAGE_BLOCKS.sections.max) return "sections";
  // H2 then H3, in order: nothing above an H2, nothing below an H3.
  if (levels.some((level) => level < 2 || level > 3) || levels[0] !== 2) return "sections";
  if (asked.some((section) => !section.heading.endsWith("?"))) return "question_headings";
  if (asked.some((section) => !isParagraph(section.blocks[0]))) return "section_opening";

  if (blocks.compares && !lines.some((line) => TABLE_DELIMITER_RE.test(line) && line.includes("|"))) return "table";
  if (!asked.some((section) => section.blocks.some((block) => linksOwnSite(block.raw, blocks.domain)))) {
    return "business_section";
  }

  const faq = blocks.faq.length;
  if (faq < PAGE_BLOCKS.faq.min || faq > PAGE_BLOCKS.faq.max) return "faq";

  const last = [...sourceBlocksOf(markdown)].reverse().find(isParagraph);
  if (last === undefined || !hasLink(last.raw)) return "closing";
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
