// scripts/eval-content/round.ts — one round of the content A/B, graded from
// what is stored (#1158).
//
// A round is a committed file, `snapshot/ab-round-<n>.json`: the pages (each
// a Markdown file under `docs/walk/`), the pairs to judge and the answer each
// pair is expected to give, and the evidence the grader reads — the target's
// top results as deep as the writer read them, and whether each page a body
// cites answered. Reading a round from the file is what makes a grade
// repeatable: a change in a number is a change in the grader, not in the web.
//
//   npm run eval:content -- --ab --regrade            # from what is stored, 0¢
//   npm run eval:content -- --ab --regrade --fetch    # read the evidence again (free)
//   npm run eval:content -- --ab --regrade --run      # buys what is not stored, capped
//
// What the model answers is stored too (`ab-round-<n>.answers.json`), so a
// reading or a placement is bought once.
//
// **Calibration.** A grader is accepted only where it gives every pair its
// expected answer: the owner's blind picks, and the reference page over a
// planted bad control. `--run` writes the table, and whether it was accepted,
// into the round's report between the `REGRADE` markers.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ADDS } from "@/lib/config/constants";
import type { OpportunityType } from "@/lib/opportunities/types";
import { parseMarkdown } from "@/lib/publish/render/markdown";
import { addsVerdict, placeSentences, type PlacedSentence, type Where } from "./adds";
import { checklist, figuresIn, numbersIn, traceNumbers, units, type Checklist, type Trace } from "./grade";
import { CRITERIA, judgePair, tally, type Criterion, type PairVerdict, type Reading } from "./judge";
import * as B from "./prototype/arm-b";
import { readSnapshot, SNAPSHOT_DIR } from "./snapshot";
import { appendSpend } from "../spend-log.mjs";

export interface RoundPage {
  id: string;
  search: string;
  type: OpportunityType;
  title: string;
  body: string;
  faq: { question: string }[];
}

export interface Evidence {
  takenAt: string;
  /** The words of each top result that were read: the writer's depth. */
  readWords: number;
  /** By target search: its top results, as read. */
  reads: Record<string, { url: string; title: string; text: string }[]>;
  /** By address: every other page a body cites — whether it answered, and
   *  each figure it states with the words beside it, which is all the
   *  number trace asks of it. */
  sources: Record<string, { ok: boolean; note: string; title: string; figures: string }>;
}

export interface Pair {
  first: string;
  second: string;
  /** The page this pair must pick for the grader to be accepted. */
  expect: string | null;
  why: string;
}

interface RoundFile {
  round: number;
  domain: string;
  business: string;
  /** Where the pages are, and the report the table is written into. */
  dir: string;
  report: string;
  readWords: number;
  /** Each target search's top results, as the round's own run found them. */
  results: Record<string, string[]>;
  pages: { id: string; file: string; search: string; type: OpportunityType; title?: string }[];
  pairs: Pair[];
  evidence: Evidence | null;
}

/** What the model answered, kept beside the round
 *  (`ab-round-<n>.answers.json`) so a grade is made again without buying it
 *  again: a change to the code that counts is then free to see. */
export interface StoredAnswers {
  /** By pair, `first/second`: its readings. */
  readings: Record<string, Reading[]>;
  /** By page: where each sentence code could not place is stated. */
  placements: Record<string, Record<string, Where>>;
}

export interface CallRow {
  page: string;
  step: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  cents: number;
}

export interface PageGrade {
  page: RoundPage;
  list: Checklist;
  traces: Trace[];
  placed: PlacedSentence[];
  /** Sentences neither code nor the model placed. */
  unplaced: number;
}

export interface RoundGrade {
  pages: PageGrade[];
  pairs: { pair: Pair; verdict: PairVerdict | null }[];
  calls: CallRow[];
  /** `null` where the model half did not run. */
  accepted: boolean | null;
  evidence: Evidence;
  capCents: number;
}

const cents = (n: number): string => `${n.toFixed(2)}¢`;
const esc = (text: string): string => text.replace(/\|/g, "\\|").replace(/\n/g, " ");
const hostOf = B.hostOf;

/** A stored page file: its title, its body, and the buyer questions stored
 *  beside it. C keeps its buyer questions in the body, under one heading. */
