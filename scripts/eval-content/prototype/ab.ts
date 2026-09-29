// scripts/eval-content/prototype/ab.ts — #1153: today's pipeline (A) beside
// the prototype of the 2026-09-29 rulings (B) and the hand-written reference
// (C), on reachkit.app, graded on the #1132 harness.
//
// Pages: A1 and B1 are the same topic, the one A's ranking writes first. A2
// and A3 are the next two of today's ranking; B2 and B3 are B's top two by
// business fit, less A1's topic and any search whose stored top ten shares
// four or more addresses with a topic already taken (SPEC §6 *One URL per
// question*). C is `docs/walk/ab-reachkit/C-reference.md`, graded as it is.
//
// Every page gets the #1132 grader unchanged (`checklist`, `modelGrade`),
// the non-commodity listing, and every number traced to the fact it came
// from. A and B spend through the same ledger arithmetic as #1132; the whole
// run is held to #1153's 300¢ before each call. Nothing is published and
// nothing reaches a database: the output is Markdown under `docs/walk/`.
import { randomInt } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { CAPS } from "@/lib/config/constants";
import { costCentsFor, tierBinding } from "@/lib/llm/tiers";
import { comparePrecedence } from "@/lib/opportunities/cluster";
import type { Candidate as WriteCandidate } from "@/lib/opportunities/derive/candidate";
import { writeCandidates } from "@/lib/opportunities/derive/write";
import type { FreePagePick } from "@/lib/opportunities/free-page";
import { rankScore } from "@/lib/opportunities/rank/score";
import type { OpportunityType, Winnability } from "@/lib/opportunities/types";
import { demandBand } from "@/lib/opportunities/winnability/band";
import { rankedCountsFromSizes } from "@/lib/opportunities/winnability/counts";
import { headingsUnderTitle, parseMarkdown, type Block } from "@/lib/publish/render/markdown";
import { readStoredReport, type StoredReport } from "@/lib/scan/report";
import { proofLedger, type ProofLedger } from "../../live-drafts/cost";
import { evaluate } from "../eval";
import { blockLinks, blockText, checklist, modelGrade, targetOf, type Checklist, type ModelGrade } from "../grade";
import { EVAL_SET } from "../set";
import { readSnapshot } from "../snapshot";
import * as B from "./arm-b";

export interface Options {
  run: boolean;
  root: string;
  /** What earlier attempts at this run already spent; it counts against the
   *  same 300¢. */
  priorCents: number;
}

const DOMAIN = "reachkit.app";
const BUSINESS = "ReachKit";
const RUN_CAP_CENTS = 300;
const C_SEARCH = "why does chatgpt recommend my competitors";
const C_TYPE: OpportunityType = "keyword_page";
const SAME_TOPIC_OVERLAP = 4;

const cents = (n: number): string => `${n.toFixed(2)}¢`;
const esc = (text: string): string => text.replace(/\|/g, "\\|").replace(/\n/g, " ");

// ── A's ranking, every entry ───────────────────────────────────────────

/** `bestFreePage`'s order, kept whole: the product's pick is the first
 *  entry, and #1153's A2 and A3 are the next two distinct searches. */
function rankedPicks(report: StoredReport): FreePagePick[] {
  if (report.questions.kind === "unmeasured" || report.market.kind === "unmeasured") return [];
  const profile = report.market.value.profile;
  const ownRanked = report.ownRanked.kind === "unmeasured" ? 0 : report.ownRanked.value;
  const sized = report.rivalSizes.kind !== "unmeasured";
  const rankedCounts = rankedCountsFromSizes(sized && report.rivalSizes.kind === "measured" ? report.rivalSizes.value : [], report.verdict.measuredAt);
  const { candidates } = writeCandidates({ siteId: "", scanId: report.scanId, report: { ...report, freePage: null }, ownRanked, rankedCounts });
  const order: Record<Winnability, number> = { winnable: 0, reach: 1, "not-yet": 2 };
  const band = (c: WriteCandidate): Winnability => {
    if (sized) return c.fitBand ?? "not-yet";
    const volume = c.volume === null || c.volume.kind === "unmeasured" ? 0 : c.volume.value;
    return demandBand({ volume, ownRanked });
  };
  const ranked = candidates
    .map((candidate) => ({
      candidate,
      band: band(candidate),
      score: rankScore({ volume: candidate.volume, query: candidate.targetQuery ?? "", type: candidate.type, fit: band(candidate), profile }),
    }))
    .filter((e) => e.band !== "not-yet")
    .sort((x, y) => comparePrecedence(x.candidate, y.candidate) || order[x.band] - order[y.band] || y.score - x.score);
  const questions = report.questions.value;
  const picks: FreePagePick[] = [];
  for (const entry of ranked) {
    const question = questions.find((q) => q.search.keyword === entry.candidate.targetQuery);
    if (question === undefined || picks.some((p) => p.candidate.targetQuery === entry.candidate.targetQuery)) continue;
    picks.push({ candidate: entry.candidate, question, total: ranked.length });
  }
  return picks;
}

// ── Money ──────────────────────────────────────────────────────────────

interface Tracker extends B.Spend {
  rows: B.CallRow[];
  total(): number;
  of(page: string): number;
}

