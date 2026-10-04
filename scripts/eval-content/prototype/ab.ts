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
// Every page is then graded as a stored round is (`../round.ts`, #1158):
// counted in code, what it adds listed code first, and each A–B pair read
// blind by a judge, twice. The run writes the round's file, so the same
// grade can be made again from what is stored. A and B spend through the
// same ledger arithmetic as #1132; generation is held to #1153's 300¢ before
// each call, and grading to its own cap. Nothing is published and
// nothing reaches a database: the output is Markdown under `docs/walk/`.
import { randomInt } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CAPS } from "@/lib/config/constants";
import { comparePrecedence } from "@/lib/opportunities/cluster";
import type { Candidate as WriteCandidate } from "@/lib/opportunities/derive/candidate";
import { writeCandidates } from "@/lib/opportunities/derive/write";
import type { FreePagePick } from "@/lib/opportunities/free-page";
import { rankScore } from "@/lib/opportunities/rank/score";
import type { OpportunityType, Winnability } from "@/lib/opportunities/types";
import { demandBand } from "@/lib/opportunities/winnability/band";
import { rankedCountsFromSizes } from "@/lib/opportunities/winnability/counts";
import { readStoredReport, type StoredReport } from "@/lib/scan/report";
import { proofLedger, type ProofLedger } from "../../live-drafts/cost";
import { evaluate } from "../eval";
import { checklist, targetOf, traceNumbers, type Checklist, type Trace } from "../grade";
import { fetchEvidence, gradeRound, readPageFile, renderRound, type Pair, type RoundGrade, type RoundPage, type StoredAnswers } from "../round";
import { EVAL_SET } from "../set";
import { readSnapshot, SNAPSHOT_DIR } from "../snapshot";
import * as B from "./arm-b";

export interface Options {
  run: boolean;
  root: string;
  /** What earlier attempts at this run already spent; it counts against the
   *  same 300¢. */
  priorCents: number;
  /** The round this run is: its file is `snapshot/ab-round-<n>.json`. */
  round: number;
  /** The most the grading may spend. */
  gradeCapCents: number;
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
  research: B.Research | null;
  genCents: number;
  /** B only: the draft before the critic, and what the critic said. */
  draft?: { title: string; body: string; faq: unknown; list: Checklist; traces: Trace[] };
  critique?: B.Critique;
  claimed?: string[];
  dropped?: { quote: string; why: string }[];
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

/** The one length target (issue 1138), which the grader reads too. */
function lengthOf(kind: B.PageKind, search: string): { floor: number; ceiling: number } {
  const target = targetOf(typeOf(kind), search);
  if (target === null) throw new Error(`no length target for a ${kind} page`);
  return { floor: target.floor, ceiling: target.ceiling };
}

function typeOf(kind: B.PageKind): OpportunityType {
  return kind === "comparison" ? "comparison_page" : kind === "problem_howto" ? "keyword_page" : "answer_page";
}

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
    const result = await evaluate(ledger, slot, slotIndex, today, pick);
    own(id);
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
      genCents: result.costCents,
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
      length: lengthOf(plan.kind, plan.search),
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
      draft: critique.rewritten === null ? undefined : { title: draft.title, body: draft.body, faq: draft.faq, list: d.list, traces: d.traces },
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
    pages.push({
      id: "C",
      arm: "C",
      search: C_SEARCH,
      type: C_TYPE,
      why: "the hand-written dogfood article, revision 2",
      outcome: "hand-written",
      title: "Why does ChatGPT recommend my competitors?",
      body,
      faq: readPageFile(body).faq,
      facts: [],
      pool: snapshot.pages.map((p) => ({ text: p.text, source: p.url })),
      research: found,
      // Its one web search found the top results it is graded against.
      genCents: spend.of("C"),
    });
  }

  // ── Grade the round, from its file.
  const written = pages.filter((p): p is Page & { title: string; body: string } => p.title !== null && p.body !== null);
  const roundPages: RoundPage[] = written.map((p) => ({
    id: p.id,
    search: p.search,
    type: p.type,
    title: p.title,
    body: p.body,
    faq: Array.isArray(p.faq) ? (p.faq as Record<string, unknown>[]).map((q) => ({ question: String(q.question ?? q.q ?? "") })) : [],
  }));
  const control = readPageFile(readFileSync(path.join(outDir, "control-bad.md"), "utf8"));
  roundPages.push({ id: "control", search: C_SEARCH, type: C_TYPE, ...control });
  const pairs: Pair[] = [
    ...[1, 2, 3].flatMap((n) =>
      written.some((p) => p.id === `A${n}`) && written.some((p) => p.id === `B${n}`)
        ? [{ first: `A${n}`, second: `B${n}`, expect: null, why: "the owner's blind read is owed" }]
        : []
    ),
    { first: "C", second: "control", expect: "C", why: "a planted bad control" },
  ];
  const roundFile = {
    round: opts.round,
    domain: DOMAIN,
    business: BUSINESS,
    dir: "docs/walk/ab-reachkit",
    report: "docs/walk/content-ab-reachkit.md",
    readWords: B.CLAIM_READ_WORDS,
    results: Object.fromEntries([...researched].map(([search, found]) => [search, found.reads.map((r) => r.url)])),
    pages: [
      ...written.map((p) => ({ id: p.id, file: p.arm === "C" ? "C-reference.md" : `${p.id}.md`, search: p.search, type: p.type, ...(p.arm === "C" ? { title: p.title } : {}) })),
      { id: "control", file: "control-bad.md", search: C_SEARCH, type: C_TYPE },
    ],
    pairs,
    evidence: null,
  };
  const evidence = await fetchEvidence(roundFile, roundPages, today);
  writeFileSync(path.join(SNAPSHOT_DIR, `ab-round-${opts.round}.json`), `${JSON.stringify({ ...roundFile, evidence }, null, 1)}\n`);
  const stored: StoredAnswers = { readings: {}, placements: {} };
  const graded = await gradeRound({
    domain: DOMAIN,
    business: BUSINESS,
    pages: roundPages,
    pairs,
    evidence,
    sitePages: snapshot.pages,
    founderFacts: B.founderAnswers(readme),
    businessFacts: kb.map((f) => f.text),
    today,
    stored,
    capCents: opts.gradeCapCents,
  });
  writeFileSync(path.join(SNAPSHOT_DIR, `ab-round-${opts.round}.answers.json`), `${JSON.stringify(stored, null, 1)}\n`);

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
    `${JSON.stringify({ calls: { ledger: ledger.rows, tracker: spend.rows, grading: graded.calls }, topics, passed, pages: pages.map((p) => ({ ...p, pool: p.pool.length, research: p.research === null ? null : { ...p.research, reads: p.research.reads.map((r) => ({ url: r.url, words: r.text.split(/\s+/).length })) } })) }, null, 2)}\n`
  );
  writeFileSync(reportPath, reportOf({ pages, graded, round: opts.round, topics, passed, kb, ledger, owners, spend, today, topicCents, priorCents: opts.priorCents }));
  console.log(`\nSpent ${cents(spend.total())} of ${RUN_CAP_CENTS}¢.\nReport: ${reportPath}\nPages: ${outDir}`);
  return 0;
}

