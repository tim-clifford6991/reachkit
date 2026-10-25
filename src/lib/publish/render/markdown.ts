// BUILD §9 · §4.6 · SPEC §7 — the one Markdown renderer, and the one place a delivered page's body becomes HTML.
// Here under `src/lib/publish/` because every reader can reach it: the draft preview and copy-as-HTML (§4.6), the
// hosted template and the WordPress adapter all go through `toHtml`, so the customer, the publisher of record, never
// gets three different HTMLs (BP-044 decision 3).
//
// The parse is `mdast-util-from-markdown` (micromark) with `docs/DESIGN.md`'s two extensions, GFM tables and
// directives; the serialiser is ours: a closed set of elements, every text node escaped, every `href` scheme-vetted,
// and no raw HTML ever passed through.
//
// The closed set holds both ways. A node with no element of ours (raw HTML, images, since SPEC §7 says "No images",
// footnotes, any future extension) renders as its own source text, sliced by position, so `<script>` in a body is
// escaped text. No allowlist and no blocklist: no input markup reaches the output as markup.
// The attributes are closed too, all written here: `href` (vetted against `MARKDOWN_LINK_SCHEMES`, the only value a
// body influences), `class` (the caller's table), `tabindex`, `role` and `aria-label` on the two scrolling boxes
// (constants, the name from the registry), `id` on a heading (from `withHeadingIds`, letters, digits and hyphens
// only), and `role="list"` on every list, since WebKit drops a styled list's semantics. A body has no syntax that
// reaches an attribute.
// A scrolling box is focusable, or its far columns need a mouse (axe's `scrollable-region-focusable`). `group`, not
// `region`: a landmark must be uniquely named, and two tables would share one constant name (`landmark-unique`).
// A soft line ending is a space, as CommonMark keeps the newline, so published bytes stay stable.
//
// `:::answer`, the short-answer box, is admitted from the body: it claims nothing a reader cannot check and emits no
// structured data (`FAQPage` is built from `drafts.meta.faq` by `./faq.ts`, never from the body).
// `:::guides` is not: related guides are "chosen in code, never by the model" (SPEC §7), so only `guidesBlock()`
// makes one and a written one renders as its own text.
import { fromMarkdown } from "mdast-util-from-markdown";
import { directive } from "micromark-extension-directive";
import { directiveFromMarkdown } from "mdast-util-directive";
import { gfmTable } from "micromark-extension-gfm-table";
import { gfmTableFromMarkdown } from "mdast-util-gfm-table";
import type { PhrasingContent, RootContent } from "mdast";

import { MARKDOWN_LINK_SCHEMES } from "@/lib/config/constants";
import { copy, type CopyKey } from "@/lib/presentation/copy";

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string }
  | { kind: "strong"; children: readonly Inline[] }
  | { kind: "em"; children: readonly Inline[] }
  | { kind: "link"; href: string; children: readonly Inline[] }
  /** REQ-045 criterion 2's mark. Produced only by `markPassage`, never by
   *  the parser: a body cannot mint its own highlight. */
  | { kind: "mark"; children: readonly Inline[] };

/** One cell of a table: its inline content. A table carries no block
 *  content — a cell is a phrase, which is what a GFM table can express. */
export type Cell = readonly Inline[];

/** How a column is set, as the table's own delimiter row declared it.
 *  `null` is "not declared", which is the default and is not `left`. */
export type Align = "left" | "right" | "center" | null;

