// tests/ui/design/strategy.test.ts — owner 2026-10-15, #1463; issue 1484; owner O6.
//
// The strategy half of a screen change. Layout and axe stay on the
// `no overflow · axe` gate. This file holds the rules that are sentences:
// a title is at most six words with no em-dash, a retired name does not come
// back, and the plain-words counts of scripts/lib/plain-words.mjs only fall.
// docs/DESIGN.md names this file. The trailing "· ReachKit" on a meta title is
// the brand, not a seventh word.
//
// A retired name is looked for wherever a customer reads one (issue 1484):
// the copy registry, the text written straight into JSX under `src/app`,
// `src/ui` and the mail shell, the sentences of the mail code, and the boards.
// A `{slot}` is a value, not a word, so it is never read as one.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { boardPlainWords, boardStrings, BOARDS_DIR, PARITY_DIR } from "../../../scripts/design/parity.mjs";
import { EXEMPT_BOARDS, entries, isExempt, keyFileCounts, retiredIn, SOFT, TITLE_KEY, violations } from "../../../scripts/lib/plain-words.mjs";
import { read, SRC_DIR, walkFiles } from "./vocabulary";

const KEYS = path.resolve(import.meta.dirname, "../../../src/lib/presentation/copy/keys");

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

function keyFiles(): { name: string; source: string }[] {
  return readdirSync(KEYS)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => ({ name, source: readFileSync(path.join(KEYS, name), "utf8") }));
}