// ── The report ─────────────────────────────────────────────────────────

function reportOf(a: {
  pages: Page[];
  graded: RoundGrade;
  round: number;
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
  const blocksCell = (list: Checklist) => {
    const req = Object.values(list.blocks).filter((v) => v !== null);
    return `${req.filter(Boolean).length}/${req.length}`;
  };
  const tally = (t: Trace[]) => ({
    traced: t.filter((x) => x.verdict === "traced").length,
    pool: t.filter((x) => x.verdict === "pool").length,
    invented: t.filter((x) => x.verdict === "invented").length,
  });

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
  L.push(...renderRound(a.graded, { heading: `Round ${a.round}, graded`, today: a.today }));
  const drafts = a.pages.filter((p) => p.draft !== undefined);
  if (drafts.length > 0) {
    L.push("B before its critic, where the critic rewrote:");
    L.push("");
    L.push("| Draft | Blocks | Words | Numbers traced / pool only / invented |");
    L.push("|---|---|---|---|");
    for (const p of drafts) {
      const d = p.draft!;
      const t = tally(d.traces);
      L.push(`| ${p.id} before critic | ${blocksCell(d.list)} | ${d.list.words} | ${t.traced} / ${t.pool} / **${t.invented}** |`);
    }
    L.push("");
  }
  L.push("## Cost per page");
  L.push("");
  L.push(`Generation is what writing the page cost; what grading cost is listed with the round above. B2 and B3 each carry half of B's topic call (${cents(a.topicCents)}); B1's topic was A's. \`CAPS.DRAFT_C\` is ${cents(CAPS.DRAFT_C)}.`);
  L.push("");
  L.push("| Page | Generation | Fits `CAPS.DRAFT_C` |");
  L.push("|---|---|---|");
  for (const p of a.pages) {
    L.push(`| ${p.id} | ${p.arm === "C" ? "hand-written" : cents(p.genCents)} | ${p.arm === "C" ? "—" : p.genCents <= CAPS.DRAFT_C ? "yes" : "**no**"} |`);
  }
  L.push("");
  L.push(`Generation total ${cents(a.spend.total())} of 300¢${a.priorCents > 0 ? `, of which ${cents(a.priorCents)} was an earlier attempt stopped part-way (its claim step returned nothing readable; the parse was fixed and the run started again)` : ""}.`);
  L.push("");
  for (const p of a.pages) {
    if (p.critique?.scores != null) L.push(`- ${p.id}, B's critic: ${esc(JSON.stringify(p.critique.scores))}`);
  }
  L.push("");
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
  L.push(`Each page is read up to ${B.CLAIM_READ_WORDS} words, for its claims and for what a page adds alike.`);
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
  L.push("Every page is under `docs/walk/ab-reachkit/` as `A1.md` … `B3.md` and `C-reference.md`; a B page the critic rewrote keeps its draft as `B<n>-before-critic.md`. `blind/` holds each A–B pair relabelled X and Y at random, and `blind/key.md` the mapping. `control-bad.md` is the planted control the grader is calibrated on.");
  return `${L.join("\n")}\n`;
}