export type Block =
  | {
      kind: "heading";
      level: 1 | 2 | 3 | 4 | 5 | 6;
      children: readonly Inline[];
      /** Minted by `withHeadingIds`, never by the parser. */
      id?: string;
    }
  | { kind: "paragraph"; children: readonly Inline[] }
  | { kind: "quote"; children: readonly Inline[] }
  | {
      kind: "list";
      ordered: boolean;
      items: ReadonlyArray<readonly Inline[]>;
      /** A top-level bulleted list right after a paragraph, its lead-in
       *  sentence: set by the parser on the whole body, so a slice keeps it. */
      leadIn?: true;
    }
  | { kind: "code"; text: string }
  | { kind: "rule" }
  /** SPEC §7: a header row and a body, each column's declared alignment, and the registry's name for its scrolling box. */
  | {
      kind: "table";
      label: string;
      head: readonly Cell[];
      rows: readonly (readonly Cell[])[];
      align: readonly Align[];
    }
  /** SPEC §7 — the short-answer box, holding ordinary blocks and never another container. */
  | { kind: "answer"; label: string; children: readonly Block[] }
  /** SPEC §7 (D4) — the key takeaways: the same box under its own label, holding three to five points. */
  | { kind: "takeaways"; label: string; children: readonly Block[] }
  /** SPEC §7 — related guides, minted by `guidesBlock`, never by the parser. */
  | { kind: "guides"; label: string; items: readonly GuideLink[] };

/** One related guide: a page the site already has. Both members are
 *  ReachKit's own — the address from what it published, the label from
 *  that page's title — and neither is read out of the body. */
export interface GuideLink {
  href: string;
  label: string;
}

// ── inline ──────────────────────────────────────────────────────────────

/** The four link schemes a draft may address — `MARKDOWN_LINK_SCHEMES`,
 *  pinned in `constants.ts` because it decides what publishes onto a
 *  customer's own domain. Anything else — `javascript:` above all — is not
 *  a link at all: the text renders and the address does not become
 *  clickable. A closed list, because the alternative is a blocklist and a
 *  blocklist is always one scheme behind. */
function isAddressable(href: string): boolean {
  return MARKDOWN_LINK_SCHEMES.some((scheme) => href.startsWith(scheme));
}

/** The source text a node was parsed from. The one place this module reads
 *  the input again, and what makes "a construct it does not know renders
 *  as its own text" true of every node micromark can produce rather than
 *  only of the ones a hand-written scanner thought of. */
function sourceOf(node: { position?: { start: { offset?: number }; end: { offset?: number } } }, src: string): string {
  const from = node.position?.start.offset;
  const to = node.position?.end.offset;
  return from === undefined || to === undefined ? "" : src.slice(from, to);
}

/** A soft line ending is a space — see the header. */
function unwrap(text: string): string {
  return text.replace(/\n/g, " ");
}

const WORD_START = /^[\p{L}\p{N}]/u;
const WORD_END = /[\p{L}\p{N}]$/u;

/** A link glued into a word ("B[2](u)B") is that word, not a link, so such a body renders whole. */
function unglued(inlines: readonly Inline[]): Inline[] {
  return inlines.flatMap((node, i) => {
    if (node.kind !== "link") return [node];
    const before = inlines[i - 1];
    const after = inlines[i + 1];
    const glued =
      (before?.kind === "text" && WORD_END.test(before.text)) || (after?.kind === "text" && WORD_START.test(after.text));
    return glued ? [...node.children] : [node];
  });
}

function inlinesOf(nodes: readonly PhrasingContent[], src: string): Inline[] {
  const out: Inline[] = [];
  for (const node of nodes) {
    switch (node.type) {
      case "text":
        out.push({ kind: "text", text: unwrap(node.value) });
        break;
      case "inlineCode":
        out.push({ kind: "code", text: node.value });
        break;
      case "strong":
        out.push({ kind: "strong", children: inlinesOf(node.children, src) });
        break;
      case "emphasis":
        out.push({ kind: "em", children: inlinesOf(node.children, src) });
        break;
      case "link":
        // An address this product will not put on a customer's domain
        // keeps its label and loses its link — the label's own emphasis
        // survives, the address does not become clickable, and no `href`
        // is emitted for it at all.
        if (isAddressable(node.url)) {
          out.push({ kind: "link", href: node.url, children: inlinesOf(node.children, src) });
        } else {
          out.push(...inlinesOf(node.children, src));
        }
        break;
      case "break":
        out.push({ kind: "text", text: " " });
        break;
      default:
        out.push({ kind: "text", text: unwrap(sourceOf(node, src)) });
    }
  }
  return unglued(out);
}

