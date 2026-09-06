// BUILD §4.6 — the one Markdown renderer.
//
// §4.6 gives the draft view a live preview pane and §9 gives every
// destination ReachKit does not serve a copy-out ("Everything else = copy
// as Markdown/HTML (always shown)"). Those are two sinks and they must not
// be two renderers: a second renderer means the HTML the customer copies
// and the HTML that publishes differ, and the customer is the publisher of
// record for whichever they use. So this module parses once and serialises
// once, and every caller — the read view's body, the editor's preview pane,
// and the copy-as-HTML control — goes through `toHtml`.
//
// **The hosted template (§9's `content.{customer-domain}` edge) imports this
// module when it lands; it does not write a second one.** That is the whole
// point of the decision, recorded in the archived BP-044 decision 3.
//
// No dependency: nothing in `package.json` renders Markdown, and adding one
// is the owner's call (`CLAUDE.md`). The grammar below is the subset a
// generated page uses — headings, paragraphs, lists, block quotes, fenced
// code, thematic breaks, and inline emphasis, code and links. It is stated
// as a closed list rather than implied: a construct not listed renders as
// the literal text the customer typed, which is the safe direction. What it
// deliberately does **not** do is pass raw HTML through. Every character of
// text is escaped on the way out, so a body — generated or typed by the
// customer — cannot introduce markup, and the string this module returns is
// safe to set as HTML by construction rather than by a sanitiser someone
// has to remember to call.

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string }
  | { kind: "strong"; children: readonly Inline[] }
  | { kind: "em"; children: readonly Inline[] }
  | { kind: "link"; href: string; children: readonly Inline[] }
  /** REQ-045 criterion 2's mark. Produced only by `markPassage`, never by
   *  the parser: a body cannot mint its own highlight. */
  | { kind: "mark"; children: readonly Inline[] };

export type Block =
  | { kind: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; children: readonly Inline[] }
  | { kind: "paragraph"; children: readonly Inline[] }
  | { kind: "quote"; children: readonly Inline[] }
  | { kind: "list"; ordered: boolean; items: ReadonlyArray<readonly Inline[]> }
  | { kind: "code"; text: string }
  | { kind: "rule" };

// ── inline ──────────────────────────────────────────────────────────────

/** The four link schemes a draft may address. Anything else — `javascript:`
 *  above all — is not a link at all: the text renders and the address does
 *  not become clickable. A closed list, because the alternative is a
 *  blocklist and a blocklist is always one scheme behind. */
const LINK_SCHEMES = ["http://", "https://", "mailto:", "/"] as const;

function isAddressable(href: string): boolean {
  return LINK_SCHEMES.some((scheme) => href.startsWith(scheme));
}

const INLINE_RE =
  /(`[^`]+`)|(\[[^\]\n]*\]\([^)\s]+\))|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)/;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let rest = text;

  while (rest.length > 0) {
    const match = INLINE_RE.exec(rest);
    if (!match || match.index === undefined) break;
    if (match.index > 0) out.push({ kind: "text", text: rest.slice(0, match.index) });
    const token = match[0];

    if (token.startsWith("`")) {
      out.push({ kind: "code", text: token.slice(1, -1) });
    } else if (token.startsWith("[")) {
      const close = token.indexOf("](");
      const label = token.slice(1, close);
      const href = token.slice(close + 2, -1);
      if (isAddressable(href)) {
        out.push({ kind: "link", href, children: parseInline(label) });
      } else {
        out.push({ kind: "text", text: label });
      }
    } else if (token.startsWith("**") || token.startsWith("__")) {
      out.push({ kind: "strong", children: parseInline(token.slice(2, -2)) });
    } else {
      out.push({ kind: "em", children: parseInline(token.slice(1, -1)) });
    }

    rest = rest.slice(match.index + token.length);
  }

  if (rest.length > 0) out.push({ kind: "text", text: rest });
  return out;
}

