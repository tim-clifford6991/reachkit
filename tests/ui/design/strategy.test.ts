// tests/ui/design/strategy.test.ts — owner 2026-10-15, #1463; issue 1484.
//
// The strategy half of a screen change. Layout and axe stay on the
// `no overflow · axe` gate. This file holds the two rules that are sentences:
// a title is at most six words with no em-dash, and a retired name does not
// come back. docs/DESIGN.md names this file. The trailing "· ReachKit" on a
// meta title is the brand, not a seventh word.
//
// A retired name is looked for wherever a customer reads one (issue 1484):
// the copy registry, the text written straight into JSX under `src/app`,
// `src/ui` and the mail shell, and the sentences of the mail code. A `{slot}`
// is a value, not a word, so it is never read as one.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { read, SRC_DIR, walkFiles } from "./vocabulary";

const KEYS = path.resolve(import.meta.dirname, "../../../src/lib/presentation/copy/keys");
const ENTRY_RE = /"([\w$.-]+)"\s*:\s*\[\s*"((?:[^"\\]|\\.)*)"/g;
const TITLE_KEY = /\.(title|heading|subject)$/;

/** Each retired name, and the pattern that finds it. The last five are the
 *  2026-10-15 vocabulary (SPEC §0, #1444): Visibility Score, Readiness,
 *  Content and competitors replaced them. */
const RETIRED: readonly { name: string; pattern: RegExp }[] = [
  { name: "AI Visibility", pattern: /\bAI Visibility\b/i },
  { name: "Measure again", pattern: /\bMeasure again\b/i },
  { name: "re-measure", pattern: /\bre-measure/i },
  { name: "top ten", pattern: /\btop ten\b/i },
  { name: "top 20", pattern: /\btop 20\b/i },
  { name: "Discoverability Score", pattern: /\bDiscoverability Score\b/i },
  { name: "findability", pattern: /\bfindability\b/i },
  { name: "Foundations", pattern: /\bFoundations\b/i },
  { name: "Answerability", pattern: /\bAnswerability\b/i },
  { name: "rival(s)", pattern: /\brivals?\b/i },
  // A4 (Free scan), the 19 Oct ladder ruling (no Listed rung) and #1444: AI
  // mentions or links, never names, cites or quotes. Plain "named" and
  // "listed" stay legal outside the AI and ladder sense.
  { name: "Start free", pattern: /\bStart free\b/i },
  { name: "cited", pattern: /\bcited\b/i },
  { name: "Listed", pattern: /\bListed\b/ },
  { name: "Listed", pattern: /\blisted (in|on|by) (Google|Bing)\b/i },
  { name: "named by AI", pattern: /\bnamed (by|in) (AI|ChatGPT|Gemini|Perplexity|an AI|AI answers?)\b/i },
  { name: "named by AI", pattern: /\bNamed by\b/ },
  { name: "quoted by AI", pattern: /\bquoted (by|in) (AI|ChatGPT|Gemini|Perplexity|an AI|AI answers?)\b/i },
  { name: "quoted by AI", pattern: /\bQuoted by\b/ },
  // Q6: a stopped topic is dropped for good. "Write it again" on a held page stays.
  { name: "write this one again", pattern: /\b(write this one again|ask us to write)\b/i },
  // Up to 7 pages a week, and a week may skip a day: no daily pace and no daily ceiling.
  { name: "Publishing daily", pattern: /\bPublishing daily\b/i },
  { name: "one page a day", pattern: /\bone page a day\b/i },
  { name: "at most one a day", pattern: /\bat most one a day\b/i },
  // The mail and its page say "unsubscribe".
  { name: "Opted out", pattern: /\bOpted out\b/ },
  // D3: only week 1 is emailed first. B5: competitors are watched weekly, re-checked monthly. Cancelling runs through Settings.
  { name: "We email each page first", pattern: /\bWe email each page first\b/i },
  { name: "Emailed before it goes live", pattern: /\bEmailed before it goes live\b/i },
  { name: "after we email it", pattern: /\bafter we email it\b/i },
  { name: "Cancel in one click", pattern: /\bCancel in one click\b/i },
  { name: "competitors checked", pattern: /\bcompetitors\b[^.]{0,20}\bchecked\b/i },
];