/** The inline grammar on its own, over a fragment. The same parse the
 *  blocks are built from — it reads the fragment as one paragraph and
 *  returns that paragraph's inlines — so there is no second grammar to
 *  drift. A fragment that is not a paragraph at all (a list item, say)
 *  yields its own text. */
export function parseInline(text: string): Inline[] {
  const root = parse(text);
  const first = root.children[0];
  if (first === undefined) return [];
  if (first.type === "paragraph" && root.children.length === 1) {
    return inlinesOf(first.children, text);
  }
  return [{ kind: "text", text: unwrap(text) }];
}

// ── blocks ──────────────────────────────────────────────────────────────

/** SPEC §7's short-answer box, as a body writes it. */
const SHORT_ANSWER = "answer";
/** SPEC §7's key takeaways (D4), as a body writes them. */
const TAKEAWAYS = "takeaways";

function parse(md: string): ReturnType<typeof fromMarkdown> {
  return fromMarkdown(md.replace(/\r\n?/g, "\n"), {
    extensions: [gfmTable(), directive()],
    mdastExtensions: [gfmTableFromMarkdown(), directiveFromMarkdown()],
  });
}

/** A container's block children, as one run of inlines — what a block
 *  quote and a list item hold in this model. Paragraphs join with a space,
 *  exactly as wrapped lines do; anything that is not a paragraph yields
 *  its own source text. */
function flatten(nodes: readonly RootContent[], src: string): Inline[] {
  const out: Inline[] = [];
  for (const node of nodes) {
    if (out.length > 0) out.push({ kind: "text", text: " " });
    if (node.type === "paragraph") out.push(...inlinesOf(node.children, src));
    else out.push({ kind: "text", text: unwrap(sourceOf(node, src)) });
  }
  return out;
}

/** A node this module has no element for, as the literal text it was
 *  written as. The safe direction, and the whole of the raw-HTML rule. */
function literal(node: RootContent, src: string): Block {
  return { kind: "paragraph", children: [{ kind: "text", text: unwrap(sourceOf(node, src)) }] };
}

function blocksOf(nodes: readonly RootContent[], src: string, insideAnswer: boolean): Block[] {
  const out: Block[] = [];
  for (const node of nodes) {
    switch (node.type) {
      case "heading":
        out.push({
          kind: "heading",
          level: node.depth as 1 | 2 | 3 | 4 | 5 | 6,
          children: inlinesOf(node.children, src),
        });
        break;
      case "paragraph":
        out.push({ kind: "paragraph", children: inlinesOf(node.children, src) });
        break;
      case "blockquote":
        out.push({ kind: "quote", children: flatten(node.children, src) });
        break;
      case "list": {
        const ordered = node.ordered === true;
        const leadIn = !ordered && !insideAnswer && out.at(-1)?.kind === "paragraph";
        out.push({
          kind: "list",
          ordered,
          items: node.children.map((item) => flatten(item.children, src)),
          ...(leadIn ? { leadIn: true as const } : {}),
        });
        break;
      }
      case "code":
        out.push({ kind: "code", text: node.value });
        break;
      case "thematicBreak":
        out.push({ kind: "rule" });
        break;
      case "table": {
        const [head, ...rest] = node.children;
        if (head === undefined) break;
        out.push({
          kind: "table",
          label: copy("body.table.label"),
          align: (node.align ?? []).map((a) => (a === undefined ? null : a)),
          head: head.children.map((cell) => inlinesOf(cell.children, src)),
          rows: rest.map((row) => row.children.map((cell) => inlinesOf(cell.children, src))),
        });
        break;
      }
      case "containerDirective":
        // The short-answer box, and only at the top level: a box inside a
        // box says nothing, so a nested one is its own text.
        if (node.name === SHORT_ANSWER && !insideAnswer) {
          out.push({
            kind: "answer",
            label: copy("body.answer.heading"),
            children: blocksOf(node.children, src, true),
          });
          break;
        }
        if (node.name === TAKEAWAYS && !insideAnswer) {
          out.push({
            kind: "takeaways",
            label: copy("body.takeaways.heading"),
            children: blocksOf(node.children, src, true),
          });
          break;
        }
        out.push(literal(node, src));
        break;
      default:
        out.push(literal(node, src));
    }
  }
  return out;
}