// ── blocks ──────────────────────────────────────────────────────────────

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const RULE_RE = /^(-{3,}|\*{3,}|_{3,})\s*$/;
const UL_RE = /^[-*+]\s+(.*)$/;
const OL_RE = /^\d+[.)]\s+(.*)$/;
const QUOTE_RE = /^>\s?(.*)$/;
const FENCE_RE = /^```/;

/** Markdown in, blocks out. Line-based and total: every line lands in
 *  exactly one block, and a line matching nothing is paragraph text. */
export function parseMarkdown(md: string): Block[] {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  function flushParagraph(): void {
    if (paragraph.length === 0) return;
    blocks.push({ kind: "paragraph", children: parseInline(paragraph.join(" ")) });
    paragraph = [];
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";

    if (FENCE_RE.test(line)) {
      flushParagraph();
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !FENCE_RE.test(lines[i] ?? "")) {
        body.push(lines[i] ?? "");
        i += 1;
      }
      blocks.push({ kind: "code", text: body.join("\n") });
      continue;
    }

    if (line.trim() === "") {
      flushParagraph();
      continue;
    }

    if (RULE_RE.test(line)) {
      flushParagraph();
      blocks.push({ kind: "rule" });
      continue;
    }

    const heading = HEADING_RE.exec(line);
    if (heading) {
      flushParagraph();
      const level = (heading[1] ?? "#").length as 1 | 2 | 3 | 4 | 5 | 6;
      blocks.push({ kind: "heading", level, children: parseInline(heading[2] ?? "") });
      continue;
    }

    const quote = QUOTE_RE.exec(line);
    if (quote) {
      flushParagraph();
      const parts = [quote[1] ?? ""];
      while (i + 1 < lines.length) {
        const next = QUOTE_RE.exec(lines[i + 1] ?? "");
        if (!next) break;
        parts.push(next[1] ?? "");
        i += 1;
      }
      blocks.push({ kind: "quote", children: parseInline(parts.join(" ")) });
      continue;
    }

    const bullet = UL_RE.exec(line);
    const number = OL_RE.exec(line);
    if (bullet || number) {
      flushParagraph();
      const ordered = bullet === null;
      const items: Inline[][] = [parseInline((bullet ?? number)?.[1] ?? "")];
      while (i + 1 < lines.length) {
        const nextLine = lines[i + 1] ?? "";
        const next = ordered ? OL_RE.exec(nextLine) : UL_RE.exec(nextLine);
        if (!next) break;
        items.push(parseInline(next[1] ?? ""));
        i += 1;
      }
      blocks.push({ kind: "list", ordered, items });
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  return blocks;
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
  const out = blocks.map((block): Block => {
    if (block.kind === "code" || block.kind === "rule") return block;
    if (block.kind === "list") {
      return { ...block, items: block.items.map((item) => markInline(item, needle, done)) };
    }
    return { ...block, children: markInline(block.children, needle, done) };
  });
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
 */
export type HtmlClasses = Partial<
  Record<
    | "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
    | "p" | "ul" | "ol" | "li" | "blockquote" | "pre" | "code" | "hr"
    | "a" | "mark" | "strong" | "em",
    string
  >
>;

function open(tag: string, classes: HtmlClasses, extra = ""): string {
  const cls = classes[tag as keyof HtmlClasses];
  return `<${tag}${extra}${cls === undefined ? "" : ` class="${escapeHtml(cls)}"`}>`;
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

/** Blocks in, HTML out. The one serialiser: the read view's body, the
 *  preview pane and the copy-as-HTML control all end here. */
export function toHtml(blocks: readonly Block[], classes: HtmlClasses = {}): string {
  return blocks
    .map((block) => {
      switch (block.kind) {
        case "heading": {
          const tag = `h${block.level}`;
          return `${open(tag, classes)}${inlineHtml(block.children, classes)}</${tag}>`;
        }
        case "paragraph":
          return `${open("p", classes)}${inlineHtml(block.children, classes)}</p>`;
        case "quote":
          return `${open("blockquote", classes)}${inlineHtml(block.children, classes)}</blockquote>`;
        case "code":
          return `${open("pre", classes)}${open("code", classes)}${escapeHtml(block.text)}</code></pre>`;
        case "rule":
          return open("hr", classes);
        case "list": {
          const tag = block.ordered ? "ol" : "ul";
          const items = block.items
            .map((item) => `${open("li", classes)}${inlineHtml(item, classes)}</li>`)
            .join("");
          return `${open(tag, classes)}${items}</${tag}>`;
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
