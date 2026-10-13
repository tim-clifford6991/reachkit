// scripts/eval-content/prose.ts — `npm run eval:content -- --prose` (SPEC §7,
// issue 1390): the prose check's counts on stored pages and on pages people
// wrote. No model, no vendor, nothing spent.
//
// Three sets, each scored by the product's own `proseScore`:
//
//   1. **Pages people wrote** — `prose/human-pages.json`, on the customer
//      panel's sites. Read live (a plain GET) and cached under `.review/prose`;
//      only the counts are committed.
//   2. **Stored pages** — what the product wrote before the check: the live
//      pages of reachkit.app as they stood on 2026-10-10 (`prose/live/`), the
//      seven pages of `docs/walk/pipeline-v2/` and the twelve stored drafts.
//   3. **Pages written since** — `docs/walk/prose-gate/`, where a run of
//      `--prose --write` keeps them (see `./prose-write.ts`).
//
// The thresholds in `PROSE` are read against set 1: a count a human page
// reaches is not a fault. The one committed output is
// `docs/walk/prose-gate.md`. A tool, not a gate.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parse, type HTMLElement } from "node-html-parser";
import { PROSE } from "@/lib/config/constants";
import { proseFaults, proseScore, proseText, tellCount, type ProseScore } from "@/lib/generate/rules/prose";
import { lintProse } from "@/lib/generate/rules/prose-lint";
import { withoutReferenceLists } from "@/lib/generate/rules/text";
import type { Language } from "@/lib/locale/locales";

export interface ProseOptions {
  root: string;
  tablePath: string;
  /** Read each human page again where it is not cached. */
  fetch: boolean;
}

interface Scored {
  /** A human page dated before 2023: written before a model could have. */
  dated?: boolean;
  set: "human" | "stored" | "new";
  name: string;
  language: Language;
  score: ProseScore;
  faults: string[];
}

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const DROPPED = "script, style, noscript, nav, header, footer, aside, form, svg, figure, iframe, button";

/** A page's HTML as the Markdown the check reads: its headings, paragraphs,
 *  list items and quotations, in order. */
export function htmlToMarkdown(html: string): string {
  const root = parse(html);
  for (const node of root.querySelectorAll(DROPPED)) node.remove();
  // The page's own text: the article or main element that holds the most of
  // it — a page lists other articles as cards — else the body.
  const held = (node: HTMLElement): number => node.querySelectorAll("p").reduce((sum, each) => sum + each.text.length, 0);
  const all = held(root);
  const inner = [...root.querySelectorAll("article"), ...root.querySelectorAll("main")].sort((a, b) => held(b) - held(a))[0];
  const scope = inner !== undefined && held(inner) * 2 >= all ? inner : (root.querySelector("body") ?? root);
  const out: string[] = [];
  const text = (node: HTMLElement): string => node.text.replace(/\s+/g, " ").trim();
  const walk = (node: HTMLElement, quoted: boolean): void => {
    for (const child of node.childNodes as HTMLElement[]) {
      const tag = child.rawTagName?.toLowerCase();
      if (tag === undefined) continue;
      const words = text(child);
      if (words === "") continue;
      if (/^h[1-6]$/.test(tag)) out.push(`## ${words}`);
      else if (tag === "p") out.push(quoted ? `> ${words}` : words);
      else if (tag === "blockquote") walk(child, true);
      else if (tag === "ul" || tag === "ol") {
        const items = child.querySelectorAll("li").map(text).filter(Boolean);
        out.push(items.map((item, index) => (tag === "ol" ? `${index + 1}. ${item}` : `- ${item}`)).join("\n"));
      } else if (tag === "table") continue;
      else walk(child, quoted);
    }
  };
  walk(scope, false);
  return out.join("\n\n");
}

async function humanPage(root: string, url: string, fetchIt: boolean): Promise<string | null> {
  const dir = path.join(root, ".review/prose/human");
  const file = path.join(dir, `${createHash("sha1").update(url).digest("hex").slice(0, 12)}.html`);
  if (existsSync(file)) return readFileSync(file, "utf8");
  if (!fetchIt) return null;
  try {
    const answer = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(20_000) });
    if (!answer.ok) return null;
    const html = await answer.text();
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, html);
    return html;
  } catch {
    return null;
  }
}

/** A stored page's Markdown without what is not its body: a walk file's
 *  title and byline lines, and the sources list code writes. */