/** `copy()`, or `copy()` in a page's own language. This module is read by
 *  the browser too, so it holds no translation: the server hands one in. */
export type Say = (key: CopyKey, vars?: Record<string, string | number>) => string;

/** The blocks with the three labels this module mints said in the page's own language (SPEC §6, D66); the writer's
 *  words are untouched. */
export function labelledIn(blocks: readonly Block[], say: Say): Block[] {
  return blocks.map((block) => {
    if (block.kind === "table") return { ...block, label: say("body.table.label") };
    if (block.kind === "answer") return { ...block, label: say("body.answer.heading"), children: labelledIn(block.children, say) };
    if (block.kind === "takeaways") return { ...block, label: say("body.takeaways.heading"), children: labelledIn(block.children, say) };
    return block;
  });
}

/** Markdown in, blocks out. */
export function parseMarkdown(md: string): Block[] {
  const src = md.replace(/\r\n?/g, "\n");
  return blocksOf(parse(src).children, src, false);
}

/**
 * SPEC §7's related guides, built from what ReachKit already published.
 *
 * The **only** way a guides block is made: the parser will not produce one
 * (see the header), so every link in it came from code. Each address is
 * scheme-vetted here as a body's would be, and a guide whose address this
 * product would not put on a customer's domain is dropped rather than
 * rendered without its link — a related guide that does not go anywhere is
 * not a related guide.
 */
export function guidesBlock(a: {
  /** The customer, by name. These are **their** other guides on their own
   *  domain, and the label says so. */
  publisher: string;
  items: readonly GuideLink[];
  /** The page's own language (D66); absent is English. */
  say?: Say;
}): Block {
  return {
    kind: "guides",
    label: (a.say ?? copy)("body.guides.heading", { publisher: a.publisher }),
    items: a.items.filter((item) => isAddressable(item.href)),
  };
}

// ── heading ids ─────────────────────────────────────────────────────────

/** The words of a run of inlines, with no markup. */
export function inlineText(inlines: readonly Inline[]): string {
  return inlines
    .map((inline) => ("children" in inline ? inlineText(inline.children) : inline.text))
    .join("");
}

/** One entry of a table of contents: a heading, by the id it carries. */
export interface HeadingEntry {
  id: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
}

/** A heading's text as an id: its letters and digits, lower-cased, joined
 *  by hyphens. A heading with neither is a `section`. */
function headingId(text: string): string {
  const id = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return id === "" ? "section" : id;
}

/** SPEC §7 — every top-level heading given an id from its own text, and the list for a table of contents. Repeats get
 *  `-2`, `-3` in order; headings inside a box are left alone, as the box is one stop, not a section. */
export function withHeadingIds(blocks: readonly Block[]): { blocks: Block[]; headings: HeadingEntry[] } {
  const taken = new Set<string>();
  const headings: HeadingEntry[] = [];
  const out = blocks.map((block) => {
    if (block.kind !== "heading") return block;
    const text = inlineText(block.children).replace(/\s+/g, " ").trim();
    const base = headingId(text);
    let id = base;
    for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
    taken.add(id);
    headings.push({ id, level: block.level, text });
    return { ...block, id };
  });
  return { blocks: out, headings };
}

// ── the highlight ───────────────────────────────────────────────────────