function tracker(ledger: ProofLedger, priorCents: number): Tracker {
  const rows: B.CallRow[] = [];
  const own = () => priorCents + rows.reduce((sum, r) => sum + r.cents, 0);
  return {
    rows,
    total: () => ledger.spentCents() + own(),
    of: (page) => rows.filter((r) => r.page === page).reduce((sum, r) => sum + r.cents, 0),
    guard(page, step, reserveCents) {
      const total = ledger.spentCents() + own();
      if (total + reserveCents > RUN_CAP_CENTS) {
        throw new Error(`${page} ${step}: ${cents(reserveCents)} more could carry the run past ${RUN_CAP_CENTS}¢ (spent ${cents(total)}); stopped.`);
      }
    },
    record(row) {
      rows.push(row);
      console.log(`   ${row.page} ${row.step}: ${cents(row.cents)} (${row.tokensIn} in, ${row.tokensOut} out${row.searches > 0 ? `, ${row.searches} search` : ""})`);
    },
  };
}

// ── Numbers ────────────────────────────────────────────────────────────

const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec";
const DATES = new RegExp(`\\b\\d{4}-\\d{2}-\\d{2}\\b|\\b\\d{1,2}(?:st|nd|rd|th)? (?:${MONTHS})\\b|\\b(?:${MONTHS}) \\d{1,2}(?:st|nd|rd|th)?\\b`, "g");

/** The numbers a text states — not years, not the day of a date. */
export function numbersIn(text: string): string[] {
  const plain = text.replace(DATES, " ");
  return [...plain.matchAll(/(?<![A-Za-z\d.,])\d[\d,]*(?:\.\d+)?/g)]
    .map((m) => m[0].replace(/,+$/, "").replace(/,/g, ""))
    .filter((n) => n !== "" && !/^(19|20)\d{2}$/.test(n));
}

function holds(text: string, n: string): boolean {
  const flat = text.replace(/(\d),(?=\d{3})/g, "$1");
  return new RegExp(`(?<![\\d.])${n.replace(".", "\\.")}(?![\\d]|\\.\\d)`).test(flat);
}

interface Unit {
  text: string;
  links: string[];
}

/** A paragraph, a list item, a table row: the span a figure and its source
 *  sit in together. */
function units(blocks: readonly Block[]): Unit[] {
  return blocks.flatMap((block): Unit[] => {
    switch (block.kind) {
      case "list":
        return block.items.map((item) => ({ text: blockText({ kind: "paragraph", children: item }), links: blockLinks({ kind: "paragraph", children: item }) }));
      case "table":
        return block.rows.map((row) => {
          const asBlock = { kind: "paragraph" as const, children: row.flat() };
          return { text: blockText(asBlock), links: blockLinks(asBlock) };
        });
      case "answer":
        return units(block.children);
      default:
        return [{ text: blockText(block), links: blockLinks(block) }];
    }
  });
}

export interface Trace {
  number: string;
  said: string;
  /** `traced`: a fact the page stood on holds it. `pool`: only the arm's
   *  wider pool holds it (the site's text, or facts it did not list).
   *  `unread`: its cited source could not be read. `invented`: nothing does. */
  verdict: "traced" | "pool" | "unread" | "invented";
  from: string;
}

function traceNumbers(a: {
  body: string;
  facts: readonly { text: string; source: string }[];
  pool: readonly { text: string; source: string }[];
  /** C's facts are the pages it links beside each figure. */
  linked?: ReadonlyMap<string, string | null>;
}): Trace[] {
  const out: Trace[] = [];
  for (const unit of units(headingsUnderTitle(parseMarkdown(a.body)))) {
    for (const n of numbersIn(unit.text)) {
      const said = unit.text.length > 140 ? `${unit.text.slice(0, 137)}…` : unit.text;
      const beside = a.linked === undefined ? [] : unit.links.map((href) => ({ href, text: a.linked!.get(href) ?? null }));
      const fromLink = beside.find((l) => l.text !== null && holds(l.text, n));
      const fact = a.facts.find((f) => holds(f.text, n));
      if (fromLink !== undefined) out.push({ number: n, said, verdict: "traced", from: fromLink.href });
      else if (fact !== undefined) out.push({ number: n, said, verdict: "traced", from: fact.source });
      else {
        const inPool = a.pool.find((f) => holds(f.text, n));
        if (inPool !== undefined) out.push({ number: n, said, verdict: "pool", from: inPool.source });
        else if (beside.some((l) => l.text === null)) out.push({ number: n, said, verdict: "unread", from: beside.map((l) => l.href).join(" ") });
        else out.push({ number: n, said, verdict: "invented", from: "" });
      }
    }
  }
  return out;
}

// ── The non-commodity listing ──────────────────────────────────────────

interface NewClaim {
  claim: string;
  kind: "business" | "market" | "advice";
}

const NEW_TOOL: Anthropic.Tool = {
  name: "claims",
  description: "Record the page's claims that neither the top results nor the site state.",
  input_schema: {
    type: "object",
    properties: {
      claims: {
        type: "array",
        items: {
          type: "object",
          properties: {
            claim: { type: "string", description: "The claim, in a short sentence." },
            kind: { type: "string", enum: ["business", "market", "advice"], description: "business: about the business itself; market: a fact about the market; advice: a specific recommendation." },
          },
          required: ["claim", "kind"],
        },
      },
    },
    required: ["claims"],
  },
};

const NEW_READ_WORDS = 2500;

