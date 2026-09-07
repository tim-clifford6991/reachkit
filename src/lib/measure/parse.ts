// BUILD §5 — one fetched document to the counted facts every driver reads.
// src/lib/measure/parse.ts — WO-251, BP-010
//
// One fetched HTML document, one pass, to the counted facts every driver in
// WO-252 is computed from — headings, question-shaped headings, direct-
// answer blocks, evidence tokens, structured data, Open Graph tags and the
// document's own access gates. Deterministic and total: no fetch, no clock,
// no JavaScript execution, no headless browser, and no locale-dependent
// collation (BP-010 `## Error & edge behavior`). `OnPageFacts` is derived
// here, not copied from a blueprint — see this WO's `rests-on` row 2 and
// its `## Interfaces` section, flagged for the architect to fold into
// BP-010's `## Public interface`.
//
// **Counts only.** No score, no ratio, no floor and no coefficient appears
// in this file; those are WO-252's (`## Out of scope`). The one pin this
// file reads is the direct-answer character window and the (unused-here)
// answerability floor, both transcribed to `SCORING` by WO-251's own first
// file-plan row — never written as a literal here (`structure.md` rule 5).
import { SCORING } from "@/lib/config/constants";

/** The counted facts of one fetched document. Named by BP-010's
 *  `measureDomain` return type and by BP-012's `StoredReport`
 *  (`onPage: OnPageFacts // BP-010`); declared here for the first time.
 *  Counts only: nothing in this type is a score, a ratio, a floor or a
 *  band. Empty denominators read 0, never null. */
export interface OnPageFacts {
  url: string;
  /** `BUILD.md` §5: "question-shaped headings ÷ all headings". */
  headings: number;
  /** §5: "question-shaped = ends `?` or opens with how/what/why/when/
   *  where/which/who/can/do/does/is/are". */
  questionShapedHeadings: number;
  /** §5: "question headings whose first block is 40–320 visible chars".
   *  The window is BP-005's pin; this field is the count that passed it. */
  directAnswerHeadings: number;
  /** §5's evidence density inputs, counted raw. The saturating log curve
   *  over them is WO-252's, not this file's. */
  numerals: number;
  dates: number;
  outboundCitations: number;
  visibleChars: number;
  /** BP-010 `## Module / boundary`: "the parsers (headings, answer blocks,
   *  evidence density, schema, OG)". Types and property names as written
   *  in the document, lowercased; no interpretation. */
  schemaTypes: readonly string[];
  openGraphProperties: readonly string[];
  /** The document's own access gates. REQ-004 c7's case — "a home document
   *  the scan read that tells every reader not to index it" — is
   *  `noindex && noindexAppliesToEveryReader`. What that *means* for the
   *  score is WO-252's; what it means for the blocked-readers count is
   *  BP-024's. */
  noindex: boolean;
  noindexAppliesToEveryReader: boolean;
}

// ── Internal parsing surface ────────────────────────────────────────────
//
// A hand-rolled, regex-and-scan parser — not a DOM library. WO-251's own
// file plan bounds this order to six files and adds no dependency; a real
// DOM (jsdom or otherwise) is also how "no headless browser is used"
// (BP-010) is read literally, not just for script execution.

const COMMENT_RE = /<!--[\s\S]*?-->/g;
const NOISE_BLOCK_RE = /<(script|style|template)\b[^>]*>[\s\S]*?<\/\1>/gi;

/** ASCII-only case fold — never the runtime's `toLowerCase`/
 *  `toLocaleLowerCase`, so a document's or process's locale can never
 *  change which characters map to which (BP-010: "no locale-dependent
 *  collation"). Only `A`–`Z` move; every other code unit, including any
 *  non-ASCII letter, passes through untouched. */
export function asciiLowerCase(input: string): string {
  let out = "";
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    out += code >= 65 && code <= 90 ? String.fromCharCode(code + 32) : input[i];
  }
  return out;
}