function markInline(nodes: readonly Inline[], passage: string, done: { hit: boolean }): Inline[] {
  const out: Inline[] = [];
  for (const node of nodes) {
    if (done.hit) {
      out.push(node);
      continue;
    }
    if (node.kind === "text") {
      const at = node.text.indexOf(passage);
      if (at < 0) {
        out.push(node);
        continue;
      }
      done.hit = true;
      const before = node.text.slice(0, at);
      const after = node.text.slice(at + passage.length);
      if (before !== "") out.push({ kind: "text", text: before });
      out.push({ kind: "mark", children: [{ kind: "text", text: passage }] });
      if (after !== "") out.push({ kind: "text", text: after });
      continue;
    }
    if (node.kind === "strong" || node.kind === "em" || node.kind === "link") {
      out.push({ ...node, children: markInline(node.children, passage, done) });
      continue;
    }
    out.push(node);
  }
  return out;
}

/** One block, with the passage marked inside it if it is there and has not
 *  been found yet. Split out so the short-answer box can carry the mark
 *  too: a page grounded in its own opening answer is the ordinary case. */
function markBlock(block: Block, passage: string, done: { hit: boolean }): Block {
  switch (block.kind) {
    // Nothing of ours to mark: a fence is verbatim, a rule has no text,
    // and a guide's label is ReachKit's own rather than the page's prose.
    case "code":
    case "rule":
    case "guides":
      return block;
    case "list":
      return { ...block, items: block.items.map((item) => markInline(item, passage, done)) };
    case "table":
      return {
        ...block,
        head: block.head.map((cell) => markInline(cell, passage, done)),
        rows: block.rows.map((row) => row.map((cell) => markInline(cell, passage, done))),
      };
    case "answer":
    case "takeaways":
      return { ...block, children: block.children.map((child) => markBlock(child, passage, done)) };
    default:
      return { ...block, children: markInline(block.children, passage, done) };
  }
}

/**
 * REQ-045 criterion 2 — "the fact it is grounded in is marked within the
 * text". The passage is matched **verbatim**, at most once, inside one run
 * of body text; it is never reworded to fit and never matched loosely.
 *
 * Recorded limit, stated rather than hidden: a passage broken across two
 * blocks, or interrupted by emphasis, is not marked. `marked` says so, the
 * body still renders in full, and the source line still renders — a mark
 * placed at a guessed offset would claim a grounding the text does not
 * carry, which is the one thing this criterion exists to prevent.
 */
export function markPassage(
  blocks: readonly Block[],
  passage: string
): { blocks: Block[]; marked: boolean } {
  const needle = passage.trim();
  if (needle === "") return { blocks: [...blocks], marked: false };
  const done = { hit: false };
  const out = blocks.map((block) => markBlock(block, needle, done));
  return { blocks: out, marked: done.hit };
}

// ── links to a moved address ────────────────────────────────────────────

function redirectInline(nodes: readonly Inline[], finalOf: (href: string) => string | null): Inline[] {
  return nodes.map((node) => {
    if (node.kind === "link") return { ...node, href: finalOf(node.href) ?? node.href, children: redirectInline(node.children, finalOf) };
    if (node.kind === "strong" || node.kind === "em" || node.kind === "mark") return { ...node, children: redirectInline(node.children, finalOf) };
    return node;
  });
}

function redirectBlock(block: Block, finalOf: (href: string) => string | null): Block {
  switch (block.kind) {
    case "list":
      return { ...block, items: block.items.map((item) => redirectInline(item, finalOf)) };
    case "table":
      return {
        ...block,
        head: block.head.map((cell) => redirectInline(cell, finalOf)),
        rows: block.rows.map((row) => row.map((cell) => redirectInline(cell, finalOf))),
      };
    case "answer":
    case "takeaways":
      return { ...block, children: block.children.map((child) => redirectBlock(child, finalOf)) };
    case "code":
    case "rule":
    case "guides":
      return block;
    default:
      return { ...block, children: redirectInline(block.children, finalOf) };
  }
}

/** SPEC §7: a link to a moved address is drawn at where it answers now, by `finalOf` (`null` keeps it), at render, so
 *  the stored body is not edited (ADR-080) and the page's dates do not move. */