/** The attributes whose value a customer reads or hears. */
const READ_ATTRIBUTES = new Set(["alt", "aria-label", "aria-description", "label", "placeholder", "title"]);

/** Where JSX is customer text: the screens, the shared UI, the mail. */
const JSX_ROOTS = ["src/app", "src/ui", "src/lib/mail"] as const;

/** The mail code whose string literals are sentences. Outside the copy
 *  registry a mail sentence is written here or nowhere. */
const MAIL_ROOT = "src/lib/mail";

interface Text {
  where: string;
  text: string;
}

function entries(): { key: string; sentence: string }[] {
  const out: { key: string; sentence: string }[] = [];
  for (const name of readdirSync(KEYS)) {
    if (!name.endsWith(".ts")) continue;
    const text = readFileSync(path.join(KEYS, name), "utf8");
    for (const match of text.matchAll(ENTRY_RE)) {
      const key = match[1];
      const raw = match[2];
      if (key === undefined || raw === undefined) continue;
      out.push({ key, sentence: JSON.parse(`"${raw}"`) });
    }
  }
  return out;
}

function titleWords(sentence: string): { dash: boolean; words: string[] } {
  const core = sentence.replace(/\s*[·|]\s*ReachKit\s*$/u, "");
  return { dash: core.includes("—"), words: core.split(/\s+/).filter(Boolean) };
}

function retiredIn(text: string): string | undefined {
  const words = text.replace(/\{[\w$.-]+\}/g, " ");
  return RETIRED.find((retired) => retired.pattern.test(words))?.name;
}

function parse(rel: string): ts.SourceFile {
  const kind = rel.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(rel, read(rel), ts.ScriptTarget.Latest, true, kind);
}

function lineOf(file: ts.SourceFile, node: ts.Node): string {
  return `${file.fileName}:${file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1}`;
}

/** A string literal's text, or a template's literal parts. */
function literalText(node: ts.Node): string | undefined {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) return [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join(" ");
  return undefined;
}

/** The text a JSX tree writes: its text nodes, the literals it renders as
 *  children, and the attributes a customer reads. */
function jsxTexts(rel: string): Text[] {
  const file = parse(rel);
  const out: Text[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node)) {
      const text = node.text.replace(/\s+/g, " ").trim();
      if (text !== "") out.push({ where: lineOf(file, node), text });
    } else if (ts.isJsxExpression(node) && node.expression !== undefined && !ts.isJsxAttribute(node.parent)) {
      const text = literalText(node.expression);
      if (text !== undefined) out.push({ where: lineOf(file, node), text });
    } else if (ts.isJsxAttribute(node) && READ_ATTRIBUTES.has(node.name.getText(file)) && node.initializer !== undefined) {
      const value = ts.isJsxExpression(node.initializer) ? node.initializer.expression : node.initializer;
      const text = value === undefined ? undefined : literalText(value);
      if (text !== undefined) out.push({ where: lineOf(file, node), text });
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return out;
}

/** The sentences mail code writes outside the registry: every literal with
 *  a space in it. A key, an address or an identifier has none. */
function mailSentences(rel: string): Text[] {
  const file = parse(rel);
  const out: Text[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    const text = literalText(node);
    if (text !== undefined && /\s/.test(text.trim())) out.push({ where: lineOf(file, node), text });
    ts.forEachChild(node, visit);
  };
  visit(file);
  return out;
}

const REPO_ROOT = path.resolve(SRC_DIR, "..");
const under = (root: string, keep: (rel: string) => boolean): string[] => walkFiles(path.join(REPO_ROOT, root), keep);