// A small, fixed named-entity table plus numeric character references.
// Deterministic and total: an entity this table does not know is left as
// written, never guessed.
const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body[0] === "#") {
      const isHex = body[1] === "x" || body[1] === "X";
      const codePoint = isHex ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10);
      if (Number.isFinite(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff) {
        try {
          return String.fromCodePoint(codePoint);
        } catch {
          return whole;
        }
      }
      return whole;
    }
    const known = NAMED_ENTITIES[body];
    return known ?? whole;
  });
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, " ");
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** The document's rendered text, over an already noise-stripped fragment. */
function renderedText(fragment: string): string {
  return collapseWhitespace(decodeEntities(stripTags(fragment)));
}

// Block-level tags a direct-answer block can be. A heading is deliberately
// excluded and instead treated as a terminator below — a question-shaped
// heading immediately followed by another heading, with nothing in
// between, has given no answer (rule 1.1 — an internal parsing boundary,
// not a customer promise).
const BLOCK_TAGS = new Set([
  "p",
  "div",
  "section",
  "article",
  "ul",
  "ol",
  "table",
  "blockquote",
  "pre",
  "figure",
  "header",
  "footer",
  "aside",
  "nav",
  "form",
  "main",
  "dl",
  "address",
]);

const HEADING_TAG_RE = /^h[1-6]$/;
const OPEN_TAG_RE = /<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>/g;

/** Scans forward from `fromIndex` in `html` for the closing tag of
 *  `tagName` that matches the one already opened (depth 1), so a nested
 *  element of the same name does not end the block early. Returns the
 *  index of the closing tag's `<`, or -1 if the document never closes it
 *  (never thrown — the caller takes "to the end of the document"). */
function findMatchingClose(html: string, tagName: string, from: number): number {
  const tagRe = new RegExp(`<(/?)${tagName}\\b[^>]*?(/?)>`, "gi");
  tagRe.lastIndex = from;
  let depth = 1;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(html)) !== null) {
    const isClose = match[1] === "/";
    const isSelfClosing = match[2] === "/";
    if (isClose) {
      depth--;
      if (depth === 0) return match.index;
    } else if (!isSelfClosing) {
      depth++;
    }
  }
  return -1;
}

/** The first block-level element after `fromIndex`, or `null` if the next
 *  thing that qualifies is another heading (no block) or the document
 *  simply ends first. Only ever reads `html`; never fetches, never times
 *  anything. */
function firstBlockAfter(html: string, fromIndex: number): string | null {
  OPEN_TAG_RE.lastIndex = fromIndex;
  let match: RegExpExecArray | null;
  while ((match = OPEN_TAG_RE.exec(html)) !== null) {
    const tagName = asciiLowerCase(match[1] ?? "");
    const selfClosing = match[2] === "/";
    if (HEADING_TAG_RE.test(tagName)) {
      return null;
    }
    if (!selfClosing && BLOCK_TAGS.has(tagName)) {
      const contentStart = OPEN_TAG_RE.lastIndex;
      const closeIndex = findMatchingClose(html, tagName, contentStart);
      const inner = closeIndex === -1 ? html.slice(contentStart) : html.slice(contentStart, closeIndex);
      return inner;
    }
    // Any other tag (an inline element, a void element like `<br>` or
    // `<img>`) is not itself a block — keep scanning past it.
  }
  return null;
}

// The twelve openers `BUILD.md` §5 names, and no other token — order kept
// as written there.
const QUESTION_OPENERS: readonly string[] = [
  "how",
  "what",
  "why",
  "when",
  "where",
  "which",
  "who",
  "can",
  "do",
  "does",
  "is",
  "are",
];
const OPENER_RE = new RegExp(`^(${QUESTION_OPENERS.join("|")})\\b`);

function isQuestionShaped(headingText: string): boolean {
  const trimmed = headingText.trim();
  if (trimmed.endsWith("?")) return true;
  return OPENER_RE.test(asciiLowerCase(trimmed));
}

