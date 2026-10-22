// The legal document, cut into sections at its own headings.
// src/app/(public)/_legal/sections.ts — issue #936
//
// The 2026-09-20 `R6-7` board puts an *On this page* list beside the legal
// text. A list of what? Not a list this file writes — the owner's legal
// bodies are the documents, and a contents list that named sections the
// body does not have would be the product inventing legal structure. So
// the list is **built from the document's own headings**, and if a body
// has none (which is every one of them today, while they hold the
// `TODO(copy)` marker) there is no list and no room kept for one.
//
// The body still goes through the product's one Markdown renderer. What
// this adds is the cut: the parsed blocks are split into runs at each
// top-level heading, so the page can give each heading an `id` to anchor
// to and render the run beneath it.
import { toHtml, type Block, type HtmlClasses } from "@/lib/publish/render/markdown";

/** One heading in the document, as the contents list needs it. */
export interface LegalHeading {
  readonly id: string;
  readonly text: string;
  readonly level: number;
  /** The section's own number as the document writes it ("1", "4a"), or null. */
  readonly number: string | null;
  /** The heading's words without that number. */
  readonly title: string;
}

/** One section: its anchored heading as HTML and the blocks beneath it. */
export interface LegalSection {
  readonly heading: LegalHeading | null;
  readonly headingHtml: string;
  readonly blocks: readonly Block[];
}

const NUMBERED = /^(\d+[a-z]?)\.\s+(.+)$/;

/** The plain text of a heading's inline children, for the list's own link
 *  text and for the slug. Structure inside a section title — a `code`
 *  span, a bolded word — is text in a contents list. */
function textOf(children: readonly { text?: string; children?: readonly unknown[] }[]): string {
  let out = "";
  for (const child of children) {
    if (typeof child.text === "string") out += child.text;
    else if (Array.isArray(child.children))
      out += textOf(child.children as Parameters<typeof textOf>[0]);
  }
  return out;
}

/** A heading's anchor. Derived from its own words, so a link that has been
 *  shared keeps working while the heading does; `-2`, `-3` … where a
 *  document repeats a title, because an `id` has to be unique and the
 *  second "Your rights" is not the first one. */
function slugOf(text: string, taken: Set<string>): string {
  const base =
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "section";
  let id = base;
  for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`;
  taken.add(id);
  return id;
}

/**
 * Every heading the document declares, in order, each with the anchor it
 * will carry.
 *
 * Only the **shallowest** level, which is what a contents list is: after
 * `demoteHeadings` a body's `##` is an `<h3>`, and a document that starts
 * at `###` is still a document whose sections are its `###`s. A deeper
 * heading is a subsection and belongs under its section, not beside it.
 */
export function legalHeadings(blocks: readonly Block[]): LegalHeading[] {
  const levels = blocks.filter((b) => b.kind === "heading").map((b) => b.level);
  if (levels.length === 0) return [];
  const top = Math.min(...levels);
  const taken = new Set<string>();
  const out: LegalHeading[] = [];
  for (const block of blocks) {
    if (block.kind !== "heading" || block.level !== top) continue;
    const text = textOf(block.children as Parameters<typeof textOf>[0]);
    const numbered = NUMBERED.exec(text);
    const title = numbered?.[2] ?? text;
    // The anchor is the title's alone, so renumbering a document keeps every shared link.
    out.push({ id: slugOf(title, taken), text, level: block.level, number: numbered?.[1] ?? null, title });
  }
  return out;
}

/** The document cut at its section headings; blocks before the first one form a section with no heading. */
export function legalSections(blocks: readonly Block[], classes: HtmlClasses): LegalSection[] {
  const headings = legalHeadings(blocks);
  const top = headings[0]?.level;
  const out: { heading: LegalHeading | null; headingHtml: string; blocks: Block[] }[] = [];
  let next = 0;
  for (const block of blocks) {
    if (block.kind === "heading" && block.level === top) {
      const heading = headings[next++]!;
      const headingHtml = toHtml([block], classes).replace(/^<h(\d)/, `<h$1 id="${heading.id}"`);
      out.push({ heading, headingHtml, blocks: [] });
      continue;
    }
    if (out.length === 0) out.push({ heading: null, headingHtml: "", blocks: [] });
    out[out.length - 1]!.blocks.push(block);
  }
  return out;
}

/**
 * The body as HTML, through the one renderer, with an `id` on each of the
 * headings `legalHeadings` listed: the sections joined the way `toHtml` joins.
 */
export function legalBodyWithIds(blocks: readonly Block[], classes: HtmlClasses): string {
  return legalSections(blocks, classes)
    .flatMap((s) => [s.headingHtml, ...s.blocks.map((b) => toHtml([b], classes))])
    .filter((html) => html !== "")
    .join("\n");
}
