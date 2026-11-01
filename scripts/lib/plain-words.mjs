// The plain-words standard as code: one parser for the copy registry and the boards, read by
// tests/ui/design/strategy.test.ts, scripts/design/parity.mjs and the copy scripts. No dependencies.
// docs/spec/decisions/2026-10-31-2145.md holds the rules this counts.

export const LIMITS = { sentence: 15, heading: 6, paragraph: 2 };

// One entry per match: the key, its value, and where the value's literal sits in the file.
export const ENTRY_RE = /"([\w$.-]+)"\s*:\s*\[\s*"((?:[^"\\]|\\.)*)"/g;
export const TITLE_KEY = /\.(title|heading|subject)$/;

// Owner-only screens and the German hosted partition are never customer copy in this sense.
export const EXEMPT_FILES = /^(?:review|ops)\.ts$|^de\//;
// Text on a customer's own pages (rule 12), the AI engine names, and the legal wording the lawyer owns.
export const EXEMPT_KEYS = [
  /^hosted\./,
  /^body\./,
  /^fact\./,
  /^ai-answers\.engine\./,
  /^legal\..*\.body$/,
  /^legal\.withdraw\./,
  /^offer\.checkout\.consent$/,
  /^offer\.start(?:\.priced)?$/,
];
// Boards drawing a customer's own pages, the owner-only screens, and the legal pages.
export const EXEMPT_BOARDS = /^(?:Hosted.*|Review|AppCosts|Legal)$/;

/** Each retired name, and the pattern that finds it. Zero tolerance wherever a customer reads. */
export const RETIRED = [
  { name: "AI Visibility", pattern: /\bAI Visibility\b/i },
  { name: "Measure again", pattern: /\bMeasure again\b/i },
  { name: "re-measure", pattern: /\bre-measure/i },
  { name: "top ten", pattern: /\btop ten\b/i },
  { name: "top 20", pattern: /\btop 20\b/i },
  // SPEC §0, 2026-10-15 (#1444): Visibility Score, Readiness, Content and competitors replaced these.
  { name: "Discoverability Score", pattern: /\bDiscoverability Score\b/i },
  { name: "findability", pattern: /\bfindability\b/i },
  { name: "Foundations", pattern: /\bFoundations\b/i },
  { name: "Answerability", pattern: /\bAnswerability\b/i },
  { name: "rival(s)", pattern: /\brivals?\b/i },
  // AI mentions or links, never names, cites or quotes; no Listed rung. Plain "named" and "listed" stay legal.
  { name: "Start free", pattern: /\bStart free\b/i },
  { name: "cited", pattern: /\bcited\b/i },
  { name: "Listed", pattern: /\bListed\b/ },
  { name: "Listed", pattern: /\blisted (in|on|by) (Google|Bing)\b/i },
  { name: "named by AI", pattern: /\bnamed (by|in) (AI|ChatGPT|Gemini|Perplexity|an AI|AI answers?)\b/i },
  { name: "named by AI", pattern: /\bNamed by\b/ },
  { name: "quoted by AI", pattern: /\bquoted (by|in) (AI|ChatGPT|Gemini|Perplexity|an AI|AI answers?)\b/i },
  { name: "quoted by AI", pattern: /\bQuoted by\b/ },
  // A stopped topic is dropped for good. "Write it again" on a held page stays.
  { name: "write this one again", pattern: /\b(write this one again|ask us to write)\b/i },
  // The Terms' old claims: a daily page, a zero window, a one-click cancel and no refund at all.
  { name: "a page every day for your site", pattern: /\ba page every day for your site\b/i },
  { name: "from none", pattern: /\bfrom none\b/i },
  { name: "in one click:", pattern: /\bin one click:/i },
  { name: "Payments already made are not refunded", pattern: /(?:^|[.!?]\s+)Payments already made are not refunded unless\b/ },
  // Up to 7 pages a week, and a week may skip a day: no daily pace and no daily ceiling.
  { name: "Publishing daily", pattern: /\bPublishing daily\b/i },
  { name: "one page a day", pattern: /\bone page a day\b/i },
  { name: "at most one a day", pattern: /\bat most one a day\b/i },
  { name: "daily pages", pattern: /\bdaily pages?\b/i },
  { name: "daily at", pattern: /\bdaily at\b/i },
  { name: "Opted out", pattern: /\bOpted out\b/ },
  // Only week 1 is emailed first; competitors are watched weekly; cancelling runs through Settings.
  { name: "We email each page first", pattern: /\bWe email each page first\b/i },
  { name: "Emailed before it goes live", pattern: /\bEmailed before it goes live\b/i },
  { name: "after we email it", pattern: /\bafter we email it\b/i },
  { name: "Cancel in one click", pattern: /\bCancel in one click\b/i },
  { name: "competitors checked", pattern: /\bcompetitors\b[^.]{0,20}\bchecked\b/i },
  // Rule 4 words with no hit left. A SOFT word moves here in the change that removes its last hit.
  { name: "prompt", pattern: /\bprompts?\b/i },
  // A capital Keyword is a vendor's product name (Moz Keyword Gap), drawn on the comparison boards.
  { name: "keyword", pattern: /\bkeywords?\b/ },
  { name: "veto", pattern: /\bveto(?:es|ed)?\b/i },
  { name: "derivation", pattern: /\bderivations?\b/i },
];