function bodyOf(markdown: string): string {
  return withoutReferenceLists(markdown.replace(/^# .*$/m, "").replace(/^\*[^*\n]+\*$/m, ""));
}

/** One page as the battery reads it: the counts, and on an English page
 *  what `slopless` flags. */
async function scored(set: Scored["set"], name: string, markdown: string, language: Language = "en"): Promise<Scored> {
  const flagged = language === "en" ? await lintProse(proseText(markdown)) : [];
  const score = proseScore(markdown, { language, flagged });
  return { set, name, language, score, faults: proseFaults(score).map((fault) => fault.tell) };
}

const each = <T, U>(rows: readonly T[], fn: (row: T) => Promise<U>): Promise<U[]> => rows.reduce<Promise<U[]>>(async (done, row) => [...(await done), await fn(row)], Promise.resolve([]));

function markdownIn(dir: string): { name: string; markdown: string }[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.endsWith(".md") && file !== "README.md")
    .sort()
    .map((file) => ({ name: file.replace(/\.md$/, ""), markdown: bodyOf(readFileSync(path.join(dir, file), "utf8")) }));
}

const cell = (value: number | null): string => (value === null ? "–" : String(value));

function row(page: Scored): string {
  const s = page.score;
  const most = (rows: readonly { count: number }[]): number => rows[0]?.count ?? 0;
  return `| ${page.name} | ${s.words} | ${s.dashes} | ${s.dashesPerThousand} | ${cell(s.burstiness)} | ${most(s.repeatedSentences)} | ${most(s.repeatedPhrases)} | ${most(s.scaffolds)} | ${tellCount(s)} | ${page.faults.join(", ") || "passes"} |`;
}

const HEAD =
  "| page | words | dashes | per 1,000 | sentence spread | sentence said | phrase said | list label | tell phrases | check |\n" +
  "|---|---|---|---|---|---|---|---|---|---|";

function range(pages: readonly Scored[], pick: (score: ProseScore) => number | null): string {
  const values = pages.map((page) => pick(page.score)).filter((value): value is number => value !== null).sort((a, b) => a - b);
  if (values.length === 0) return "–";
  const at = (share: number): number => values[Math.min(values.length - 1, Math.floor(values.length * share))]!;
  return `${values[0]} · ${at(0.5)} · ${at(0.9)} · ${values[values.length - 1]}`;
}

export async function main(options: ProseOptions): Promise<number> {
  const list = JSON.parse(readFileSync(path.join(options.root, "scripts/eval-content/prose/human-pages.json"), "utf8")) as {
    pages: { site: string; year: number | null; url: string; language?: Language }[];
  };
  const human: Scored[] = [];
  const unread: string[] = [];
  for (const page of list.pages) {
    const html = await humanPage(options.root, page.url, options.fetch);
    const markdown = html === null ? "" : htmlToMarkdown(html);
    if (proseScore(markdown, { language: "en" }).words < 150) {
      unread.push(page.url);
      continue;
    }
    human.push({ dated: page.year !== null && page.year < 2023, ...await scored("human", `${page.site}${page.year === null ? "" : ` (${page.year})`} ${new URL(page.url).pathname.split("/").filter(Boolean).pop() ?? ""}`.slice(0, 70), markdown, page.language ?? "en") });
  }
  const stored: Scored[] = [
    ...(await each(markdownIn(path.join(options.root, "scripts/eval-content/prose/live")), (page) => scored("stored", `live: ${page.name}`, page.markdown))),
    ...(await each(markdownIn(path.join(options.root, "docs/walk/pipeline-v2")), (page) => scored("stored", `pipeline-v2: ${page.name}`, page.markdown))),
    ...(await each(markdownIn(path.join(options.root, "scripts/eval-content/stored-drafts/reachkit.app")), (page) => scored("stored", `stored draft ${page.name}`, page.markdown))),
  ];
  const fresh: Scored[] = await each(markdownIn(path.join(options.root, "docs/walk/prose-gate")), (page) =>
    scored("new", page.name, page.markdown, page.name.endsWith(".de") ? "de" : "en")
  );

  const failing = (pages: readonly Scored[]): string => `${pages.filter((page) => page.faults.length > 0).length} of ${pages.length}`;
  const spread = (pages: readonly Scored[]): string[] => [
    `| dashes per 1,000 words | ${range(pages, (s) => s.dashesPerThousand)} |`,
    `| sentence spread | ${range(pages, (s) => s.burstiness)} |`,
    `| most a sentence is said | ${range(pages, (s) => s.repeatedSentences[0]?.count ?? 0)} |`,
    `| most a run of words is said | ${range(pages, (s) => s.repeatedPhrases[0]?.count ?? 0)} |`,
    `| tell phrases | ${range(pages, tellCount)} |`,
  ];
  const lines = [
    "# The prose check, measured",
    "",
    "Rewritten by `npm run eval:content -- --prose` (SPEC §7, issue 1390). Every count is the product's own `proseScore`; the last column is `proseFaults` against `PROSE` in `src/lib/config/constants.ts`. Nothing is spent.",
    "",
    `The thresholds: more than ${PROSE.dashes.perThousand} joining dashes per 1,000 words (and ${PROSE.dashes.least} or more); a sentence said three times; a run of ${PROSE.repeatedPhrase.longWords} words said ${PROSE.repeatedPhrase.longTimes} times, or of ${PROSE.repeatedPhrase.shortWords} said ${PROSE.repeatedPhrase.shortTimes} times; a label ${PROSE.listScaffold.minItems} items of one list turn on; a sentence spread under ${PROSE.evenSentences.least} over ${PROSE.evenSentences.minSentences} sentences or more; one construction used ${PROSE.tellPhrases.samePattern} times, or ${PROSE.tellPhrases.most} tell phrases together.`,
    "",
    "**Measured and not made a threshold** (2026-10-10, the same pages). Groups of three: people's pages ran 1.8 to 15.2 per 1,000 words, the stored pages 0 to 12, so a count would stop people first. Wordy phrases (`retext-simplify`): people 0 to 33 per 1,000, stored pages 0 to 6; weak and hedging words (`retext-intensify`): 61 to 126 against 34 to 104; hard sentences (`retext-readability`): 0 to 29 against 0 to 6. The stored pages are already plainer than the pages people wrote, so no `retext` plugin was added. Of `slopless`, the orthography, readability and cliché rules flagged people's pages more than ours (1.8 to 25.9 findings per 1,000 words against 0 to 12.6, most of them quotation marks and heading case); the rules kept are the ones in `src/lib/generate/rules/prose-lint.ts`.",
    "",
    "## What the three sets come to",
    "",
    "| set | pages | stopped by the check |",
    "|---|---|---|",
    `| pages people wrote, dated before 2023 | ${human.filter((page) => page.dated).length} | ${failing(human.filter((page) => page.dated))} |`,
    `| pages people published, undated | ${human.filter((page) => !page.dated).length} | ${failing(human.filter((page) => !page.dated))} |`,
    `| stored pages, written before the check | ${stored.length} | ${failing(stored)} |`,
    `| pages written since | ${fresh.length} | ${failing(fresh)} |`,
    "",
    "Lowest · median · nine in ten · highest:",
    "",
    "| count | pages people wrote |",
    "|---|---|",
    ...spread(human),
    "",
    "| count | stored pages |",
    "|---|---|",
    ...spread(stored),
    ...(fresh.length === 0 ? [] : ["", "| count | pages written since |", "|---|---|", ...spread(fresh)]),
    "",
    "## Pages people wrote",
    "",
    HEAD,
    ...human.map(row),
    ...(unread.length === 0 ? [] : ["", `Not read (no cached copy, or under 150 words of prose): ${unread.join(", ")}.`]),
    "",
    "## Stored pages, written before the check",
    "",
    HEAD,
    ...stored.map(row),
    ...(fresh.length === 0 ? [] : ["", "## Pages written since", "", HEAD, ...fresh.map(row)]),
    "",
  ];
  writeFileSync(options.tablePath, lines.join("\n"));
  for (const page of [...human, ...stored, ...fresh]) console.log(`${page.set.padEnd(6)} ${page.faults.join(",").padEnd(40) || "".padEnd(40)} ${page.name}`);
  console.log(`\nhuman ${failing(human)} stopped · stored ${failing(stored)} · new ${failing(fresh)} → ${path.relative(options.root, options.tablePath)}`);
  if (process.env.PROSE_DUMP !== undefined) {
    mkdirSync(process.env.PROSE_DUMP, { recursive: true });
    for (const page of list.pages) {
      const html = await humanPage(options.root, page.url, false);
      if (html !== null) writeFileSync(path.join(process.env.PROSE_DUMP, `human-${createHash("sha1").update(page.url).digest("hex").slice(0, 8)}.md`), htmlToMarkdown(html));
    }
  }
  return 0;
}
