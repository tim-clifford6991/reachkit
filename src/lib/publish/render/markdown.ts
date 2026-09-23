// BUILD §9 · §4.6 · SPEC §7 (2026-09-20) — the one Markdown renderer, and
// the one place a delivered page's body becomes HTML.
//
// **It lives here, under `src/lib/publish/`, because that is the only side
// of the fence both readers can reach** (issue #158). A draft's body is
// Markdown and every sink puts it in front of a reader as HTML: the draft
// view's preview pane and copy-as-HTML control (§4.6), the hosted template
// (§9's `content.{customer-domain}` edge), and the WordPress adapter, which
// sends it as the post's `content`. It parses once and serialises once, and
// every caller goes through `toHtml`.
//
// Two renderers would mean the HTML the customer copies, the HTML the
// hosted page serves and the HTML that publishes into their own WordPress
// differ from one another — and the customer is the publisher of record for
// whichever they use. That is the decision, recorded in the archived BP-044
// decision 3 and ruled again by the owner on 2026-09-06 (`DECISIONS.md`,
// #119).
//
// ## The parser is a standard one now (issue 929)
//
// The same ruling ended "No Markdown dependency until fidelity demands
// one", and SPEC §7 of 2026-09-20 is where fidelity demanded one: "the
// published subset gains a table, a short-answer box and related guides …
// one serialiser still serves screen, hosted page, WordPress and copy-out,
// and every character of text is still escaped." A hand-written line
// scanner can carry six block kinds; it cannot carry a GFM table without
// becoming a second Markdown implementation with its own bugs.
//
// So the **parse** is `mdast-util-from-markdown` (micromark) with the two
// extensions `docs/DESIGN.md` lists — GFM tables and directives — and the
// **serialiser is ours, unchanged in kind**: a closed set of emitted
// elements, every text node escaped, every `href` scheme-vetted, and no
// raw HTML ever passed through.
//
// ## What did not change, and must not
//
// **The closed set is still the rule, and now it is the rule in both
// directions.** A CommonMark parser produces nodes this product has no
// element for — raw HTML, images (SPEC §7: "No images"), footnotes, and
// whatever a future extension adds. Every one of them renders as **the
// literal source text that produced it**, sliced from the input by the
// node's own position, which is the same safe direction the hand-written
// grammar took for a construct it did not know.
//
// That is what keeps a body inert (#888, #895): an `html` node's source
// text *is* the markup, so `<script>alert(1)</script>` in a body is five
// escaped characters and a word — exactly what a customer who typed it
// would expect to see. There is no allowlist of tags to keep and no
// blocklist to strip, because no markup from the input ever reaches the
// output as markup. The elements this module can emit are the closed set
// `toHtml` names below and nothing else.
//
// **The attributes are a closed set too, and every one of them is written
// here.** There are five: `href`, whose value is scheme-vetted against
// `MARKDOWN_LINK_SCHEMES` and is the only attribute value a body has any
// say in at all; `class`, whose value is the caller's own table; and
// `tabindex`, `role` and `aria-label` on the two boxes that scroll — a
// table's and a fence's — whose values are **constants this module mints**
// (`"0"`, `"group"`, and a sentence read from the registry).
//
// A body cannot forge them and cannot override them: it has no syntax that
// reaches an attribute, a `<div role="region">` written into a body is an
// `html` node and therefore escaped text, and the box is emitted by
// `toHtml` from the block rather than from anything the input said. So the
// closed-set rule holds in the presence of the three, which is why they
// could be added at all (owner, PR #973).
//
// **Why that element carries them.** A table scrolls sideways inside its
// own box — an author's table cannot be stacked into one column without
// per-column labels, so the scroll is the right call — and a box that
// scrolls must be reachable from a keyboard or its far columns are
// unreachable without a mouse. That is axe's `scrollable-region-focusable`
// (serious), the rule #962 fixed on every other scrolling pane in the
// product; `tabindex="0"` makes the box focusable and the role with a name
// is what a reader who lands on it is announced.
//
// **`group`, not `region`.** `region` is a landmark, and a landmark has to
// be uniquely named on its page — two tables in one body, with the one
// constant name this module can give them, is axe's `landmark-unique`
// (moderate), measured. A distinct name per table could only come from the
// body, which the closed set forbids. `group` is the role for a named
// container that is not a landmark, so it repeats as often as an author
// writes a table and is announced the same way each time.
//
// **A soft line ending is a space.** CommonMark keeps the newline inside
// the text node; the hand-written parser joined wrapped lines with a space.
// The space is kept, so the bytes already published for a body of
// paragraphs are the bytes this module still produces for it.
//
// ## The two new containers, and who may mint them
//
// `:::answer` — the short-answer box — is admitted **from the body**: it
// wraps the page's own opening answer, claims nothing a reader cannot
// check, and emits no structured data (`FAQPage` is built from
// `drafts.meta.faq` and never from the body — the archived BP-047
// decision 2, unchanged).
//
// `:::guides` — related guides — is **not**. SPEC §7 (2026-09-20) has the
// links come from what ReachKit already knows it published, "chosen in
// code, never by the model", so `guidesBlock()` is the only way to make
// one and a `:::guides` written into a body renders as its own literal
// text like any other construct this module does not admit. Which pages
// are chosen is the caller's, from the index issue 928 builds; what is
// here is the block, the mint that vets every address, and the renderer.
import { fromMarkdown } from "mdast-util-from-markdown";
import { directive } from "micromark-extension-directive";
import { directiveFromMarkdown } from "mdast-util-directive";
import { gfmTable } from "micromark-extension-gfm-table";
import { gfmTableFromMarkdown } from "mdast-util-gfm-table";
import type { PhrasingContent, RootContent } from "mdast";