async function nonCommodity(spend: Tracker, page: string, a: { search: string; reads: B.Read[]; site: string; body: string }): Promise<NewClaim[]> {
  const binding = tierBinding("haiku");
  const prompt = [
    `A page was written for the search "${a.search}". Below are (1) the text of the search's top results, (2) the business's own site, and (3) the page.`,
    "List every claim on the page — a fact, a figure, a named finding, or a specific recommendation — that neither (1) nor (2) states or plainly implies. Leave out generic advice any of the results already gives, and leave out the page's own headings. An empty list is a fine answer.",
    "",
    "=== (1) THE TOP RESULTS",
    ...a.reads.flatMap((read, i) => [`--- Result ${i + 1}: ${read.url}`, B.truncateWords(read.text, NEW_READ_WORDS)]),
    "",
    "=== (2) THE BUSINESS'S SITE",
    a.site,
    "",
    "=== (3) THE PAGE",
    a.body,
  ].join("\n");
  const maxTokens = 3000;
  spend.guard(page, "non-commodity", costCentsFor("haiku", Math.ceil(prompt.length / 3), maxTokens));
  const message = await new Anthropic({ apiKey: binding.apiKey, timeout: 120_000, maxRetries: 2 }).messages.create({
    model: binding.modelId,
    max_tokens: maxTokens,
    tools: [NEW_TOOL],
    tool_choice: { type: "tool", name: NEW_TOOL.name },
    messages: [{ role: "user", content: prompt }],
  });
  spend.record({
    page,
    step: "grade: non-commodity",
    model: binding.modelId,
    tokensIn: message.usage.input_tokens,
    tokensOut: message.usage.output_tokens,
    searches: 0,
    cents: costCentsFor("haiku", message.usage.input_tokens, message.usage.output_tokens),
  });
  const use = message.content.find((block) => block.type === "tool_use");
  const claims = B.arrayOf(use?.type === "tool_use" ? (use.input as { claims?: unknown }).claims : null);
  return claims.map((c) => ({ claim: String(c.claim ?? ""), kind: c.kind === "business" || c.kind === "market" ? c.kind : "advice" }));
}

// ── Pages ──────────────────────────────────────────────────────────────

interface Page {
  id: string;
  arm: "A" | "B" | "C";
  search: string;
  type: OpportunityType;
  why: string;
  outcome: string;
  title: string | null;
  body: string | null;
  faq: unknown;
  /** The facts the page stood on, and the wider pool its arm had. */
  facts: { text: string; source: string }[];
  pool: { text: string; source: string }[];
  linked?: Map<string, string | null>;
  research: B.Research | null;
  genCents: number;
  gradeCents: number;
  list: Checklist | null;
  grade: ModelGrade | null;
  traces: Trace[];
  fresh: NewClaim[];
  /** B only: the draft before the critic, and what the critic said. */
  draft?: { title: string; body: string; faq: unknown; list: Checklist; grade: ModelGrade | null; traces: Trace[] };
  critique?: B.Critique;
  claimed?: string[];
  dropped?: { quote: string; why: string }[];
}

function faqCount(faq: unknown): number {
  return Array.isArray(faq) ? faq.length : 0;
}

function render(title: string, body: string, faq: unknown): string {
  const questions = Array.isArray(faq) ? (faq as Record<string, unknown>[]) : [];
  const stored = questions.length === 0
    ? []
    : [
        "",
        "---",
        "",
        "*Buyer questions, stored with the page (`drafts.meta.faq`):*",
        "",
        ...questions.flatMap((q) => [`**${String(q.question ?? q.q ?? "")}**`, "", String(q.answer ?? q.a ?? ""), ""]),
      ];
  return [`# ${title}`, "", body.trim(), ...stored].join("\n").trimEnd() + "\n";
}

/** C carries its buyer questions in the body, under one heading; they stand
 *  in for `meta.faq`, which a hand-written page does not have. */