function titleWords(sentence: string): { dash: boolean; words: string[] } {
  const core = sentence.replace(/\s*[·|]\s*ReachKit\s*$/u, "");
  return { dash: core.includes("—"), words: core.split(/\s+/).filter(Boolean) };
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
  const copy = keyFiles().flatMap(({ source }) => entries(source).map(({ key, value }) => ({ key, sentence: value })));

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

  it("knows the Terms' retired claims, and leaves their allowed forms alone", () => {
    expect([
      "A subscription adds a page every day for your site.",
      "24 hours by default, from none up to seven days",
      "Cancel any time from Settings, in one click: your access continues.",
      "Your access ends. Payments already made are not refunded unless the law requires it.",
    ].map(retiredIn)).toEqual(["a page every day for your site", "from none", "in one click:", "Payments already made are not refunded"]);
    expect([
      "Unsubscribe in one click.",
      "Otherwise your access continues, and payments already made are not refunded unless the law requires it.",
      "anywhere from 1 to 7 days",
    ].map(retiredIn)).toEqual([undefined, undefined, undefined]);
  });

  it("knows the retired pace and opt-out words", () => {
    expect(["Publishing daily", "One page a day is a good pace", "Pages go live when ready, at most one a day.", "Opted out", "Publishing on", "Up to 7 pages a week", "Unsubscribed", "A month of daily pages.", "About a month of pages, at up to 7 a week.", "Daily at 7:00 AM", "Pages go live at 7:00 AM"].map(retiredIn)).toEqual([
      "Publishing daily",
      "one page a day",
      "at most one a day",
      "Opted out",
      undefined,
      undefined,
      undefined,
      "daily pages",
      undefined,
      "daily at",
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

describe("UI strategy: plain words (O6, docs/spec/decisions/2026-10-31-2145.md)", () => {
  const budgets = JSON.parse(read("scripts/budgets.json")) as { plainWords: Record<string, number> };
  const baseline = JSON.parse(read("docs/design/parity/baseline.json")) as Record<string, { plainWords?: number }>;
  const rules = (text: string, options?: { key?: string; heading?: boolean }) => violations(text, options).map((v) => v.word ?? `${v.rule} ${v.n}`);

  it("counts a long sentence, a long paragraph, a long heading and each soft word", () => {
    expect(rules("One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen.")).toEqual(["sentence 16"]);
    expect(rules("One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen.")).toEqual([]);
    expect(rules("We read your site. We write a page. You stop it or it goes live.")).toEqual(["paragraph 3"]);
    expect(rules("We read your site.\nWe write a page. You stop it or it goes live.")).toEqual([]);
    expect(rules("Your pages this week, at a glance", { heading: true })).toEqual(["heading 7"]);
    expect(rules("This week, at a glance · ReachKit", { heading: true })).toEqual([]);
    const soft = ["Better SEO", "Google indexed it", "We crawl it", "Add a CNAME record", "The weekly pass", "We re-score it", "Supply is short", "Two spares", "Your draft", "An opportunity", "We fetched it"];
    expect(soft.map((text) => rules(text))).toEqual(SOFT.map((word) => [word.name]));
  });

  it("reads a slot, a placeholder, an abbreviation and an aria list the way the standard says", () => {
    expect(rules("In and around {place} we write one two three four five six seven eight nine ten.")).toEqual(["sentence 16"]);
    expect(rules("Ask [[owner: the name]], e.g. Acme. It is fine. Done.")).toEqual(["paragraph 3"]);
    expect(rules("{date}. {stage}. {title}", { key: "calendar.row.aria" })).toEqual([]);
    expect(rules("Add a CNAME record", { key: "setup.dns.record" })).toEqual([]);
    for (const key of ["setup.destination.guide.godaddy.2", "setup.connect.steps.3"]) expect(rules("Add a CNAME record", { key }), key).toEqual([]);
    expect(rules("Add a CNAME record", { key: "overview.anything" })).toEqual(["CNAME"]);
  });

  it("never counts an exempt key, file or board", () => {
    const long = `"k": ["${"word ".repeat(20)}"]`;
    const keys = ["hosted.a", "body.a", "fact.a", "ai-answers.engine.a", "legal.terms.body", "legal.withdraw.entry", "offer.checkout.consent", "offer.start.priced"];
    const source = keys.map((key) => long.replace('"k"', `"${key}"`)).join(",\n");
    expect(keys.every((key) => isExempt(key))).toBe(true);
    expect(keyFileCounts([{ name: "chrome.ts", source }, { name: "review.ts", source: long }, { name: "ops.ts", source: long }, { name: "de/page.ts", source: long }])).toEqual({ chrome: 0 });
    expect(keyFileCounts([{ name: "chrome.ts", source: long }])).toEqual({ chrome: 1 });
    expect(["HostedPage", "Review", "AppCosts", "Legal"].every((board) => EXEMPT_BOARDS.test(board))).toBe(true);
    expect(EXEMPT_BOARDS.test("PubReport")).toBe(false);
  });

  it("each key file's count is at most its budget, and every key file has exactly one budget", () => {
    const measured = keyFileCounts(keyFiles());
    expect(Object.keys(budgets.plainWords).sort()).toEqual(Object.keys(measured).sort());
    const over = Object.entries(measured).flatMap(([file, n]) => (n > (budgets.plainWords[file] ?? 0) ? [`${file}: ${n}, budget ${budgets.plainWords[file]}`] : []));
    expect(over).toEqual([]);
    for (const [file, n] of Object.entries(measured)) if (n < (budgets.plainWords[file] ?? 0)) console.info(`lower plainWords.${file} in scripts/budgets.json to ${n}`);
  });

  it("each board's count equals its baseline row, and an exempt board has none", () => {
    const boards = readdirSync(BOARDS_DIR).filter((f) => f.endsWith(".dc.html")).map((f) => f.slice(0, -".dc.html".length));
    const off = boards.flatMap((board) => {
      const want = EXEMPT_BOARDS.test(board) ? undefined : boardPlainWords(readFileSync(path.join(BOARDS_DIR, `${board}.dc.html`), "utf8"));
      return baseline[board]?.plainWords === want ? [] : [`${board}: ${want}, baseline ${baseline[board]?.plainWords} in ${path.relative(REPO_ROOT, PARITY_DIR)}/baseline.json`];
    });
    expect(off).toEqual([]);
  });

  it("a board does not use a retired name", () => {
    const boards = readdirSync(BOARDS_DIR).filter((f) => f.endsWith(".dc.html") && !EXEMPT_BOARDS.test(f.slice(0, -".dc.html".length)));
    const offenders = boards.flatMap((f) =>
      boardStrings(readFileSync(path.join(BOARDS_DIR, f), "utf8")).flatMap((text) => {
        const hit = retiredIn(text);
        return hit ? [`${f} uses "${hit}": ${text}`] : [];
      }),
    );
    expect(offenders).toEqual([]);
    expect(["Next Monday we measure again", "Pick a keyword", "Moz Keyword Gap"].map(retiredIn)).toEqual(["Measure again", "keyword", undefined]);
  });
});
