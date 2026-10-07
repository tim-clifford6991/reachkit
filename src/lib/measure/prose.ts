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
import { pageQuestions } from "./questions";

/** What a page wears on every page, and what is never read as prose. */
const CHROME = "script, style, template, noscript, svg, nav, header, footer, button, [aria-hidden], [hidden]";

/** A class, id or data attribute that names the element as an example. */
const EXAMPLE_TOKEN_RE = /(?:^|[\s_-])(?:example|demo|specimen|mock|mockup|placeholder|dummy)(?:$|[\s_-])/i;

/** A short line saying that what it sits beside is an example: "An example
 *  business.", "Demo data", "Example dashboard", "Demo video coming soon",
 *  "Illustrative figures". Not "For example, …", which is a sentence using
 *  the word. */
const EXAMPLE_NOTICE_RE =
  /^(?:this is )?(?:an? )?(?:example|demo|sample|illustrative)\b|\b(?:example|demo|sample|illustrative) (?:business|company|data|dashboard|account|report|site|store|video|figures|numbers|widget|chart|preview)\b|\bfor illustration\b/i;
const EXAMPLE_NOTICE_MAX_CHARS = 120;

/** A name under a domain reserved for examples (RFC 2606):
 *  `harbourbikes.example`, `rival-one.example.net`. No business is at one,
 *  so the line that names one is a widget's and not a fact (issue 1249).
 *  Only that line goes: a page of documentation says `api.example.com` in
 *  the middle of real prose. */
const RESERVED_DOMAIN_RE = /\b(?:[a-z0-9-]+\.)+example\b|\b(?:[a-z0-9-]+\.)*example\.(?:com|net|org)\b/i;

/** Containers too wide to be "the example" a notice captions, or to be an
 *  example themselves. */
const PAGE_LEVEL = new Set(["html", "body", "main"]);

/** An element that holds this share of what the page says is the page, not
 *  a widget on it (issue 1314). A site builder writes its theme's options
 *  into the classes of `body` or of the one wrapper inside it — Squarespace's
 *  `tweak-header-search-placeholder-show`, Jimdo's `j-m-dummy-styles` — and
 *  the whole page was then dropped as an example: no line of two real
 *  businesses' sites reached their knowledge base. */
const WHOLE_PAGE_SHARE = 0.9;

/** `data-example`, `data-demo`: the attribute itself says it. */
const EXAMPLE_ATTRIBUTE_RE = /^data-(?:example|demo|specimen)$/i;

function markedAsExample(element: HTMLElement): boolean {
  for (const [name, value] of Object.entries(element.attributes)) {
    if (EXAMPLE_ATTRIBUTE_RE.test(name) && value !== "false") return true;
    if ((name === "class" || name === "id" || name.startsWith("data-")) && EXAMPLE_TOKEN_RE.test(value)) return true;
  }
  return false;
}

const tagOf = (element: HTMLElement): string => element.rawTagName?.toLowerCase() ?? "html";

const lettersIn = (element: HTMLElement): number => element.text.replace(/\s+/g, "").length;

/** The element a notice captions: its parent, unless that is the page. */
function captioned(notice: HTMLElement): HTMLElement {
  const parent = notice.parentNode;
  return parent === null || PAGE_LEVEL.has(tagOf(parent)) ? notice : parent;
}

/** One block per line, each line's whitespace collapsed. */
function blockLines(structured: string): string[] {
  return structured
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line !== "");
}

export interface Prose {
  /** The document's prose: chrome and examples removed, one block per line. */
  text: string;
  /** What the examples said, one block per line — the site's demo and
   *  caption phrases (issue 1163). A page that repeats one of them outside
   *  the marked element is still repeating an example, so the facts read
   *  drops it across the whole site (`generate/pipeline/grounding.ts`). */
  examples: string[];
  /** What the page's menus said — its `nav`, `header` and `footer` — one
   *  block per line (SPEC §7, D41 stage 4, issue 1249). Never part of
   *  `text`; a generated page that repeats a line of it is stopped. */
  menus: string[];
  /** The questions the page itself asks and answers (`./questions.ts`). */
  questions: string[];
}

/** Total: any string parses, and one that is not HTML yields its text. */
export function prose(html: string): Prose {
  const root = parse(html, { comment: false });
  // Read before the chrome goes: an FAQ's questions are often buttons, and
  // its schema is a script.
  const questions = pageQuestions(root);
  const menus = [...new Set(root.querySelectorAll("nav, header, footer").flatMap((element) => blockLines(element.structuredText)))];
  for (const element of root.querySelectorAll(CHROME)) {
    if (element.getAttribute("aria-hidden") !== "false") element.remove();
  }
  const examples = new Set<HTMLElement>();
  const wholePage = lettersIn(root.querySelector("body") ?? root) * WHOLE_PAGE_SHARE;
  // A mark on the page itself, or on the wrapper that holds all of it, is a
  // theme's setting and marks no example.
  const isThePage = (element: HTMLElement): boolean =>
    PAGE_LEVEL.has(tagOf(element)) || (wholePage > 0 && lettersIn(element) >= wholePage);
  for (const element of root.querySelectorAll("*")) {
    if (markedAsExample(element) && !isThePage(element)) examples.add(element);
    if (element.querySelector("p, div, section, article, li, table") !== null) continue;
    const text = element.text.replace(/\s+/g, " ").trim();
    // A notice marked as an example itself still captions what it sits
    // beside (issue 1163): the sign-in panel's caption carries the mark,
    // and the figures it captions are its siblings.
    if (text.length <= EXAMPLE_NOTICE_MAX_CHARS && EXAMPLE_NOTICE_RE.test(text)) examples.add(captioned(element));
    else if (text.length <= EXAMPLE_NOTICE_MAX_CHARS && RESERVED_DOMAIN_RE.test(text)) examples.add(element);
  }
  const said: string[] = [];
  for (const element of examples) {
    said.push(...blockLines(element.structuredText));
    element.remove();
  }
  const body = root.querySelector("body") ?? root;
  return { text: blockLines(body.structuredText).join("\n"), examples: [...new Set(said)], menus, questions };
}

/** The document's prose alone. */
export function proseText(html: string): string {
  return prose(html).text;
}