function faqOfC(body: string): { question: string }[] {
  const at = body.indexOf("## Questions buyers ask");
  if (at === -1) return [];
  const section = body.slice(at).split(/\n## /)[0] ?? "";
  return [...section.matchAll(/^### (.+)$/gm)].map((m) => ({ question: m[1]!.trim() }));
}

function lengthOf(kind: B.PageKind): { floor: number; ceiling: number } {
  return kind === "comparison" ? { floor: 1500, ceiling: 2500 } : kind === "problem_howto" ? { floor: 1200, ceiling: 2000 } : { floor: 1200, ceiling: 1800 };
}

const typeOf = (kind: B.PageKind): OpportunityType =>
  kind === "comparison" ? "comparison_page" : kind === "problem_howto" ? "keyword_page" : "answer_page";

function storedTopTen(report: StoredReport, search: string): { url: string; title: string }[] | null {
  if (report.questions.kind === "unmeasured") return null;
  const at = report.questions.value.findIndex((q) => q.search.keyword === search);
  const serp = at === -1 ? undefined : report.serps[at];
  return serp === undefined || serp.kind === "unmeasured" ? null : serp.value.organic.map((r) => ({ url: r.url, title: r.title }));
}

function blocksMissing(list: Checklist): string[] {
  return Object.entries(list.blocks)
    .filter(([, v]) => v === false)
    .map(([k]) => k);
}

// ── Entry ──────────────────────────────────────────────────────────────

export async function main(opts: Options): Promise<number> {
  const outDir = path.join(opts.root, "docs/walk/ab-reachkit");
  const reportPath = path.join(opts.root, "docs/walk/content-ab-reachkit.md");
  const reviewDir = path.join(opts.root, ".review/ab-reachkit");
  const snapshot = readSnapshot(DOMAIN);
  const report = readStoredReport(snapshot.report);
  if (report.market.kind === "unmeasured" || report.questions.kind === "unmeasured") throw new Error("the reachkit.app snapshot has no market or questions");
  const market = report.market.value.profile;
  const picks = rankedPicks(report).slice(0, 3);
  const today = new Date().toISOString().slice(0, 10);
  const readme = readFileSync(path.join(opts.root, "README.md"), "utf8");
  const kb = B.knowledgeBase(snapshot, readme, today);
  const siteText = kb.filter((f) => f.source !== "founder").map((f) => f.text).join(" ");

  console.log("# A/B on reachkit.app (#1153)\n");
  console.log(`A's topics     ${picks.map((p) => `${p.candidate.targetQuery} (${p.candidate.type})`).join("; ")}`);
  console.log(`knowledge base ${kb.length} facts (${kb.filter((f) => f.source === "founder").length} from the founder)`);
  console.log(`run cap        ${RUN_CAP_CENTS}¢; per page CAPS.DRAFT_C = ${cents(CAPS.DRAFT_C)} (measured for B, not enforced)`);
  if (!opts.run) {
    for (const f of kb) console.log(`  [${f.id}] ${f.text.slice(0, 110)} — ${f.source}`);
    console.log("\nDry run — no model was called. Pass --run to spend.");
    return 0;
  }

  const ledger = proofLedger(RUN_CAP_CENTS - opts.priorCents);
  const spend = tracker(ledger, opts.priorCents);
  const slot = EVAL_SET.find((s) => s.domain === DOMAIN)!;
  const slotIndex = EVAL_SET.indexOf(slot);
  const pages: Page[] = [];
  /** Which page each of the ledger's rows was spent for. */
  const owners: string[] = [];
  const own = (id: string) => {
    while (owners.length < ledger.rows.length) owners.push(id);
  };
  const researched = new Map<string, B.Research>();
  const researchOf = async (search: string, page: string): Promise<B.Research> => {
    const held = researched.get(search);
    if (held !== undefined) return held;
    const found = await B.research({ search, ownDomain: DOMAIN, stored: storedTopTen(report, search) }, spend, page);
    researched.set(search, found);
    console.log(`   ${page} research "${search}": ${found.reads.map((r) => r.url).join(", ")} (${found.from})`);
    return found;
  };

  // ── Arm A: the product's pipeline, unmodified, three topics.
  for (const [i, pick] of picks.entries()) {
    const id = `A${i + 1}`;
    if (spend.total() + CAPS.DRAFT_C > RUN_CAP_CENTS) throw new Error(`${id}: CAPS.DRAFT_C no longer fits under the run cap`);
    console.log(`${id} — "${pick.candidate.targetQuery}"`);
    const before = ledger.rows.length;
    const result = await evaluate(ledger, slot, slotIndex, today, pick);
    own(id);
    const rows = ledger.rows.slice(before);
    const gradeCents = rows.filter((r) => r.source === "eval.grade").reduce((s, r) => s + r.costCents, 0);
    const search = pick.candidate.targetQuery ?? "";
    pages.push({
      id,
      arm: "A",
      search,
      type: pick.candidate.type,
      why: i === 0 ? "today's ranking, first" : `today's ranking, ${i === 1 ? "second" : "third"}`,
      outcome: result.outcome,
      title: result.title,
      body: result.bodyMarkdown,
      faq: result.faq,
      facts: result.factsUsed.map((f) => ({ text: f.passage, source: f.url })),
      pool: snapshot.pages.map((p) => ({ text: p.text, source: p.url })),
      research: await researchOf(search, id),
      genCents: result.costCents - gradeCents,
      gradeCents,
      list: result.checklist,
      grade: result.grade,
      traces: [],
      fresh: [],
    });
    console.log(`   ${result.outcome}; ${cents(result.costCents)}`);
  }

  // ── Arm B: topics by fit.
  const rivals = report.rivals.kind === "unmeasured" ? [] : report.rivals.value.map((r) => r.domain);
  const answers = report.aiAnswers?.rows ?? [];
  const candidates: B.Candidate[] = [
    ...report.questions.value.map((q, i) => {
      const row = answers.find((r) => r.question.search === q.search.keyword);
      const cited = row?.cell.kind === "answered" && !row.cell.namesCustomer ? row.cell.citedDomains : [];
      return { search: q.search.keyword, volume: q.search.volume, question: i, aiCited: [...cited], origin: "question" as const };
    }),
    ...report.market.value.suggestions.map((s) => ({ search: s.keyword, volume: s.volume, question: null, aiCited: [], origin: "suggestion" as const })),
    ...(report.market.value.pool ?? []).map((p) => ({ search: p.keyword, volume: p.volume, question: null, aiCited: [], origin: "rival_keyword" as const })),
  ].filter((c, i, all) => all.findIndex((d) => d.search === c.search) === i);
  console.log(`B — topics from ${candidates.length} candidates`);
  const topics = await B.chooseTopics(spend, {
    business: BUSINESS,
    category: market.category,
    job: market.job ?? "",
    audience: [...market.audienceTerms],
    rivals,
    kb,
    candidates,
  });
  const first = pages[0]!.search;
  const taken: { search: string; top: string[] }[] = [{ search: first, top: (storedTopTen(report, first) ?? []).map((r) => r.url) }];
  const passed: { search: string; why: string }[] = [];
  const bTopics: B.Topic[] = [];
  for (const t of topics.ranked) {
    if (bTopics.length === 2) break;
    const top = (storedTopTen(report, t.search) ?? []).map((r) => r.url);
    const same = taken.find((k) => k.search === t.search || top.filter((u) => k.top.includes(u)).length >= SAME_TOPIC_OVERLAP);
    if (same !== undefined) {
      passed.push({ search: t.search, why: same.search === t.search ? "page 1's topic" : `one topic with "${same.search}" (${SAME_TOPIC_OVERLAP}+ shared top-ten addresses)` });
      continue;
    }
    taken.push({ search: t.search, top });
    bTopics.push(t);
  }
  console.log(`   B's topics: ${bTopics.map((t) => `${t.search} (fit ${t.fit}, ${t.source})`).join("; ")}`);
  const topicCents = spend.of("topics");

  const bPlans: { id: string; search: string; kind: B.PageKind; anchored: boolean; type: OpportunityType; why: string }[] = [
    { id: "B1", search: first, kind: "comparison", anchored: false, type: pages[0]!.type, why: "A1's topic, to isolate the writing" },
    ...bTopics.map((t, i) => ({
      id: `B${i + 2}`,
      search: t.search,
      kind: t.kind,
      anchored: t.kind !== "comparison" || t.source === "product",
      type: typeOf(t.kind),
      why: `fit ${t.fit}, ${t.source}${t.proposed ? ", proposed" : ", measured"}: ${t.why}`,
    })),
  ];
  let nextMarket = 1;
  for (const plan of bPlans) {
    console.log(`${plan.id} — "${plan.search}"`);
    const found = await researchOf(plan.search, plan.id);
    const { facts: market_, dropped } = await B.marketFacts(spend, plan.id, found, nextMarket);
    nextMarket += market_.length;
    console.log(`   ${market_.length} market facts kept, ${dropped.length} dropped`);
    const pagePlan: B.PagePlan = {
      business: BUSINESS,
      domain: DOMAIN,
      category: market.category,
      job: market.job ?? "",
      audience: [...market.audienceTerms],
      voice: snapshot.site?.voiceText ?? null,
      search: plan.search,
      kind: plan.kind,
      anchored: plan.anchored,
      length: lengthOf(plan.kind),
      facts: [...kb, ...market_],
      topTitles: found.titles,
    };
    const pool = pagePlan.facts.map((f) => ({ text: f.text, source: f.source }));
    const factsOf = (w: B.Written) => w.factsUsed.flatMap((id) => pagePlan.facts.filter((f) => f.id === id)).map((f) => ({ text: f.text, source: f.source }));
    const measure = (w: B.Written) => {
      const list = checklist({
        bodyMarkdown: w.body,
        type: plan.type,
        query: plan.search,
        domain: DOMAIN,
        businessName: BUSINESS,
        factsUsed: w.factsUsed
          .flatMap((id) => pagePlan.facts.filter((f) => f.id === id && f.pool === "business"))
          .map((f) => ({ passage: f.text, url: f.source })),
        faq: w.faq,
        pages: snapshot.pages,
      });
      return { list, traces: traceNumbers({ body: w.body, facts: factsOf(w), pool }) };
    };
    const draft = await B.write(spend, plan.id, pagePlan);
    const d = measure(draft);
    const said = [
      `Words: ${d.list.words} (target ${pagePlan.length.floor}–${pagePlan.length.ceiling}).`,
      `Required blocks missing: ${blocksMissing(d.list).join(", ") || "none"}.`,
      `Numbers no listed fact holds: ${d.traces.filter((t) => t.verdict !== "traced").map((t) => t.number).join(", ") || "none"}.`,
    ].join("\n");
    const critique = await B.critic(spend, plan.id, pagePlan, draft, said);
    const final = critique.rewritten ?? draft;
    const f = critique.rewritten === null ? d : measure(final);
    console.log(`   critic: ${critique.decision}; draft ${d.list.words} words, final ${f.list.words}`);
    pages.push({
      id: plan.id,
      arm: "B",
      search: plan.search,
      type: plan.type,
      why: plan.why,
      outcome: critique.decision === "rewrite" ? "written; the critic rewrote it" : "written; the critic kept it",
      title: final.title,
      body: final.body,
      faq: final.faq,
      facts: factsOf(final),
      pool,
      research: found,
      genCents: spend.of(plan.id) + (plan.id === "B1" ? 0 : topicCents / bTopics.length),
      gradeCents: 0,
      list: f.list,
      grade: null,
      traces: f.traces,
      fresh: [],
      draft: critique.rewritten === null ? undefined : { title: draft.title, body: draft.body, faq: draft.faq, list: d.list, grade: null, traces: d.traces },
      critique,
      claimed: final.nonCommodity,
      dropped,
    });
  }

  // ── C: the hand-written reference, as it is.
  {
    const body = readFileSync(path.join(outDir, "C-reference.md"), "utf8");
    console.log(`C — "${C_SEARCH}"`);
    const found = await researchOf(C_SEARCH, "C");
    const hrefs = [...new Set(units(parseMarkdown(body)).flatMap((u) => u.links))];
    const linked = new Map<string, string | null>();
    for (const href of hrefs) {
      const got = await B.readPage(href, 50);
      linked.set(href, typeof got === "string" ? null : got.text);
    }
    console.log(`   sources read: ${[...linked.values()].filter((t) => t !== null).length} of ${hrefs.length}`);
    pages.push({
      id: "C",
      arm: "C",
      search: C_SEARCH,
      type: C_TYPE,
      why: "the hand-written dogfood article, revision 2",
      outcome: "hand-written",
      title: "Why does ChatGPT recommend my competitors?",
      body,
      faq: faqOfC(body),
      facts: [...linked].flatMap(([href, text]) => (text === null ? [] : [{ text, source: href }])),
      pool: snapshot.pages.map((p) => ({ text: p.text, source: p.url })),
      linked,
      research: found,
      genCents: 0,
      // Its one web search found the top results it is graded against.
      gradeCents: spend.of("C"),
      list: null,
      grade: null,
      traces: [],
      fresh: [],
    });
  }

  // ── Grade every page.
  const business = { domain: DOMAIN, category: market.category, job: market.job, products: snapshot.siteProfile?.products ?? [], audience: market.audienceTerms };
  for (const page of pages) {
    if (page.body === null || page.title === null) continue;
    console.log(`grade ${page.id}`);
    if (page.list === null) {
      page.list = checklist({
        bodyMarkdown: page.body,
        type: page.type,
        query: page.search,
        domain: DOMAIN,
        businessName: BUSINESS,
        factsUsed: page.facts.map((f) => ({ passage: f.text, url: f.source })),
        faq: page.faq,
        pages: snapshot.pages,
      });
    }
    if (page.traces.length === 0) page.traces = traceNumbers({ body: page.body, facts: page.facts, pool: page.pool, linked: page.linked });
    const gradeOf = async (title: string, body: string): Promise<ModelGrade | null> => {
      const before = ledger.rows.length;
      const grade = await modelGrade(ledger.contextFor(pages.indexOf(page) + 1), {
        business,
        target: page.search,
        topResults: page.research?.titles ?? [],
        title,
        bodyMarkdown: body,
        // C stands on the pages it links; the grader reads the sentences of
        // them its figures came from.
        facts:
          page.arm === "C"
            ? page.traces.filter((t) => t.verdict === "traced").map((t) => `${t.number} — ${t.from}`)
            : page.facts.map((f) => f.text),
      });
      page.gradeCents += ledger.rows.slice(before).reduce((s, r) => s + r.costCents, 0);
      own(page.id);
      return grade;
    };
    if (page.grade === null) page.grade = await gradeOf(page.title, page.body);
    if (page.draft !== undefined) page.draft.grade = await gradeOf(page.draft.title, page.draft.body);
    const before = spend.of(page.id);
    page.fresh = await nonCommodity(spend, page.id, { search: page.search, reads: page.research?.reads ?? [], site: siteText, body: page.body });
    page.gradeCents += spend.of(page.id) - before;
  }

  // ── Files.
  mkdirSync(path.join(outDir, "blind"), { recursive: true });
  mkdirSync(reviewDir, { recursive: true });
  for (const page of pages) {
    if (page.arm === "C" || page.body === null || page.title === null) continue;
    const head = `<!-- #1153 arm ${page.arm}, page ${page.id.slice(1)}: "${page.search}". Not published. -->\n\n`;
    writeFileSync(path.join(outDir, `${page.id}.md`), head + render(page.title, page.body, page.faq));
    if (page.draft !== undefined) {
      writeFileSync(path.join(outDir, `${page.id}-before-critic.md`), `<!-- #1153 arm B, page ${page.id.slice(1)}, the writer's draft before the critic rewrote it. Not published. -->\n\n${render(page.draft.title, page.draft.body, page.draft.faq)}`);
    }
  }
  const key: string[] = ["# Blind pairs — the key", "", "Do not open this file before reading the pairs.", "", "| Pair | Topic | X | Y |", "|---|---|---|---|"];
  for (const n of [1, 2, 3]) {
    const a = pages.find((p) => p.id === `A${n}`);
    const b = pages.find((p) => p.id === `B${n}`);
    if (a?.body == null || b?.body == null || a.title === null || b.title === null) continue;
    const [x, y] = randomInt(2) === 0 ? [a, b] : [b, a];
    writeFileSync(path.join(outDir, "blind", `pair-${n}-X.md`), render(x.title!, x.body!, x.faq));
    writeFileSync(path.join(outDir, "blind", `pair-${n}-Y.md`), render(y.title!, y.body!, y.faq));
    key.push(`| ${n} | ${n === 1 ? `"${a.search}" (both)` : `A: "${a.search}"; B: "${b.search}"`} | ${x.id} | ${y.id} |`);
  }
  writeFileSync(path.join(outDir, "blind", "key.md"), `${key.join("\n")}\n`);
  writeFileSync(
    path.join(reviewDir, "results.json"),
    `${JSON.stringify({ calls: { ledger: ledger.rows, tracker: spend.rows }, topics, passed, pages: pages.map((p) => ({ ...p, pool: p.pool.length, linked: undefined, research: p.research === null ? null : { ...p.research, reads: p.research.reads.map((r) => ({ url: r.url, words: r.text.split(/\s+/).length })) } })) }, null, 2)}\n`
  );
  writeFileSync(reportPath, reportOf({ pages, topics, passed, kb, ledger, owners, spend, today, topicCents, priorCents: opts.priorCents }));
  console.log(`\nSpent ${cents(spend.total())} of ${RUN_CAP_CENTS}¢.\nReport: ${reportPath}\nPages: ${outDir}`);
  return 0;
}

// ── The report ─────────────────────────────────────────────────────────

function reportOf(a: {
  pages: Page[];
  topics: { all: B.Topic[]; ranked: B.Topic[] };
  passed: { search: string; why: string }[];
  kb: B.Fact[];
  ledger: ProofLedger;
  owners: string[];
  priorCents: number;
  spend: Tracker;
  today: string;
  topicCents: number;
}): string {
  const L: string[] = [];
  const graded = a.pages.filter((p) => p.list !== null);
  const blocksCell = (list: Checklist) => {
    const req = Object.values(list.blocks).filter((v) => v !== null);
    return `${req.filter(Boolean).length}/${req.length}`;
  };
  const tally = (t: Trace[]) => ({
    traced: t.filter((x) => x.verdict === "traced").length,
    pool: t.filter((x) => x.verdict === "pool").length,
    unread: t.filter((x) => x.verdict === "unread").length,
    invented: t.filter((x) => x.verdict === "invented").length,
  });
  const floor = (p: Page) => (p.list?.target === null || p.list === null ? "—" : p.list.words >= p.list.target.floor ? "yes" : "no");
  const passesNew = (p: Page) => p.fresh.length >= 3 && p.fresh.some((c) => c.kind === "business");

  L.push("# Content A/B on reachkit.app");
  L.push("");
  L.push(`Written by \`node scripts/eval-content.mjs --ab --run\` on ${a.today} (#1153, epic #1127). Today's pipeline (A) beside a prototype of the 2026-09-29 content rulings (B) and the hand-written reference (C), all for reachkit.app as a customer, on the #1132 harness and its snapshot. Nothing was published and nothing was written to a database.`);
  L.push("");
  L.push("<!-- VERDICT -->");
  L.push("");
  L.push("## The arms");
  L.push("");
  L.push("- **A (today).** The product's `generateDraft`, unmodified, exactly as `npm run eval:content` runs it: the brief, outline, draft and answerability prompts, the hard-rule battery and the claim check.");
  L.push(`- **B (prototype).** \`scripts/eval-content/prototype/arm-b.ts\`, which changes nothing under \`src/\`. A knowledge base of ${a.kb.length} facts — ${a.kb.filter((f) => f.source !== "founder").length} prose sentences from the snapshot's pages, with any run of words found on three or more pages cut as navigation, and ${a.kb.filter((f) => f.source === "founder").length} founder answers taken from the approved copy in \`README.md\`. One small-tier call for topics by business fit. The top three readable results per target, their claims copied word for word, and statistics older than three years dropped. One \`claude-sonnet-5\` call to write, under the new rules as one prompt, and one \`claude-sonnet-5\` critic that may rewrite once (adaptive thinking, medium effort).`);
  L.push("- **C (reference).** The hand-written dogfood article, revision 2 (`ab-reachkit/C-reference.md`), graded as it is.");
  L.push("");
  L.push("## The pages");
  L.push("");
  L.push("| Page | Target search | Type the length is read as | Why this topic | Outcome |");
  L.push("|---|---|---|---|---|");
  for (const p of a.pages) {
    const t = targetOf(p.type, p.search);
    L.push(`| ${p.id} | ${esc(p.search)} | ${t === null ? p.type : `${t.kind}, ${t.floor}–${t.ceiling}`} | ${esc(p.why)} | ${esc(p.outcome)} |`);
  }
  L.push("");
  if (a.passed.length > 0) {
    L.push(`B passed over: ${a.passed.map((x) => `"${x.search}" (${x.why})`).join("; ")}.`);
    L.push("");
  }
  L.push("## Graded");
  L.push("");
  L.push("Fit and Adds are the #1132 grader's model half, unchanged. Blocks and words are its checklist. *New claims* is the non-commodity listing: the page's claims that neither the target's top three results nor the site state (the test passes at three, one of them about the business). *Numbers* traces every figure on the page, years and dates aside, to the fact it came from: *traced* is a fact the page stood on, *pool only* is its arm's wider pool but no fact it listed, *unread* is a cited page this run could not read, and *invented* is nothing at all.");
  L.push("");
  L.push("| Page | Fit 0–3 | Adds 0–3 | Blocks | Words / target | Floor met | New claims (business) | Test | Numbers traced / pool only / unread / invented | Nav text | Grader: invented figure |");
  L.push("|---|---|---|---|---|---|---|---|---|---|---|");
  for (const p of graded) {
    const list = p.list!;
    const t = tally(p.traces);
    L.push(
      `| ${p.id} | ${p.grade?.fit ?? "—"} | ${p.grade?.adds ?? "—"} | ${blocksCell(list)} | ${list.target === null ? list.words : `${list.words} / ${list.target.floor}–${list.target.ceiling}`} | ${floor(p)} | ${p.fresh.length} (${p.fresh.filter((c) => c.kind === "business").length}) | ${passesNew(p) ? "pass" : "fail"} | ${t.traced} / ${t.pool} / ${t.unread} / **${t.invented}** | ${list.navigationFacts > 0 ? `${list.navigationFacts} fact(s)` : "none"}${p.grade === null ? "" : p.grade.navigationText ? "; grader: yes" : "; grader: no"} | ${p.grade === null ? "—" : p.grade.inventedFigures ? `yes: ${esc(p.grade.inventedWhy)}` : "no"} |`
    );
  }
  L.push("");
  const drafts = a.pages.filter((p) => p.draft !== undefined);
  if (drafts.length > 0) {
    L.push("B before its critic, where the critic rewrote:");
    L.push("");
    L.push("| Draft | Fit | Adds | Blocks | Words | Numbers traced / pool only / invented |");
    L.push("|---|---|---|---|---|---|");
    for (const p of drafts) {
      const d = p.draft!;
      const t = tally(d.traces);
      L.push(`| ${p.id} before critic | ${d.grade?.fit ?? "—"} | ${d.grade?.adds ?? "—"} | ${blocksCell(d.list)} | ${d.list.words} | ${t.traced} / ${t.pool} / **${t.invented}** |`);
    }
    L.push("");
  }
  L.push("### Required blocks, per page");
  L.push("");
  const names = Object.keys(graded[0]?.list?.blocks ?? {});
  L.push(`| Block | ${graded.map((p) => p.id).join(" | ")} |`);
  L.push(`|---|${graded.map(() => "---").join("|")}|`);
  for (const name of names) {
    L.push(`| ${name} | ${graded.map((p) => (p.list!.blocks[name] === null ? "n/a" : p.list!.blocks[name] ? "yes" : "no")).join(" | ")} |`);
  }
  L.push("");
  L.push(`C's buyer questions are read from its own *Questions buyers ask* section (${faqCount(a.pages.find((p) => p.id === "C")?.faq)}), since a hand-written page has no \`meta.faq\`.`);
  L.push("");
  L.push("## Cost per page");
  L.push("");
  L.push(`Generation is what writing the page cost; grading is the #1132 grade plus the non-commodity listing. B2 and B3 each carry half of B's topic call (${cents(a.topicCents)}); B1's topic was A's. \`CAPS.DRAFT_C\` is ${cents(CAPS.DRAFT_C)}.`);
  L.push("");
  L.push("| Page | Generation | Grading | Fits `CAPS.DRAFT_C` (generation) |");
  L.push("|---|---|---|---|");
  for (const p of a.pages) {
    L.push(`| ${p.id} | ${p.arm === "C" ? "hand-written" : cents(p.genCents)} | ${cents(p.gradeCents)} | ${p.arm === "C" ? "—" : p.genCents <= CAPS.DRAFT_C ? "yes" : "**no**"} |`);
  }
  L.push("");
  L.push(`Run total ${cents(a.spend.total())} of 300¢${a.priorCents > 0 ? `, of which ${cents(a.priorCents)} was an earlier attempt stopped part-way (its claim step returned nothing readable; the parse was fixed and the run started again)` : ""}.`);
  L.push("");
  L.push("## What the grader said");
  L.push("");
  for (const p of graded) {
    if (p.grade === null) continue;
    L.push(`**${p.id}** — ${esc(p.title ?? "")}`);
    L.push(`- Fit: ${esc(p.grade.fitWhy)}`);
    L.push(`- Adds: ${esc(p.grade.addsWhy)}`);
    if (p.grade.inventedFigures) L.push(`- Invented figure: ${esc(p.grade.inventedWhy)}`);
    if (p.critique?.scores != null) L.push(`- B's critic: ${esc(JSON.stringify(p.critique.scores))}`);
    L.push("");
  }
  L.push("## What the non-commodity test lists");
  L.push("");
  for (const p of graded) {
    L.push(`**${p.id}** (${p.fresh.length}; ${passesNew(p) ? "passes" : "fails"})`);
    for (const c of p.fresh) L.push(`- ${c.kind}: ${esc(c.claim)}`);
    if (p.fresh.length === 0) L.push("- nothing");
    L.push("");
  }
  L.push("## Every number, and where it came from");
  L.push("");
  for (const p of graded) {
    L.push(`**${p.id}**`);
    L.push("");
    if (p.traces.length === 0) {
      L.push("No figures.");
      L.push("");
      continue;
    }
    L.push("| Number | In | Verdict | From |");
    L.push("|---|---|---|---|");
    for (const t of p.traces) L.push(`| ${t.number} | ${esc(t.said)} | ${t.verdict} | ${esc(t.from)} |`);
    L.push("");
  }
  L.push("## Topics");
  L.push("");
  L.push("B's small-tier call scored these at fit 2 or more (ranked fit first, then source — AI-answer gap, product, problem, buyer question, best-X — then volume):");
  L.push("");
  L.push("| Search | Fit | Source | Kind | Measured | Why |");
  L.push("|---|---|---|---|---|---|");
  for (const t of a.topics.ranked) L.push(`| ${esc(t.search)} | ${t.fit} | ${t.source} | ${t.kind} | ${t.proposed ? "proposed" : t.volume === null ? "—" : `volume ${t.volume}`} | ${esc(t.why)} |`);
  L.push("");
  L.push("## Research");
  L.push("");
  const seen = new Set<string>();
  for (const p of a.pages) {
    const r = p.research;
    if (r === null || seen.has(r.search)) continue;
    seen.add(r.search);
    L.push(`- "${r.search}" (${r.from}): ${r.tried.map((x) => `${x.url} — ${x.note}`).join("; ")}`);
  }
  for (const p of a.pages.filter((x) => x.dropped !== undefined)) {
    L.push(`- ${p.id}'s claims dropped: ${p.dropped!.length === 0 ? "none" : p.dropped!.map((d) => `"${esc(d.quote.slice(0, 90))}" (${d.why})`).join("; ")}`);
  }
  L.push("");
  L.push(`Each page is read for claims up to ${B.CLAIM_READ_WORDS} words, and for the non-commodity listing up to ${NEW_READ_WORDS} words.`);
  L.push("");
  L.push("## Every call");
  L.push("");
  L.push("| Page | Step | Model | Tokens in | Tokens out | Searches | Cost |");
  L.push("|---|---|---|---|---|---|---|");
  const ledgerRows = a.ledger.rows.map((r, i) => ({ page: a.owners[i] ?? "?", step: r.source, model: "claude-haiku-4-5 (product tier)", tokensIn: r.tokensIn ?? 0, tokensOut: r.tokensOut ?? 0, searches: 0, cents: r.costCents }));
  for (const r of [...ledgerRows, ...a.spend.rows]) L.push(`| ${r.page} | ${esc(r.step)} | ${r.model} | ${r.tokensIn} | ${r.tokensOut} | ${r.searches} | ${cents(r.cents)} |`);
  L.push("");
  L.push("## Files");
  L.push("");
  L.push("Every page is under `docs/walk/ab-reachkit/` as `A1.md` … `B3.md` and `C-reference.md`; a B page the critic rewrote keeps its draft as `B<n>-before-critic.md`. `blind/` holds each A–B pair relabelled X and Y at random, and `blind/key.md` the mapping.");
  return `${L.join("\n")}\n`;
}