const HEADING_RE = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;

function numeralCount(text: string): number {
  const matches = text.match(/\d+/g);
  return matches ? matches.length : 0;
}

// A bounded, deterministic date-shaped-token battery — never a clock read,
// never `Date`-parsed. ISO, US-slash, and "Month day[, year]" /
// "day Month[, year]" forms.
const MONTH_NAMES =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
const DATE_RE = new RegExp(
  [
    `\\b\\d{4}-\\d{1,2}-\\d{1,2}\\b`, // ISO: 2026-09-04
    `\\b\\d{1,2}\\/\\d{1,2}\\/\\d{2,4}\\b`, // US slash: 9/4/2026
    `\\b(?:${MONTH_NAMES})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+\\d{4})?\\b`, // September 4, 2026
    `\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTH_NAMES})\\.?(?:,?\\s+\\d{4})?\\b`, // 4 September 2026
  ].join("|"),
  "gi"
);

function dateCount(text: string): number {
  const matches = text.match(DATE_RE);
  return matches ? matches.length : 0;
}

const ANCHOR_HREF_RE = /<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>/gi;

function outboundCitationCount(html: string, pageUrl: string): number {
  let baseHost = "";
  try {
    baseHost = new URL(pageUrl).hostname;
  } catch {
    baseHost = "";
  }
  let count = 0;
  let match: RegExpExecArray | null;
  ANCHOR_HREF_RE.lastIndex = 0;
  while ((match = ANCHOR_HREF_RE.exec(html)) !== null) {
    const href = match[1] ?? match[2] ?? "";
    if (!href) continue;
    try {
      const resolved = new URL(href, pageUrl || undefined);
      if (
        (resolved.protocol === "http:" || resolved.protocol === "https:") &&
        resolved.hostname !== baseHost
      ) {
        count++;
      }
    } catch {
      // Not a resolvable URL (relative with no base, `mailto:`, malformed)
      // — never a citation, never a throw.
    }
  }
  return count;
}

// ── Structured data (JSON-LD + microdata) and Open Graph ──────────────

const JSON_LD_RE = /<script\b[^>]*\btype\s*=\s*(?:"application\/ld\+json"|'application\/ld\+json')[^>]*>([\s\S]*?)<\/script>/gi;
const ITEMTYPE_RE = /\bitemtype\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const META_TAG_RE = /<meta\b[^>]*>/gi;

function collectJsonLdTypes(value: unknown, out: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectJsonLdTypes(item, out);
    return;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const type = obj["@type"];
    if (typeof type === "string") {
      out.push(type);
    } else if (Array.isArray(type)) {
      for (const t of type) if (typeof t === "string") out.push(t);
    }
    for (const key of Object.keys(obj)) {
      if (key === "@type") continue;
      collectJsonLdTypes(obj[key], out);
    }
  }
}

function schemaTypesOf(withoutComments: string): readonly string[] {
  const types: string[] = [];
  let match: RegExpExecArray | null;
  JSON_LD_RE.lastIndex = 0;
  while ((match = JSON_LD_RE.exec(withoutComments)) !== null) {
    const body = match[1] ?? "";
    try {
      const parsed: unknown = JSON.parse(body);
      collectJsonLdTypes(parsed, types);
    } catch {
      // Malformed JSON-LD — never thrown, never counted.
    }
  }
  ITEMTYPE_RE.lastIndex = 0;
  while ((match = ITEMTYPE_RE.exec(withoutComments)) !== null) {
    const value = match[1] ?? match[2] ?? "";
    if (value) types.push(value);
  }
  return types.map(asciiLowerCase);
}

function attrValue(tag: string, name: string): string | null {
  const re = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i");
  const m = re.exec(tag);
  if (!m) return null;
  return m[1] ?? m[2] ?? "";
}

interface MetaGates {
  openGraphProperties: string[];
  noindex: boolean;
  noindexAppliesToEveryReader: boolean;
}