export function withLinksMoved(blocks: readonly Block[], finalOf: (href: string) => string | null): Block[] {
  return blocks.map((block) => redirectBlock(block, finalOf));
}

// ── links to a retired address ──────────────────────────────────────────

function unlinkInline(nodes: readonly Inline[], gone: (href: string) => boolean): Inline[] {
  return nodes.flatMap((node): Inline[] => {
    if (node.kind === "link") return gone(node.href) ? unlinkInline(node.children, gone) : [{ ...node, children: unlinkInline(node.children, gone) }];
    if (node.kind === "strong" || node.kind === "em" || node.kind === "mark") return [{ ...node, children: unlinkInline(node.children, gone) }];
    return [node];
  });
}

function unlinkBlock(block: Block, gone: (href: string) => boolean): Block {
  switch (block.kind) {
    case "code":
    case "rule":
    case "guides":
      return block;
    case "list":
      return { ...block, items: block.items.map((item) => unlinkInline(item, gone)) };
    case "table":
      return {
        ...block,
        head: block.head.map((cell) => unlinkInline(cell, gone)),
        rows: block.rows.map((row) => row.map((cell) => unlinkInline(cell, gone))),
      };
    case "answer":
    case "takeaways":
      return { ...block, children: block.children.map((child) => unlinkBlock(child, gone)) };
    default:
      return { ...block, children: unlinkInline(block.children, gone) };
  }
}

/** SPEC §7: a link to an address answering 410 is unwrapped at render, its words kept, as the link step does
 *  (`generate/links/apply.ts`). No live page's text is edited (ADR-080). */
export function withoutLinksTo(blocks: readonly Block[], gone: (href: string) => boolean): Block[] {
  return blocks.map((block) => unlinkBlock(block, gone));
}

// ── serialisation ───────────────────────────────────────────────────────

/** The five characters that can change the meaning of the markup this
 *  module emits. Every text node and every attribute value passes through
 *  here, which is what makes `toHtml`'s output safe to set as HTML. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** The one place the rendered and copied page may differ, and only by class attributes: §2.2 allows no custom CSS for a
 *  body, so the screen passes a class table of stock utilities and the copy-out and hosted template pass none. Same
 *  function, same parse, same structure, which a second renderer would break. `tableWrap`, `answer`, `takeaways`,
 *  `guides`, `answerLabel` and `guidesLabel` name containers and eyebrows, a `div` and a `p` whatever the map. */
export type HtmlClasses = Partial<
  Record<
    | "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
    | "p" | "ul" | "ol" | "li" | "blockquote" | "pre" | "code" | "hr"
    | "a" | "mark" | "strong" | "em"
    | "table" | "thead" | "tbody" | "tr" | "th" | "td"
    | "tableWrap" | "answer" | "answerLabel" | "takeaways" | "takeawaysLabel" | "guides" | "guidesLabel"
    | "checklist",
    string
  >
>;

/** An element, with the class its own key carries. `key` is the class
 *  table's name for it, which is the tag for every element but the three
 *  containers. */
function openAs(tag: string, key: keyof HtmlClasses, classes: HtmlClasses, extra = ""): string {
  const cls = classes[key];
  return `<${tag}${extra}${cls === undefined ? "" : ` class="${escapeHtml(cls)}"`}>`;
}

function open(tag: keyof HtmlClasses, classes: HtmlClasses, extra = ""): string {
  return openAs(tag, tag, classes, extra);
}

function inlineHtml(nodes: readonly Inline[], classes: HtmlClasses): string {
  return nodes
    .map((node) => {
      switch (node.kind) {
        case "text":
          return escapeHtml(node.text);
        case "code":
          return `${open("code", classes)}${escapeHtml(node.text)}</code>`;
        case "strong":
          return `${open("strong", classes)}${inlineHtml(node.children, classes)}</strong>`;
        case "em":
          return `${open("em", classes)}${inlineHtml(node.children, classes)}</em>`;
        case "mark":
          return `${open("mark", classes)}${inlineHtml(node.children, classes)}</mark>`;
        case "link":
          return `${open("a", classes, ` href="${escapeHtml(node.href)}"`)}${inlineHtml(node.children, classes)}</a>`;
      }
    })
    .join("");
}