import { MARKDOWN_LINK_SCHEMES } from "@/lib/config/constants";
import { copy } from "@/lib/presentation/copy";

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
  | { kind: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; children: readonly Inline[] }
  | { kind: "paragraph"; children: readonly Inline[] }
  | { kind: "quote"; children: readonly Inline[] }
  | { kind: "list"; ordered: boolean; items: ReadonlyArray<readonly Inline[]> }
  | { kind: "code"; text: string }
  | { kind: "rule" }
  /** SPEC §7 (2026-09-20). A header row and a body, with each column's
   *  declared alignment, and the name its scrolling box is announced by
   *  (`label`, the registry's — see the header). */
  | {
      kind: "table";
      label: string;
      head: readonly Cell[];
      rows: readonly (readonly Cell[])[];
      align: readonly Align[];
    }
  /** SPEC §7 (2026-09-20) — the short-answer box. It holds ordinary blocks
   *  and never another container: a box inside a box says nothing. */
  | { kind: "answer"; label: string; children: readonly Block[] }
  /** SPEC §7 (2026-09-20) — related guides. Minted by `guidesBlock` and
   *  never by the parser. */
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
  return out;
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
      case "list":
        out.push({
          kind: "list",
          ordered: node.ordered === true,
          items: node.children.map((item) => flatten(item.children, src)),
        });
        break;
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
        out.push(literal(node, src));
        break;
      default:
        out.push(literal(node, src));
    }
  }
  return out;
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
}): Block {
  return {
    kind: "guides",
    label: copy("body.guides.heading", { publisher: a.publisher }),
    items: a.items.filter((item) => isAddressable(item.href)),
  };
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

/**
 * The one place the *rendered* page and the *copied* page are allowed to
 * differ, and they differ only by class attributes.
 *
 * §2.2 allows custom CSS for five things and a draft body is none of them,
 * so what the customer reads on screen is styled with stock utilities — and
 * the only way to put a utility on a `<li>` produced by a Markdown renderer
 * is to let the renderer carry a class table. Passing one produces the
 * screen's render; passing none produces the bytes the copy-out control
 * hands over and the hosted template publishes. **Same function, same
 * parse, same element structure** — which is exactly the promise a second
 * renderer would break (the archived BP-044 decision 3).
 *
 * Five keys are not element names: `tableWrap`, `answer` and `guides` name
 * the containers SPEC §7's new blocks are drawn in, and `answerLabel` and
 * `guidesLabel` the eyebrow each carries. They are a `div` and a `p`
 * whichever map is passed, so the structure is still the parse's.
 */
export type HtmlClasses = Partial<
  Record<
    | "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
    | "p" | "ul" | "ol" | "li" | "blockquote" | "pre" | "code" | "hr"
    | "a" | "mark" | "strong" | "em"
    | "table" | "thead" | "tbody" | "tr" | "th" | "td"
    | "tableWrap" | "answer" | "answerLabel" | "guides" | "guidesLabel",
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
 *  rather than as an attribute — the only attributes this module writes are
 *  `href` and `class` — and it shares the one `class` the caller's own
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
          return `${open(tag, classes)}${inlineHtml(block.children, classes)}</h${block.level}>`;
        }
        case "paragraph":
          return `${open("p", classes)}${inlineHtml(block.children, classes)}</p>`;
        case "quote":
          return `${open("blockquote", classes)}${inlineHtml(block.children, classes)}</blockquote>`;
        // A fence scrolls sideways too — a code line is verbatim and must
        // not be re-wrapped — so its box is focusable for the same reason
        // the table's is. It takes `tabindex` and no name: what a reader
        // lands on is the code, which describes itself, where a table
        // region without one is a box of unannounced columns.
        case "code":
          return `${openAs("pre", "pre", classes, ' tabindex="0"')}${open("code", classes)}${escapeHtml(block.text)}</code></pre>`;
        case "rule":
          return open("hr", classes);
        case "list": {
          const tag = block.ordered ? "ol" : "ul";
          const items = block.items
            .map((item) => `${open("li", classes)}${inlineHtml(item, classes)}</li>`)
            .join("");
          return `${open(tag, classes)}${items}</${tag}>`;
        }
        // SPEC §7 (2026-09-20): a table, in a box of its own so a phone
        // scrolls the table rather than the page (`docs/DESIGN.md`'s
        // no-overflow rule, and §2.2's "always inside an `overflow-x-auto`
        // wrap"). The wrapper is what scrolls; the table keeps its shape.
        case "table": {
          const head = `${open("thead", classes)}${open("tr", classes)}${cellsHtml("th", block.head, block.align, classes)}</tr></thead>`;
          const body = block.rows
            .map((row) => `${open("tr", classes)}${cellsHtml("td", row, block.align, classes)}</tr>`)
            .join("");
          // The box is **reachable from a keyboard**, because it scrolls.
          // See the header: three constant attributes, minted here.
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
            `${open("ul", classes)}${items}</ul></div>`
          );
        }
      }
    })
    .join("\n");
}