export function readPageFile(text: string, title?: string): { title: string; body: string; faq: { question: string }[] } {
  const plain = text.replace(/^<!--[\s\S]*?-->\s*/, "");
  const heading = /^# (.+)\n/.exec(plain);
  const rest = heading === null ? plain : plain.slice(heading[0].length);
  const [body, stored] = rest.split(/\n---\n+\*Buyer questions, stored with the page/);
  const faq =
    stored !== undefined
      ? [...stored.matchAll(/^\*\*(.+)\*\*$/gm)].map((m) => ({ question: m[1]!.trim() }))
      : [...((body ?? "").split(/\n## Questions buyers ask\n/)[1] ?? "").split(/\n## /)[0]!.matchAll(/^### (.+)$/gm)].map((m) => ({ question: m[1]!.trim() }));
  return { title: title ?? heading?.[1]?.trim() ?? "", body: (body ?? "").trim(), faq };
}

/** What a top result claims, in its own words: its sentences that carry a
 *  figure, which is what a page would have to go beyond. */
export function resultClaims(reads: readonly { url: string; title: string; text: string }[], perResult = 14): string[] {
  return reads.flatMap((read) => {
    const sentences = read.text
      .split(/(?<=[.!?])\s+/)
      .map((each) => each.trim())
      .filter((each) => {
        const n = each.split(/\s+/).length;
        return n >= 8 && n <= 45 && numbersIn(each).length > 0;
      });
    return [`${hostOf(read.url)} — "${read.title}"`, ...[...new Set(sentences)].slice(0, perResult).map((each) => `${hostOf(read.url)}: ${each}`)];
  });
}

/** A page's figures, each with the two words either side of it. */
function figureText(text: string): string {
  const list = text.split(/\s+/);
  const keep = new Set<number>();
  list.forEach((token, i) => {
    if (/\d/.test(token)) for (let k = i - 2; k <= i + 2; k++) keep.add(k);
  });
  return list.filter((_, i) => keep.has(i)).join(" ");
}

/** Every page a body links: the pages it cites, and the business's own. */
function linksOf(body: string): string[] {
  return [...new Set(units(parseMarkdown(body)).flatMap((unit) => unit.links))].filter((href) => /^https?:/.test(href));
}

/** Read the round's top results and every page its bodies cite. Plain page
 *  reads: no vendor, no model, nothing spent. */
export async function fetchEvidence(file: RoundFile, pages: readonly RoundPage[], today: string): Promise<Evidence> {
  const reads: Evidence["reads"] = {};
  for (const [search, urls] of Object.entries(file.results)) {
    reads[search] = [];
    for (const url of urls) {
      const got = await B.readPage(url);
      console.log(`   ${search}: ${url} — ${typeof got === "string" ? got : "read"}`);
      if (typeof got !== "string") reads[search]!.push({ url, title: got.title, text: B.truncateWords(got.text, file.readWords) });
    }
  }
  const read = new Set(Object.values(reads).flatMap((list) => list.map((each) => each.url)));
  const sources: Evidence["sources"] = {};
  for (const href of [...new Set(pages.flatMap((page) => linksOf(page.body)))].filter((each) => !read.has(each))) {
    const got = await B.readPage(href, 1);
    console.log(`   source ${href} — ${typeof got === "string" ? got : "read"}`);
    sources[href] = typeof got === "string" ? { ok: false, note: got, title: "", figures: "" } : { ok: true, note: "read", title: got.title, figures: figureText(got.text) };
  }
  return { takenAt: today, readWords: file.readWords, reads, sources };
}

/**
 * Every page counted in code, and — with a `spend` — what each adds and
 * which page of each pair a blind judge picks. `capCents` is the most the
 * model half may spend; a call that could pass it is not made.
 */
export async function gradeRound(a: {
  domain: string;
  business: string;
  pages: readonly RoundPage[];
  pairs: readonly Pair[];
  evidence: Evidence;
  sitePages: readonly { url: string; text: string }[];
  founderFacts: readonly string[];
  /** What the judge is told the business says: its site's prose and its
   *  founder's answers. */
  businessFacts: readonly string[];
  today: string;
  /** Answers already bought; what this run buys is added to it. */
  stored: StoredAnswers;
  /** `null` buys nothing: the grade is made from code and `stored` alone. */
  capCents: number | null;
  /** `false` leaves what a page adds to code and to what is stored: the
   *  model places no sentence (#1164, whose cap buys the judge alone). */
  placeByModel?: boolean;
}): Promise<RoundGrade> {
  const calls: CallRow[] = [];
  const spent = () => calls.reduce((sum, row) => sum + row.cents, 0);
  const spendFor = (page: string, step: string) => ({
    guard(reserveCents: number) {
      if (spent() + reserveCents > a.capCents!) throw new Error(`${page} ${step}: ${cents(reserveCents)} more could pass the ${a.capCents}¢ cap (spent ${cents(spent())}); stopped.`);
    },
    record(call: { model: string; tokensIn: number; tokensOut: number; cents: number }) {
      calls.push({ page, step, ...call });
      appendSpend({ script: "eval-content", source: `${step}:${call.model}`, cents: call.cents });
      console.log(`   ${page} ${step}: ${cents(call.cents)} (${call.tokensIn} in, ${call.tokensOut} out)`);
    },
  });
  const readsOf = (search: string) => a.evidence.reads[search] ?? [];
  const linked = new Map<string, string | null>([
    ...Object.entries(a.evidence.sources).map(([href, each]) => [href, each.ok ? `${each.title} ${each.figures}` : null] as const),
    ...Object.values(a.evidence.reads).flatMap((list) => list.map((each) => [each.url, `${each.title} ${each.text}`] as const)),
  ]);
  const resolves = (href: string): boolean | null => (linked.has(href) ? linked.get(href) !== null : null);

  // The pairs first: they are what the grader is accepted on.
  const pairs: RoundGrade["pairs"] = [];
  for (const pair of a.pairs) {
    const of = (id: string) => {
      const page = a.pages.find((each) => each.id === id);
      if (page === undefined) throw new Error(`pair names ${id}, which is not a page of the round`);
      return { id, search: page.search, title: page.title, body: page.body, resultClaims: resultClaims(readsOf(page.search)) };
    };
    const key = `${pair.first}/${pair.second}`;
    const held = a.stored.readings[key] ?? [];
    if (a.capCents === null) {
      pairs.push({ pair, verdict: held.length === 0 ? null : tally([pair.first, pair.second], held) });
      continue;
    }
    console.log(`judge ${pair.first} / ${pair.second}`);
    const verdict = await judgePair(spendFor(key, "judge"), {
      today: a.today,
      business: a.business,
      domain: a.domain,
      businessFacts: a.businessFacts,
      first: of(pair.first),
      second: of(pair.second),
      held,
    });
    a.stored.readings[key] = verdict.readings;
    pairs.push({ pair, verdict });
  }

  const pages: PageGrade[] = [];
  for (const page of a.pages) {
    const reads = readsOf(page.search);
    const list = checklist({
      bodyMarkdown: page.body,
      type: page.type,
      query: page.search,
      domain: a.domain,
      businessName: a.business,
      factsUsed: [],
      faq: page.faq,
      pages: a.sitePages,
      evidence: { topResults: reads.map((each) => each.url), resolves },
    });
    const traces = traceNumbers({
      body: page.body,
      facts: [
        ...a.sitePages.map((each) => ({ text: each.text, source: each.url })),
        ...a.founderFacts.map((text) => ({ text, source: "founder" })),
        ...reads.map((each) => ({ text: `${each.title} ${each.text}`, source: each.url })),
      ],
      // A figure a page cited elsewhere on the page holds.
      pool: linksOf(page.body).flatMap((href) => {
        const text = linked.get(href);
        return text == null ? [] : [{ text, source: href }];
      }),
      linked,
    });
    const buys = a.capCents !== null && a.placeByModel !== false;
    if (buys) console.log(`adds ${page.id}`);
    const held = (a.stored.placements[page.id] ??= {});
    const { rows, unplaced } = await placeSentences(
      { markdown: page.body, search: page.search, domain: a.domain, business: a.business, topResults: reads, sitePages: a.sitePages, founderFacts: a.founderFacts, held },
      buys ? spendFor(page.id, "adds") : null
    );
    // A sentence the model placed that carries a figure nothing holds adds
    // nothing a reader can use, wherever the model placed it.
    const invented = new Set(traces.filter((each) => each.verdict === "invented").map((each) => each.number));
    const placed = rows.map((row) =>
      row.by === "model" && row.placed !== "no_claim" && figuresIn(row.sentence).some((figure) => invented.has(figure.n))
        ? { ...row, placed: "unsupported" as const, from: "a figure nothing holds" }
        : row
    );
    pages.push({ page, list, traces, placed, unplaced });
  }

  const expected = pairs.filter((each) => each.pair.expect !== null);
  return {
    pages,
    pairs,
    calls,
    accepted: expected.length === 0 || expected.some((each) => each.verdict === null) ? null : expected.every((each) => each.verdict?.pick === each.pair.expect),
    evidence: a.evidence,
    capCents: a.capCents ?? 0,
  };
}

const CRITERION_NAMES = Object.keys(CRITERIA) as Criterion[];
const pct = (share: number): string => `${Math.round(share * 100)}%`;

/** The graded round, as the Markdown its report carries. */
export function renderRound(grade: RoundGrade, a: { heading: string; today: string; intro?: string }): string[] {
  const L: string[] = [];
  const judged = grade.pairs.some((each) => each.verdict !== null);
  const placed = grade.pages.every((each) => each.unplaced === 0);
  const blocksCell = (list: Checklist) => {
    const required = Object.values(list.blocks).filter((value) => value !== null);
    return `${required.filter(Boolean).length}/${required.length}`;
  };
  L.push(`## ${a.heading}`);
  L.push("");
  L.push(
    a.intro ??
    `Written by \`npm run eval:content -- --ab --regrade${grade.calls.length > 0 ? " --run" : ""}\` on ${a.today} (#1158). The grader of #1132 scored each page alone, 0–3, and could not tell these pages apart. This one counts in code what can be counted, lists what a page adds code first, and has a blind judge on \`claude-sonnet-5\` choose between two pages, twice, with the order swapped. The top results were read again on ${grade.evidence.takenAt}, ${grade.evidence.readWords} words of each — the depth the writer read.`
  );
  L.push("");
  if (judged) {
    const expected = grade.pairs.filter((each) => each.pair.expect !== null);
    const agreed = expected.filter((each) => each.verdict?.pick === each.pair.expect).length;
    L.push(
      grade.accepted === null
        ? "**Calibration: not made.** Not every pair has been judged."
        : grade.accepted
        ? `**Calibration: accepted.** The judge gave ${expected.length === 1 ? "the one pair with an expected answer" : `all ${expected.length} pairs`} ${expected.length === 1 ? "that" : "their expected"} answer.`
        : `**Calibration: not accepted.** The judge gave ${agreed} of ${expected.length} pairs their expected answer. No number below is to be trusted until it gives all of them.`
    );
    L.push("");
    L.push("### The pairs");
    L.push("");
    L.push("A page wins a pair only where it wins both readings. *Won* is the share of the decisions — four criteria and the overall call, in two readings, ties left out — that went to each page.");
    L.push("");
    L.push(`| Pair | Expected | Judge's pick | Agrees | Won | ${CRITERION_NAMES.join(" | ")} |`);
    L.push(`|---|---|---|---|---|${CRITERION_NAMES.map(() => "---").join("|")}|`);
    for (const { pair, verdict } of grade.pairs) {
      const name = `${pair.first} / ${pair.second}`;
      if (verdict === null) {
        L.push(`| ${name} | ${pair.expect ?? "—"} | not judged | — | — | ${CRITERION_NAMES.map(() => "—").join(" | ")} |`);
        continue;
      }
      const won = verdict.pages.map((id) => `${id} ${pct(verdict.winRate[id] ?? 0)}`).join(", ");
      const cells = CRITERION_NAMES.map((criterion) => verdict.readings.map((reading) => reading.criteria[criterion].winner ?? "tie").join(", "));
      L.push(
        `| ${name} | ${pair.expect ?? "—"} (${esc(pair.why)}) | ${verdict.pick ?? `split: ${verdict.readings.map((reading) => reading.overall).join(", ")}`} | ${pair.expect === null ? "—" : verdict.pick === pair.expect ? "yes" : "**no**"} | ${won} | ${cells.join(" | ")} |`
      );
    }
    L.push("");
  }
  L.push("### Counted in code");
  L.push("");
  L.push("*Numbers* traces every figure, years and dates aside, to the site, a founder's answer, a top result or the page cited beside it; *cited elsewhere* is held only by a page the body cites somewhere else; *unread* is a cited page that did not answer. The Sources list is not read for numbers: a cited page's title is not the page stating one. *Sources* is the Sources list: pages named, pages that answered, pages that are not one of the target's top results.");
  L.push("");
  L.push("| Page | Words / target | Floor met | Blocks | Answer box | Fact labels | Repeated sentences | Empty cells | Site navigation or demo text | Sources named / answer / beyond the top results | Numbers traced / cited elsewhere / unread / invented |");
  L.push("|---|---|---|---|---|---|---|---|---|---|---|");
  for (const { page, list, traces } of grade.pages) {
    const count = (verdict: Trace["verdict"]) => traces.filter((each) => each.verdict === verdict).length;
    L.push(
      `| ${page.id} | ${list.target === null ? list.words : `${list.words} / ${list.target.floor}–${list.target.ceiling}`} | ${list.target === null ? "—" : list.words >= list.target.floor ? "yes" : "no"} | ${blocksCell(list)} | ${list.answerWords === 0 ? "none" : `${list.answerWords} words`} | ${list.factLabels} | ${list.duplicateSentences.length} | ${list.emptyCells} | ${list.sitePhrases.length === 0 ? "none" : `${list.sitePhrases.length} runs`} | ${list.sources.listed} / ${list.sources.resolved ?? "—"} / ${list.sources.beyondTop ?? "—"} | ${count("traced")} / ${count("pool")} / ${count("unread")} / **${count("invented")}** |`
    );
  }
  L.push("");
  L.push("### Required blocks, per page");
  L.push("");
  L.push(`| Block | ${grade.pages.map((each) => each.page.id).join(" | ")} |`);
  L.push(`|---|${grade.pages.map(() => "---").join("|")}|`);
  for (const name of Object.keys(grade.pages[0]?.list.blocks ?? {})) {
    L.push(`| ${name} | ${grade.pages.map((each) => (each.list.blocks[name] === null ? "n/a" : each.list.blocks[name] ? "yes" : "no")).join(" | ")} |`);
  }
  L.push("");
  L.push("### What each page adds");
  L.push("");
  L.push(
    `Each sentence is placed by code first: *commodity* cites a top result or shares its words, *on the site* shares a site page's words, and a *new business fact* shares a founder's answer or cites the business's own report. ${placed ? "The small tier placed only the sentences code could not, reading the same top results and the site's pages whole; it never says what is a business fact." : "Not every sentence code could not place has been placed by the model yet, so no page is held to the bar."} *Unsupported* is a claim about the business that neither its site nor its founder states, or a sentence carrying a figure nothing holds. The bar is ${ADDS.min} new, at least ${ADDS.businessMin} a business fact.`
  );
  L.push("");
  L.push("| Page | Commodity | On the site | New business facts | New, other | Unsupported | No claim | Not placed | Bar |");
  L.push("|---|---|---|---|---|---|---|---|---|");
  for (const { page, placed: rows, unplaced } of grade.pages) {
    const count = (kind: PlacedSentence["placed"]) => rows.filter((each) => each.placed === kind).length;
    L.push(
      `| ${page.id} | ${count("commodity")} | ${count("site")} | ${count("business")} | ${count("new")} | ${count("unsupported")} | ${count("no_claim")} | ${unplaced} | ${unplaced === 0 ? (addsVerdict(rows).passes ? "pass" : "short") : "—"} |`
    );
  }
  L.push("");
  for (const { page, placed: rows } of grade.pages) {
    const listed = rows.filter((each) => each.placed === "business" || each.placed === "new" || each.placed === "unsupported");
    L.push(`**${page.id}**`);
    for (const each of listed) L.push(`- ${each.placed === "business" ? `new business fact (${each.from})` : each.placed === "new" ? "new" : "unsupported"}: ${esc(each.sentence)}`);
    if (listed.length === 0) L.push("- nothing");
    L.push("");
  }
  const loose = grade.pages.flatMap(({ page, traces }) => traces.filter((each) => each.verdict === "unread" || each.verdict === "invented").map((each) => ({ id: page.id, ...each })));
  L.push("### Numbers nothing holds");
  L.push("");
  if (loose.length === 0) L.push("None.");
  else {
    L.push("| Page | Number | In | Verdict |");
    L.push("|---|---|---|---|");
    for (const each of loose) L.push(`| ${each.id} | ${each.number} | ${esc(each.said)} | ${each.verdict}${each.from === "" ? "" : `: ${esc(each.from)}`} |`);
  }
  L.push("");
  if (judged) {
    L.push("### What the judge said");
    L.push("");
    for (const { verdict } of grade.pairs) {
      for (const reading of verdict?.readings ?? []) {
        L.push(`**${reading.order[0]} shown as X, ${reading.order[1]} as Y** — ${reading.overall}: ${esc(reading.why)}`);
        for (const criterion of CRITERION_NAMES) L.push(`- ${criterion}: ${reading.criteria[criterion].winner ?? "tie"} — ${esc(reading.criteria[criterion].why)}`);
        L.push("");
      }
    }
  }
  if (grade.calls.length > 0) {
    L.push("### Every call");
    L.push("");
    L.push("| For | Step | Model | Tokens in | Tokens out | Cost |");
    L.push("|---|---|---|---|---|---|");
    for (const row of grade.calls) L.push(`| ${row.page} | ${row.step} | ${row.model} | ${row.tokensIn} | ${row.tokensOut} | ${cents(row.cents)} |`);
    L.push("");
    L.push(`Spent ${cents(grade.calls.reduce((sum, row) => sum + row.cents, 0))} of a ${grade.capCents}¢ cap.`);
    L.push("");
  }
  return L;
}

// ── Entry ──────────────────────────────────────────────────────────────

export interface Options {
  run: boolean;
  fetch: boolean;
  root: string;
  round: number;
  capCents: number;
}

const START = "<!-- REGRADE:START -->";
const END = "<!-- REGRADE:END -->";

export async function main(opts: Options): Promise<number> {
  const filePath = path.join(SNAPSHOT_DIR, `ab-round-${opts.round}.json`);
  const file = JSON.parse(readFileSync(filePath, "utf8")) as RoundFile;
  const today = new Date().toISOString().slice(0, 10);
  const pages: RoundPage[] = file.pages.map((each) => ({
    id: each.id,
    search: each.search,
    type: each.type,
    ...readPageFile(readFileSync(path.join(opts.root, file.dir, each.file), "utf8"), each.title),
  }));
  console.log(`# Round ${file.round} on ${file.domain}, graded from what is stored (#1158)\n`);

  if (opts.fetch) {
    file.evidence = await fetchEvidence(file, pages, today);
    writeFileSync(filePath, `${JSON.stringify(file, null, 1)}\n`);
    console.log(`\nEvidence stored: ${filePath}`);
    return 0;
  }
  if (file.evidence === null) throw new Error("the round has no evidence yet; run with --fetch first.");

  const answersPath = path.join(SNAPSHOT_DIR, `ab-round-${opts.round}.answers.json`);
  const stored: StoredAnswers = existsSync(answersPath) ? (JSON.parse(readFileSync(answersPath, "utf8")) as StoredAnswers) : { readings: {}, placements: {} };
  const snapshot = readSnapshot(file.domain);
  const readme = readFileSync(path.join(opts.root, "README.md"), "utf8");
  const grade = await gradeRound({
    domain: file.domain,
    business: file.business,
    pages,
    pairs: file.pairs,
    evidence: file.evidence,
    sitePages: snapshot.pages,
    founderFacts: B.founderAnswers(readme),
    businessFacts: B.knowledgeBase(snapshot, readme, today).map((fact) => fact.text),
    today,
    stored,
    capCents: opts.run ? opts.capCents : null,
  });
  const lines = renderRound(grade, { heading: `Round ${file.round}, graded again`, today });
  if (!opts.run) {
    console.log(lines.join("\n"));
    console.log("\nDry run — no model was called and the report was not written. Pass --run to buy what is not stored yet.");
    return 0;
  }
  writeFileSync(answersPath, `${JSON.stringify(stored, null, 1)}\n`);
  const reportPath = path.join(opts.root, file.report);
  const report = readFileSync(reportPath, "utf8");
  const [before, rest] = report.split(START);
  const after = rest?.split(END)[1];
  if (rest === undefined || after === undefined) throw new Error(`${file.report} has no ${START} … ${END} block to write into.`);
  writeFileSync(reportPath, `${before}${START}\n\n${lines.join("\n").trimEnd()}\n\n${END}${after}`);
  console.log(`\n${grade.accepted ? "Accepted" : "NOT accepted"}: ${grade.pairs.map((each) => `${each.pair.first}/${each.pair.second} → ${each.verdict?.pick ?? "split"}`).join("; ")}`);
  console.log(`Report: ${reportPath}`);
  return grade.accepted ? 0 : 2;
}