/** One row of cells. A column's declared alignment travels as a class
 *  rather than as an attribute of its own, and it shares the one `class` the caller's own
 *  table may also have something to say in. */
function cellsHtml(tag: "th" | "td", cells: readonly Cell[], align: readonly Align[], classes: HtmlClasses): string {
  return cells
    .map((cell, i) => {
      const declared = align[i] ?? null;
      const cls = classes[tag];
      // One `class` attribute, whichever of the two has something to say.
      const both = [cls, declared === null ? undefined : `text-${declared}`]
        .filter((part): part is string => part !== undefined && part !== "")
        .join(" ");
      const attr = both === "" ? "" : ` class="${escapeHtml(both)}"`;
      return `<${tag}${attr}>${inlineHtml(cell, classes)}</${tag}>`;
    })
    .join("");
}

/** Blocks in, HTML out. The one serialiser: the read view's body, the
 *  preview pane, the hosted page, WordPress and the copy-as-HTML control
 *  all end here.
 *
 *  The closed set of elements it can emit, and nothing else:
 *  `h1`–`h6`, `p`, `blockquote`, `pre`, `code`, `hr`, `ul`, `ol`, `li`,
 *  `table`, `thead`, `tbody`, `tr`, `th`, `td`, `div`, `a`, `strong`,
 *  `em`, `mark`. Every one of them is written here; none comes from the
 *  input. */
export function toHtml(blocks: readonly Block[], classes: HtmlClasses = {}): string {
  return blocks
    .map((block) => {
      switch (block.kind) {
        case "heading": {
          const tag = `h${block.level}` as keyof HtmlClasses;
          const id = block.id === undefined ? "" : ` id="${escapeHtml(block.id)}"`;
          return `${open(tag, classes, id)}${inlineHtml(block.children, classes)}</h${block.level}>`;
        }
        case "paragraph":
          return `${open("p", classes)}${inlineHtml(block.children, classes)}</p>`;
        case "quote":
          return `${open("blockquote", classes)}${inlineHtml(block.children, classes)}</blockquote>`;
        // A fence scrolls too, as code is verbatim, so its box is focusable; no name, as the code describes itself.
        case "code":
          return `${openAs("pre", "pre", classes, ' tabindex="0"')}${open("code", classes)}${escapeHtml(block.text)}</code></pre>`;
        case "rule":
          return open("hr", classes);
        case "list": {
          const tag = block.ordered ? "ol" : "ul";
          const items = block.items
            .map((item) => `${open("li", classes)}${inlineHtml(item, classes)}</li>`)
            .join("");
          // A lead-in list takes `checklist` where the caller has one, else `ul`'s.
          const key = block.leadIn === true && classes.checklist !== undefined ? "checklist" : tag;
          return `${openAs(tag, key, classes, ' role="list"')}${items}</${tag}>`;
        }
        // SPEC §7: a table in its own box, so a phone scrolls the table, not the page (DESIGN.md's no-overflow rule).
        case "table": {
          const head = `${open("thead", classes)}${open("tr", classes)}${cellsHtml("th", block.head, block.align, classes)}</tr></thead>`;
          const body = block.rows
            .map((row) => `${open("tr", classes)}${cellsHtml("td", row, block.align, classes)}</tr>`)
            .join("");
          // Focusable because it scrolls: three constant attributes, minted here (see the header).
          const box = openAs(
            "div",
            "tableWrap",
            classes,
            ` tabindex="0" role="group" aria-label="${escapeHtml(block.label)}"`
          );
          return `${box}${open("table", classes)}${head}${open("tbody", classes)}${body}</tbody></table></div>`;
        }
        // The short-answer box. A container and nothing more: it makes no
        // claim of its own and emits no structured data.
        case "answer":
          return (
            `${openAs("div", "answer", classes)}` +
            `${openAs("p", "answerLabel", classes)}${escapeHtml(block.label)}</p>` +
            `${toHtml(block.children, classes)}</div>`
          );
        // The key takeaways: the same container under its own label.
        case "takeaways":
          return (
            `${openAs("div", "takeaways", classes)}` +
            `${openAs("p", "takeawaysLabel", classes)}${escapeHtml(block.label)}</p>` +
            `${toHtml(block.children, classes)}</div>`
          );
        // Related guides. Every item is a link, because `guidesBlock` drops
        // any whose address this product would not publish.
        case "guides": {
          if (block.items.length === 0) return "";
          const items = block.items
            .map(
              (item) =>
                `${open("li", classes)}${open("a", classes, ` href="${escapeHtml(item.href)}"`)}${escapeHtml(item.label)}</a></li>`
            )
            .join("");
          return (
            `${openAs("div", "guides", classes)}` +
            `${openAs("p", "guidesLabel", classes)}${escapeHtml(block.label)}</p>` +
            `${open("ul", classes, ' role="list"')}${items}</ul></div>`
          );
        }
      }
    })
    .join("\n");
}

