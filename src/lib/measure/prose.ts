// SPEC §5 (2026-09-29, #1127) · issue #1130 — the text a fact may be read from.
//
// "Navigation, buttons, footers and example or demo widgets are never facts
// (drafted rule: a passage repeated on three or more pages, or inside an
// element marked as an example, is dropped)."
//
// `parse.ts`'s `visibleText` is what the measurement scores a page on, and
// it stays the whole rendered document. This is the narrower read the
// facts are taken from: the same document with its chrome and its examples
// removed, one line per block, so a heading or a menu item never runs on
// into the sentence after it. The repetition half of the rule needs every
// page at once and lives with the passages (`generate/pipeline/grounding.ts`).
import { parse, type HTMLElement } from "node-html-parser";

/** What a page wears on every page, and what is never read as prose. */
const CHROME = "script, style, template, noscript, svg, nav, header, footer, button, [aria-hidden], [hidden]";

/** A class, id or data attribute that names the element as an example. */
const EXAMPLE_TOKEN_RE = /(?:^|[\s_-])(?:example|demo|specimen)(?:$|[\s_-])/i;

/** A short line saying that what it sits beside is an example: "An example
 *  business.", "Demo data", "Example dashboard". Not "For example, …",
 *  which is a sentence using the word. */
const EXAMPLE_NOTICE_RE =
  /^(?:this is )?(?:an? )?(?:example|demo|sample)\b|\b(?:example|demo|sample) (?:business|company|data|dashboard|account|report|site|store)\b/i;
const EXAMPLE_NOTICE_MAX_CHARS = 120;

/** Containers too wide to be "the example" a notice captions. */
const PAGE_LEVEL = new Set(["html", "body", "main"]);

function markedAsExample(element: HTMLElement): boolean {
  for (const [name, value] of Object.entries(element.attributes)) {
    if ((name === "class" || name === "id" || name.startsWith("data-")) && EXAMPLE_TOKEN_RE.test(value)) return true;
  }
  return false;
}

/** The element a notice captions: its parent, unless that is the page. */
function captioned(notice: HTMLElement): HTMLElement {
  const parent = notice.parentNode;
  return parent === null || PAGE_LEVEL.has(parent.rawTagName?.toLowerCase() ?? "html") ? notice : parent;
}

/** The document's prose: chrome and examples removed, one block per line.
 *  Total: any string parses, and one that is not HTML yields its text. */
export function proseText(html: string): string {
  const root = parse(html, { comment: false });
  for (const element of root.querySelectorAll(CHROME)) {
    if (element.getAttribute("aria-hidden") !== "false") element.remove();
  }
  const examples = new Set<HTMLElement>();
  for (const element of root.querySelectorAll("*")) {
    if (markedAsExample(element)) {
      examples.add(element);
      continue;
    }
    if (element.querySelector("p, div, section, article, li, table") !== null) continue;
    const text = element.text.replace(/\s+/g, " ").trim();
    if (text.length <= EXAMPLE_NOTICE_MAX_CHARS && EXAMPLE_NOTICE_RE.test(text)) examples.add(captioned(element));
  }
  for (const element of examples) element.remove();
  const body = root.querySelector("body") ?? root;
  return body.structuredText
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line !== "")
    .join("\n");
}