/** Rule 4 words that still have hits: counted by the ratchet, never banned outright yet. */
export const SOFT = [
  { name: "SEO", pattern: /\bSEO\b/ },
  { name: "index", pattern: /\bindex(?:ed|ing|es)?\b/i },
  { name: "crawl", pattern: /\bcrawl/i },
  // The DNS steps of setup name the record they ask for.
  { name: "CNAME", pattern: /\bCNAME\b/, allow: /^setup\.(?:zone|dns|destination\.guide|connect\.steps)\./ },
  { name: "pass", pattern: /\b(?:deep |weekly |the |a )pass(?:es)?\b/i },
  { name: "re-score", pattern: /\bre-?scor/i },
  { name: "supply", pattern: /\bsupply\b/i },
  { name: "spares", pattern: /\bspares?\b/i },
  { name: "draft", pattern: /\bdrafts?\b/i },
  { name: "opportunity", pattern: /\bopportunit(?:y|ies)\b/i },
  { name: "fetched", pattern: /\bfetch(?:ed|es|ing)?\b/i },
];

export function isExempt(key, file = "") {
  return EXEMPT_FILES.test(file) || EXEMPT_KEYS.some((re) => re.test(key));
}

/** The entries of one key file's source text. `start`/`end` bound the value's literal, quotes excluded. */
/**
 * @param {string} source
 * @returns {{ key: string, value: string, start: number, end: number }[]}
 */
export function entries(source) {
  const out = [];
  for (const m of source.matchAll(ENTRY_RE)) {
    const [whole, key = "", raw = ""] = m;
    const start = m.index + whole.length - raw.length - 1;
    out.push({ key, value: JSON.parse(`"${raw}"`), start, end: start + raw.length });
  }
  return out;
}

const SLOT = "\u0001";
const ABBREVIATION = /\b(?:e\.g|i\.e|etc|vs|approx|No)\.$/;

/** A slot and an owner placeholder are one word each; Markdown marks and the brand suffix are none. */
export function normalise(text) {
  return text
    .replace(/\{[\w$.-]+\}/g, SLOT)
    .replace(/\[\[[^\]]*\]\]/g, SLOT)
    .replace(/\*\*/g, "")
    .replace(/\s*[·|]\s*ReachKit\s*$/u, "");
}

export function paragraphs(text) {
  return normalise(text)
    .split("\n")
    .map((line) => line.replace(/^\s*(?:#+|[-*]|\d+\.)\s+/, "").trim())
    .filter((line) => /[\p{L}\p{N}\u0001]/u.test(line));
}

/** A sentence ends at . ! ? … before a capital, digit, quote, bracket, euro or slot; never after an abbreviation. */
export function sentences(paragraph) {
  const out = [];
  for (const piece of paragraph.split(/(?<=[.!?…])\s+(?=[\p{Lu}\p{N}"“‘'(€\u0001])/u)) {
    if (out.length > 0 && ABBREVIATION.test(out[out.length - 1])) out[out.length - 1] += ` ${piece}`;
    else out.push(piece);
  }
  return out.filter((s) => /[\p{L}\p{N}\u0001]/u.test(s));
}

export function wordCount(text) {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}\u0001]/u.test(w)).length;
}

/**
 * What one string breaks: `sentence` over 15 words, `paragraph` over 2 sentences, `heading` over 6 words,
 * and each SOFT `word`. An aria string is a spoken list, so it skips the paragraph rule.
 */
/**
 * @param {string} text
 * @param {{ key?: string, heading?: boolean }} [options]
 * @returns {{ rule: "sentence" | "paragraph" | "heading" | "word", n?: number, word?: string }[]}
 */
export function violations(text, { key = "", heading = false } = {}) {
  const out = [];
  if (heading) {
    const n = wordCount(normalise(text));
    if (n > LIMITS.heading) out.push({ rule: "heading", n });
  } else {
    const aria = key.includes(".aria");
    for (const p of paragraphs(text)) {
      const ss = sentences(p);
      if (!aria && ss.length > LIMITS.paragraph) out.push({ rule: "paragraph", n: ss.length });
      for (const s of ss) {
        const n = wordCount(s);
        if (n > LIMITS.sentence) out.push({ rule: "sentence", n });
      }
    }
  }
  const words = text.replace(/\{[\w$.-]+\}/g, " ");
  for (const soft of SOFT) if (soft.pattern.test(words) && !soft.allow?.test(key)) out.push({ rule: "word", word: soft.name });
  return out;
}

/** The retired name a text uses, if any. A `{slot}` is a value, never read as a word. */
export function retiredIn(text) {
  const words = text.replace(/\{[\w$.-]+\}/g, " ");
  return RETIRED.find((retired) => retired.pattern.test(words))?.name;
}

/**
 * Violations per key file, exempt keys and files left out. `name` is relative to keys/.
 * @param {{ name: string, source: string }[]} files
 */
export function keyFileCounts(files) {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const { name, source } of files) {
    if (EXEMPT_FILES.test(name)) continue;
    const file = name.replace(/\.ts$/, "");
    counts[file] = 0;
    for (const { key, value } of entries(source)) if (!isExempt(key, name)) counts[file] += violations(value, { key }).length;
  }
  return counts;
}