/** Markdown in, HTML out — the whole renderer in one call, unclassed: the
 *  bytes the copy-as-HTML control hands over. */
export function renderMarkdownHtml(md: string): string {
  return toHtml(parseMarkdown(md));
}

/**
 * Every heading in a body, one level down — for a screen that already has
 * its own `<h1>` above the body it renders.
 *
 * **A body's heading is a heading *within* the screen.** The draft screen
 * (S16) and the legal screen (S5) both print their own title as the page's
 * `<h1>`, and both render a Markdown body under it. The approved set draws
 * that body's `##` one rung under the screen's head — its `.doc h2` sits at
 * `--h3` — so a `##` that stayed an `<h2>` would have to be *restyled* to a
 * size that is not its step. `heading-scale.test.ts` renders every route and
 * requires each `h1..h4` to compute its own step of the ladder, so the shift
 * is made on the level instead: a `##` arrives as an `<h3>` and earns the
 * 20px the set draws (issues #355, #493).
 *
 * `h6` stays `h6`: the scale bottoms out and nothing below it exists.
 *
 * It is a transform over parsed blocks, not an argument to the serialiser:
 * `renderMarkdownHtml` and the copy-out stay unshifted — those are the bytes
 * that publish, and on a destination the title is supplied beside them
 * rather than by a heading of ours standing over them.
 */
/**
 * Every heading in a body, levelled so the **shallowest sits at `<h2>`** —
 * one under the `<h1>` the screen prints above it, with nothing skipped.
 *
 * **Why this is not `demoteHeadings` above** (owner ruling 2026-09-23,
 * #328). That one shifts by a fixed `+1`, which is right only for a body
 * whose own top level is `#`. The owner's legal bodies open at `##`, so
 * they arrived as `<h3>` **directly under the page's `<h1>`** — `h2`
 * skipped, which is what `heading-order` reported on `/privacy` and
 * `/terms`. Shifting by a fixed amount cannot fix that without breaking
 * the other case: `+0` would make a `#`-rooted body a second `<h1>`.
 *
 * So the shift is computed from the body rather than assumed: the
 * shallowest heading becomes `<h2>` and every deeper one keeps its
 * distance from it. A body that opens at `#` is levelled exactly as
 * `demoteHeadings` levelled it, which is why #493's own fixture is
 * unchanged; a body that opens at `##` or `###` now starts at `<h2>` too.
 *
 * **What moves on screen.** A section head in the owner's legal bodies was
 * an `<h3>` (`--h3`, 20px) and is an `<h2>` (`--h2`, 25px). That is the
 * ladder's own step for the element: `src/ui/type.css` gives every `h2`
 * `--h2`, and the level moves rather than the size, so no heading is
 * restyled to reach a step that is not its own. `heading-scale.test.ts`
 * still reads each level computing that step. The words are untouched.
 *
 * `demoteHeadings` stays exactly as it is: the draft screen renders a
 * customer's article, whose headings the writer controls, and no body it
 * draws reported a skipped level.
 */
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
        : block.kind === "answer"
          ? shallowestHeading(block.children)
          : null;
    if (level !== null && (found === null || level < found)) found = level;
  }
  return found;
}

/** Every heading `by` levels along, clamped to the six that exist. */
function shiftHeadings(blocks: readonly Block[], by: number): Block[] {
  return blocks.map((block) => {
    if (block.kind === "answer") return { ...block, children: shiftHeadings(block.children, by) };
    if (block.kind !== "heading") return block;
    const level = Math.min(6, Math.max(1, block.level + by)) as 1 | 2 | 3 | 4 | 5 | 6;
    return { ...block, level };
  });
}

export function demoteHeadings(blocks: readonly Block[]): Block[] {
  return blocks.map((block) => {
    if (block.kind === "answer") return { ...block, children: demoteHeadings(block.children) };
    return block.kind === "heading" && block.level < 6
      ? { ...block, level: (block.level + 1) as 2 | 3 | 4 | 5 | 6 }
      : block;
  });
}