/** Markdown in, HTML out — the whole renderer in one call, unclassed: the
 *  bytes the copy-as-HTML control hands over. */
export function renderMarkdownHtml(md: string, say?: Say): string {
  const blocks = parseMarkdown(md);
  return toHtml(say === undefined ? blocks : labelledIn(blocks, say));
}

/** Every heading levelled so the shallowest sits at `<h2>`, one under the screen's `<h1>`, with nothing skipped: a fixed
 *  `+1` would leave a `##`-rooted legal body skipping `h2` (`heading-order`), and `+0` would make a `#` a second `<h1>`.
 *  The level moves, never the size, so each heading computes its own step (`heading-scale.test.ts`). */
export function headingsUnderTitle(blocks: readonly Block[]): Block[] {
  const shallowest = shallowestHeading(blocks);
  if (shallowest === null) return [...blocks];
  return shiftHeadings(blocks, 2 - shallowest);
}

/** The smallest `level` any heading in the tree carries, `answer` blocks
 *  included, or `null` where the body has no heading at all. */
function shallowestHeading(blocks: readonly Block[]): number | null {
  let found: number | null = null;
  for (const block of blocks) {
    const level =
      block.kind === "heading"
        ? block.level
        : block.kind === "answer" || block.kind === "takeaways"
          ? shallowestHeading(block.children)
          : null;
    if (level !== null && (found === null || level < found)) found = level;
  }
  return found;
}

/** Every heading `by` levels along, clamped to the six that exist. */
function shiftHeadings(blocks: readonly Block[], by: number): Block[] {
  return blocks.map((block) => {
    if (block.kind === "answer" || block.kind === "takeaways") {
      return { ...block, children: shiftHeadings(block.children, by) };
    }
    if (block.kind !== "heading") return block;
    const level = Math.min(6, Math.max(1, block.level + by)) as 1 | 2 | 3 | 4 | 5 | 6;
    return { ...block, level };
  });
}

/** Every heading one level down, for the draft screen, which prints its own `<h1>` above a body the writer controls,
 *  so a `##` earns its own step as an `<h3>` rather than being restyled (`heading-scale.test.ts`). `h6` stays `h6`.
 *  A transform over blocks, so `renderMarkdownHtml` and the copy-out publish unshifted bytes. */
export function demoteHeadings(blocks: readonly Block[]): Block[] {
  return blocks.map((block) => {
    if (block.kind === "answer" || block.kind === "takeaways") {
      return { ...block, children: demoteHeadings(block.children) };
    }
    return block.kind === "heading" && block.level < 6
      ? { ...block, level: (block.level + 1) as 2 | 3 | 4 | 5 | 6 }
      : block;
  });
}
