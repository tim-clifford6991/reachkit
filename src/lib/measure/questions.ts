// SPEC §5 (2026-10-07, issue 1314) — the questions a page itself asks.
//
// Three sites of the customer panel built a knowledge base with no buyer
// question, though a site that answers its buyers' questions usually says
// so in its own markup. Three places are read, and none of them is a guess:
//
//   * the page's `FAQPage` or `QAPage` schema: each `Question`'s `name`;
//   * a `summary`, a `dt` or an accordion's button that is phrased as a
//     question, and a heading that asks one;
//   * any short line phrased as a question inside a section the page marks
//     as its FAQ.
//
// "Phrased as a question" is the rule D65 already keeps (`isBuyerQuestion`,
// `site-profile/knowledge/clean.ts`): it ends in a question mark and is
// longer than a label. A heading has to do more, because a call to action
// is often dressed as one ("Ready to get started?", "Need a plumber
// today?") and D65 keeps a call to action out: outside an FAQ, a heading
// is taken only where it opens as a question does — with the word that
// asks. A page with none yields none.
//
// Read from the parsed document before `prose.ts` removes its chrome: an
// accordion's question is usually a `button`, and the schema is a `script`.
import type { HTMLElement } from "node-html-parser";

/** The marks a question ends with: Latin, full-width, Arabic. */
const ENDS_AS_QUESTION = /[?？؟]$/;
const MIN_WORDS = 3;
const MAX_CHARS = 300;
/** The most one page yields: an FAQ page of a hundred entries is still one
 *  page of the base. */
export const PAGE_QUESTIONS_MAX = 40;

/** Elements built to hold a question and its answer: their own text is a
 *  question where it is phrased as one. */
const QUESTION_ELEMENTS = "summary, dt, [aria-expanded], [itemprop=name]";
const HEADINGS = "h1, h2, h3, h4, h5, h6";

/** The words a question opens with, in the languages a site's pages are
 *  most often written in. "Ready to start?" opens with none of them. */
const ASKS = new RegExp(
  `^(?:${[
    "who|whom|whose|what|when|where|why|how|which|can|could|do|does|did|is|are|was|were|will|would|should|may|must",
    "wer|was|wann|wo|woher|wohin|warum|wieso|weshalb|wie|wieviel|welche[rsnm]?|kann|können|darf|muss|soll|ist|sind|gibt|hat|haben|wird|werden",
    "qui|que|quoi|quand|où|pourquoi|comment|combien|quel(?:le)?s?|est-ce|peut-on|puis-je|faut-il",
    "quién|qué|cuándo|dónde|cómo|cuánto|cuál(?:es)?|puedo|se puede|hay|es|son",
    "chi|cosa|che|quando|dove|perché|come|quanto|quale|posso",
    "wie|wat|wanneer|waar|waarom|hoe|hoeveel|welke|kan|mag|moet",
  ].join("|")})(?![\\p{L}\\p{N}])`,
  "iu"
);

/** A class or id that names the element as the page's FAQ, in the
 *  languages a site's markup is most often written in. */
const FAQ_TOKEN_RE = /(?:^|[\s_-])(?:faqs?|frequently[\s_-]asked|questions?|fragen|preguntas|domande|vragen)(?:$|[\s_-])/i;

/** What the page's menus hold is navigation, whatever its wording. */
const NEVER_INSIDE = new Set(["nav", "footer"]);

function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** What numbers an FAQ's entries: "2.", "3)", "Q:", "Q4.". */
const ENUMERATOR = /^(?:\d{1,2}[.)]|q\d{0,2}[.:)])\s+/i;

function asked(text: string): string | null {
  const line = oneLine(text).replace(ENUMERATOR, "");
  if (line.length > MAX_CHARS || !ENDS_AS_QUESTION.test(line) || line.split(" ").length < MIN_WORDS) return null;
  return line;
}

function inside(element: HTMLElement, tags: ReadonlySet<string>): boolean {
  for (let parent = element.parentNode; parent !== null && parent !== undefined; parent = parent.parentNode) {
    if (tags.has(parent.rawTagName?.toLowerCase() ?? "")) return true;
  }
  return false;
}

/** Every `Question` a JSON-LD value holds, at any depth. */
function schemaQuestions(value: unknown, out: string[]): void {
  if (Array.isArray(value)) {
    for (const entry of value) schemaQuestions(entry, out);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  const node = value as Record<string, unknown>;
  const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
  if (types.includes("Question") && typeof node.name === "string") out.push(node.name);
  for (const child of Object.values(node)) schemaQuestions(child, out);
}

/** The text of an entity-encoded string as a reader sees it. */
function decoded(text: string): string {
  return text
    .replace(/&(?:amp|#38);/g, "&")
    .replace(/&(?:quot|#34);/g, '"')
    .replace(/&(?:#39|apos|rsquo|#8217);/g, "'")
    .replace(/&nbsp;/g, " ");
}

/**
 * The questions the document asks, in its own order and once each. Total:
 * a document with no question, or with a schema that does not parse, yields
 * an empty list.
 */
export function pageQuestions(root: HTMLElement): string[] {
  const found: string[] = [];
  for (const script of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      schemaQuestions(JSON.parse(script.rawText), found);
    } catch {
      // A schema that is not JSON says nothing.
    }
  }
  for (const element of root.querySelectorAll(QUESTION_ELEMENTS)) {
    if (!inside(element, NEVER_INSIDE)) found.push(element.text);
  }
  for (const heading of root.querySelectorAll(HEADINGS)) {
    const text = oneLine(heading.text).replace(ENUMERATOR, "").replace(/^[¿¡]/, "");
    if (!inside(heading, NEVER_INSIDE) && ASKS.test(text)) found.push(heading.text);
  }
  for (const section of root.querySelectorAll("[class], [id]")) {
    const marks = `${section.getAttribute("class") ?? ""} ${section.getAttribute("id") ?? ""}`;
    if (!FAQ_TOKEN_RE.test(marks)) continue;
    for (const block of section.querySelectorAll("p, li, div, span, strong, b, a, button, h1, h2, h3, h4, h5, h6")) {
      // A leaf: the line itself, never the block that wraps a question and its answer.
      if (block.querySelector("p, li, div, h1, h2, h3, h4, h5, h6, summary, dt") === null) found.push(block.text);
    }
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const text of found) {
    const question = asked(decoded(text));
    const key = question?.toLocaleLowerCase();
    if (question === null || key === undefined || seen.has(key)) continue;
    seen.add(key);
    out.push(question);
    if (out.length >= PAGE_QUESTIONS_MAX) break;
  }
  return out;
}