describe("UI strategy: titles and retired names (#1463)", () => {
  const copy = entries();

  it("reads the copy registry", () => {
    expect(copy.length).toBeGreaterThan(100);
  });

  it("a title, heading or subject is at most six words and has no em-dash", () => {
    const titles = copy.filter((entry) => TITLE_KEY.test(entry.key));
    expect(titles.length).toBeGreaterThan(50);
    const offenders = titles.flatMap((entry) => {
      const { dash, words } = titleWords(entry.sentence);
      return dash || words.length > 6 ? [`${entry.key} (${words.length}${dash ? ", em-dash" : ""}): ${entry.sentence}`] : [];
    });
    expect(offenders).toEqual([]);
  });

  it("knows the AI and ladder words, and leaves their plain sense alone", () => {
    expect(["Start free", "Your pages cited", "Listed", "listed on Google", "named by AI", "Named by", "quoted in ChatGPT", "Quoted by"].map(retiredIn)).toEqual([
      "Start free",
      "cited",
      "Listed",
      "Listed",
      "named by AI",
      "named by AI",
      "quoted by AI",
      "quoted by AI",
    ]);
    expect(["The company that operates it is named on the imprint", "They are listed below", "This quotes a named person"].map(retiredIn)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(["you can ask us to write this one again", "Read it, or write it again."].map(retiredIn)).toEqual(["write this one again", undefined]);
  });

  it("knows the retired pace and opt-out words", () => {
    expect(["Publishing daily", "One page a day is a good pace", "Pages go live when ready, at most one a day.", "Opted out", "Publishing on", "Up to 7 pages a week", "Unsubscribed"].map(retiredIn)).toEqual([
      "Publishing daily",
      "one page a day",
      "at most one a day",
      "Opted out",
      undefined,
      undefined,
      undefined,
    ]);
  });

  it("knows the week-1 mail, cancel and competitor promises, and leaves the true lines alone", () => {
    expect(
      [
        "We email each page first. You never have to do anything.",
        "Emailed before it goes live",
        "Each page goes live {hours} hours after we email it unless you stop it.",
        "Cancel in one click, yourself.",
        "competitors checked every Monday",
        "Up to {rivals} competitors are checked every week.",
        "Your competitors, up to {rivals}, checked every week.",
      ].map(retiredIn),
    ).toEqual([
      "We email each page first",
      "Emailed before it goes live",
      "after we email it",
      "Cancel in one click",
      "competitors checked",
      "competitors checked",
      "competitors checked",
    ]);
    expect(["Unsubscribe in one click.", "Your market and your pages checked every Monday", "competitors watched every Monday"].map(retiredIn)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
  });

  it("customer copy does not use a retired name", () => {
    const offenders = copy.flatMap((entry) => {
      const hit = retiredIn(entry.sentence);
      return hit ? [`${entry.key} uses "${hit}": ${entry.sentence}`] : [];
    });
    expect(offenders).toEqual([]);
  });

  it("text written into JSX does not use a retired name (issue 1484)", () => {
    const files = JSX_ROOTS.flatMap((root) => under(root, (rel) => rel.endsWith(".tsx")));
    expect(files.length).toBeGreaterThan(100);
    const offenders = files.flatMap(jsxTexts).flatMap(({ where, text }) => {
      const hit = retiredIn(text);
      return hit ? [`${where} uses "${hit}": ${text}`] : [];
    });
    expect(offenders).toEqual([]);
  });

  it("a sentence in the mail code does not use a retired name (issue 1484)", () => {
    const files = under(MAIL_ROOT, (rel) => /\.tsx?$/.test(rel));
    expect(files.some((rel) => rel.startsWith(`${MAIL_ROOT}/templates/`))).toBe(true);
    const offenders = files.flatMap(mailSentences).flatMap(({ where, text }) => {
      const hit = retiredIn(text);
      return hit ? [`${where} uses "${hit}": ${text}`] : [];
    });
    expect(offenders).toEqual([]);
  });
});