function scanMetaTags(withoutComments: string): MetaGates {
  const openGraphProperties: string[] = [];
  let sawAnyNoindex = false;
  let sawGenericNoindex = false;

  let match: RegExpExecArray | null;
  META_TAG_RE.lastIndex = 0;
  while ((match = META_TAG_RE.exec(withoutComments)) !== null) {
    const tag = match[0];
    const property = attrValue(tag, "property");
    if (property && asciiLowerCase(property).startsWith("og:")) {
      openGraphProperties.push(asciiLowerCase(property));
    }
    const name = attrValue(tag, "name");
    const content = attrValue(tag, "content");
    if (name && content) {
      const tokens = asciiLowerCase(content)
        .split(",")
        .map((t) => t.trim());
      if (tokens.includes("noindex")) {
        sawAnyNoindex = true;
        if (asciiLowerCase(name) === "robots") {
          sawGenericNoindex = true;
        }
      }
    }
  }

  return {
    openGraphProperties,
    noindex: sawAnyNoindex,
    noindexAppliesToEveryReader: sawGenericNoindex,
  };
}

/** Strips `<script>`, `<style>`, `<template>` and comment nodes, then
 *  takes the document's text content. No JavaScript is executed and no
 *  headless browser is used (BP-010 `## Error & edge behavior`). */
export function visibleText(html: string): string {
  const withoutComments = html.replace(COMMENT_RE, "");
  const cleaned = withoutComments.replace(NOISE_BLOCK_RE, " ");
  return renderedText(cleaned);
}

/** Deterministic and total: any string parses, including an empty one,
 *  which yields every count at 0. Never throws. */
export function parseOnPage(a: { url: string; html: string }): OnPageFacts {
  try {
    const html = a.html;
    const withoutComments = html.replace(COMMENT_RE, "");
    const cleaned = withoutComments.replace(NOISE_BLOCK_RE, " ");

    let headings = 0;
    let questionShapedHeadings = 0;
    let directAnswerHeadings = 0;

    HEADING_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = HEADING_RE.exec(cleaned)) !== null) {
      headings++;
      const rawInner = match[2] ?? "";
      const headingText = renderedText(rawInner);
      if (isQuestionShaped(headingText)) {
        questionShapedHeadings++;
        const blockAfter = firstBlockAfter(cleaned, HEADING_RE.lastIndex);
        const blockChars = blockAfter === null ? 0 : renderedText(blockAfter).length;
        if (blockChars >= SCORING.directAnswerCharsMin && blockChars <= SCORING.directAnswerCharsMax) {
          directAnswerHeadings++;
        }
      }
    }

    const wholeVisibleText = renderedText(cleaned);
    const numerals = numeralCount(wholeVisibleText);
    const dates = dateCount(wholeVisibleText);
    const outboundCitations = outboundCitationCount(cleaned, a.url);
    const visibleChars = wholeVisibleText.length;

    const schemaTypes = schemaTypesOf(withoutComments);
    const { openGraphProperties, noindex, noindexAppliesToEveryReader } = scanMetaTags(withoutComments);

    return {
      url: a.url,
      headings,
      questionShapedHeadings,
      directAnswerHeadings,
      numerals,
      dates,
      outboundCitations,
      visibleChars,
      schemaTypes,
      openGraphProperties,
      noindex,
      noindexAppliesToEveryReader,
    };
  } catch {
    // Total: a parse of a malformed, truncated or non-HTML document never
    // throws — every count reads 0, never an exception (BP-006 already
    // turned every failure into a typed outcome; this file does not
    // reintroduce the exception path node removed).
    return {
      url: a.url,
      headings: 0,
      questionShapedHeadings: 0,
      directAnswerHeadings: 0,
      numerals: 0,
      dates: 0,
      outboundCitations: 0,
      visibleChars: 0,
      schemaTypes: [],
      openGraphProperties: [],
      noindex: false,
      noindexAppliesToEveryReader: false,
    };
  }
}
