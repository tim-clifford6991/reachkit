// scripts/eval-content/round2.ts — #1164: round 2 of the content test.
//
// Round 1 (#1153) set today's pipeline beside a prototype; the prototype won
// and was built (#1135–#1138, #1143). Round 2 asks one thing of what was
// built: does a page get better when the writer is also handed first-party
// facts — the knowledge base of #1133 and #1163?
//
//   * **A** is the merged pipeline with what it reads today: the site's
//     pages, the report's measurements (#1163), the confirmed profile and the
//     market research of #1135.
//   * **B** is A with one thing more: the knowledge base — the product's own
//     reading of the site's pages (`readKnowledge`) and the founder's answers.
//
// Held constant inside a pair: the frozen snapshot, the topic, the market and
// rivals, the research (read once per topic and handed to every page of it),
// the models and effort (the product's own), and the grader of #1158.
//
// Two sites: reachkit.app, twice on round 1's pair-1 topic, and plausible.io,
// once on the page its stored report would write first. Nothing is published
// and nothing reaches a database: the pages are Markdown under
// `docs/walk/ab-round2/`.
//
// **The cap is the run's, not a page's.** Everything spent — the knowledge
// reads, the research, the pages and the judge — is added up in the round's
// file, a pair is started only where two pages and their judging still fit,
// and what a run bought is never bought again: a second `--run` picks up
// where the first stopped.
import { randomInt } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CAPS, EFFORT_BY_TYPE } from "@/lib/config/constants";
import { generateDraft, type GenerateOutcome } from "@/lib/generate/pipeline";
import type { AddsRecord } from "@/lib/generate/pipeline/adds";
import { reportPage } from "@/lib/generate/pipeline/report-facts";
import { NO_RESEARCH, researchMarket, type MarketResearch } from "@/lib/generate/pipeline/research";
import { targetSearches } from "@/lib/generate/pipeline/steps";
import { readRecordedRules } from "@/lib/generate/record";
import { setGenerateStore } from "@/lib/generate/store";
import { measured } from "@/lib/measure/measured";
import { bestFreePage, freePageOpportunity } from "@/lib/opportunities/free-page";
import type { Opportunity, OpportunityType } from "@/lib/opportunities/types";
import { readStoredReport, type StoredReport } from "@/lib/scan/report";
import { ownPages } from "@/lib/site-profile/knowledge/build";
import { readKnowledge } from "@/lib/site-profile/knowledge/extract";
import { knowledgeBase } from "@/lib/site-profile/knowledge/merge";
import { readFirstRank } from "@/lib/site-profile/knowledge/priority";
import { NO_KNOWLEDGE, type FounderAnswers, type KnowledgeBase, type StoredKnowledge } from "@/lib/site-profile/knowledge/types";
import { proofLedger, type ProofLedger } from "../live-drafts/cost";
import { describe, prepare, siteIdOf } from "./eval";
import { servePages } from "./measured-text";
import * as B from "./prototype/arm-b";
import { fetchEvidence, gradeRound, readPageFile, renderRound, type Evidence, type Pair, type RoundGrade, type RoundPage, type StoredAnswers } from "./round";
import { EVAL_SET } from "./set";
import { readSnapshot, SNAPSHOT_DIR, type Snapshot } from "./snapshot";

export interface Options {
  run: boolean;
  root: string;
  /** The most the whole round may spend (owner, 2026-10-04: 150¢). */
  capCents: number;
}

const DIR = "docs/walk/ab-round2";
const REPORT = "docs/walk/content-ab-round2.md";
const STATE = path.join(SNAPSHOT_DIR, "ab-round-2.json");
const ANSWERS = path.join(SNAPSHOT_DIR, "ab-round-2.answers.json");
const LIVE = path.join(SNAPSHOT_DIR, "ab-round-2.live.json");

/** What a page is reserved before it is started: the dearest page the merged
 *  pipeline has been measured at is 20.15¢ (the live page of 5 October). */
const PAGE_RESERVE_C = 23;
/** One judge reading of two full pages. */
const READING_RESERVE_C = 5.5;
/** The knowledge base is read from the site's first pages in read-first
 *  order, not all hundred: the cap is the round's. */
const KNOWLEDGE_PAGES = 8;
/** The judge is told what the business says in at most this many facts. */
const JUDGE_FACTS = 120;

const PAIR_1_TOPIC = "best ai seo software";
const C_SEARCH = "why does chatgpt recommend my competitors";

interface SitePlan {
  domain: string;
  business: string;
  /** The frozen snapshot the site is written from. */
  snapshot: string;
  /** The pairs written for it, by number. */
  pairs: number[];
}

const SITES: readonly SitePlan[] = [
  { domain: "reachkit.app", business: "ReachKit", snapshot: "reachkit.app.round-2", pairs: [1, 2] },
  { domain: "plausible.io", business: "Plausible", snapshot: "plausible.io", pairs: [3] },
];
/** The order pairs are bought in: one per site before a site's second. */
const PAIR_ORDER = [1, 3, 2];

interface CallRow {
  for: string;
  step: string;
  tokensIn: number | null;
  tokensOut: number | null;
  cents: number;
}

interface StoredPage {
  id: string;
  domain: string;
  arm: "A" | "B";
  pair: number;
  search: string;
  type: OpportunityType;
  outcome: string;
  title: string;
  file: string;
  cents: number;
  factsUsed: { passage: string; url: string }[];
  marketFacts: number;
  profileItems: number | null;
  adds: AddsRecord | null;
  critic: unknown;
}

interface SiteState {
  topic: { search: string; type: OpportunityType; why: string } | null;
  knowledge: { stored: StoredKnowledge; asked: number; pagesOffered: string[]; answers: FounderAnswers } | null;
  research: MarketResearch | null;
  evidence: Evidence | null;
}

interface State {
  round: 2;
  startedAt: string;
  calls: CallRow[];
  sites: Record<string, SiteState>;
  pages: StoredPage[];
  /** Which page each pair shows as X. Drawn once. */
  blind: Record<string, "A" | "B">;
  /** The topic list's order. Drawn once. */
  topicOrder: number[] | null;
  skipped: string[];
}

const cents = (n: number): string => `${n.toFixed(2)}¢`;
const esc = (text: string): string => text.replace(/\|/g, "\\|").replace(/\n/g, " ");

function readState(today: string): State {
  if (existsSync(STATE)) return JSON.parse(readFileSync(STATE, "utf8")) as State;
  return { round: 2, startedAt: today, calls: [], sites: {}, pages: [], blind: {}, topicOrder: null, skipped: [] };
}

function reviveResearch(research: MarketResearch): MarketResearch {
  return { ...research, facts: research.facts.map((fact) => ({ ...fact, readAt: new Date(fact.readAt) })) };
}

// ── Inputs ─────────────────────────────────────────────────────────────

/** `sites.market.current`, as the snapshot's export carried it. */
function currentMarket(snapshot: Snapshot): { category: string; rivals: string[] } | null {
  const current = (snapshot.market as { current?: { category?: unknown; rivals?: { domain?: unknown }[] } } | undefined)?.current;
  if (current === undefined || typeof current.category !== "string") return null;
  return { category: current.category, rivals: (current.rivals ?? []).flatMap((rival) => (typeof rival.domain === "string" ? [rival.domain] : [])) };
}

/** A page for one search, as the Write family shapes it. */
function opportunityFor(a: { report: StoredReport; siteId: string; query: string; type: "comparison_page" | "keyword_page" | "answer_page"; title: string; rival: { domain: string; url: string; position: number } }): Opportunity {
  const at = a.report.verdict.measuredAt;
  const volume = measured(0, at);
  return {
    id: `${a.report.scanId}:round-2`,
    siteId: a.siteId,
    scanId: a.report.scanId,
    type: a.type,
    family: "write",
    targetQuery: a.query,
    targetRef: a.query.replace(/[^a-z0-9]+/gi, "-").toLowerCase(),
    title: a.title,
    volume,
    evidence: { family: "write", query: a.query, volume, rival: { domain: a.rival.domain, url: measured(a.rival.url, at), position: measured(a.rival.position, at) } },
    acceptance: { form: "top20", query: a.query },
    fitBand: "winnable",
    effort: EFFORT_BY_TYPE[a.type],
    status: "open",
    clusterKey: null,
    absorbedQueries: [],
    ready: true,
    unreadyReason: null,
    createdAt: at,
  };
}

/** The founder's answers the round has. The owner has answered none of the
 *  five questions yet, so reachkit.app's are the two approved lines of
 *  `README.md` that answer one: who buys, and what it does that rivals
 *  don't. Nothing is written for a question no approved line answers. */
function founderAnswersFor(domain: string, readme: string): FounderAnswers {
  if (domain !== "reachkit.app") return {};
  const lines = B.founderAnswers(readme);
  const buyers = lines.find((line) => line.startsWith("For a founder"));
  const edge = lines.find((line) => line.startsWith("A free scan"));
  return { ...(buyers === undefined ? {} : { buyers }), ...(edge === undefined ? {} : { edge }) };
}

// ── One page ───────────────────────────────────────────────────────────

interface Written {
  outcome: string;
  title: string | null;
  body: string | null;
  faq: unknown;
  factsUsed: { passage: string; url: string }[];
  marketFacts: number;
  profileItems: number | null;
  adds: AddsRecord | null;
  critic: unknown;
}

async function writePage(a: {
  ledger: ProofLedger;
  draft: number;
  today: string;
  site: SitePlan;
  snapshot: Snapshot;
  opportunity: Opportunity;
  market: { category: string; rivals: string[] } | null;
  knowledge: KnowledgeBase | null;
  extraPages: { url: string; text: string; measuredAt: Date }[];
  research: MarketResearch;
}): Promise<Written> {
  const index = EVAL_SET.findIndex((slot) => slot.domain === a.site.domain);
  const prepared = prepare(EVAL_SET[index]!, index, a.today, undefined, {
    snapshot: a.snapshot,
    opportunity: a.opportunity,
    ...(a.market === null ? {} : { category: a.market.category, rivals: a.market.rivals }),
    knowledge: a.knowledge,
    extraPages: a.extraPages,
  });
  if (!prepared.ok) throw new Error(`${a.site.domain}: ${prepared.outcome}`);
  setGenerateStore(prepared.store);
  servePages({ siteId: prepared.siteId, domain: a.site.domain, pages: prepared.pages });
  const cost = a.ledger.contextFor(a.draft);
  try {
    const write = (): Promise<GenerateOutcome> => generateDraft(cost, { ...prepared.args, byline: prepared.businessName, market: a.research });
    let outcome = await write();
    if (!outcome.ok && outcome.reason === "step_failed" && outcome.draftId === null && !cost.capHit()) outcome = await write();
    const row = outcome.draftId === null ? null : await prepared.store.draftById(outcome.draftId);
    const meta = (row?.meta ?? null) as { factsUsed?: { passage: string; url: string }[]; faq?: unknown; adds?: AddsRecord; marketFacts?: unknown[]; profileItems?: unknown[]; critic?: unknown } | null;
    const failed = readRecordedRules(row?.rule_failures ?? null) ?? [];
    return {
      outcome: outcome.ok ? "passed" : failed.length > 0 ? `stopped: ${failed.map((each) => each.rule).join(", ")}` : describe(outcome),
      title: row?.title ?? null,
      body: row?.body_md ?? null,
      faq: meta?.faq ?? null,
      factsUsed: meta?.factsUsed ?? [],
      marketFacts: meta?.marketFacts?.length ?? 0,
      profileItems: meta?.profileItems === undefined ? null : meta.profileItems.length,
      adds: meta?.adds ?? null,
      critic: meta?.critic ?? null,
    };
  } finally {
    setGenerateStore(null);
    servePages(null);
  }
}

function render(title: string, body: string, faq: unknown): string {
  const questions = Array.isArray(faq) ? (faq as Record<string, unknown>[]) : [];
  const stored =
    questions.length === 0
      ? []
      : ["", "---", "", "*Buyer questions, stored with the page (`drafts.meta.faq`):*", "", ...questions.flatMap((q) => [`**${String(q.question ?? q.q ?? "")}**`, "", String(q.answer ?? q.a ?? ""), ""])];
  return [`# ${title}`, "", body.trim(), ...stored].join("\n").trimEnd() + "\n";
}

// ── Entry ──────────────────────────────────────────────────────────────

export async function main(opts: Options): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const outDir = path.join(opts.root, DIR);
  const state = readState(today);
  const readme = readFileSync(path.join(opts.root, "README.md"), "utf8");
  const live = JSON.parse(readFileSync(LIVE, "utf8")) as { draft: { title: string; body_md: string; meta: { faq?: unknown }; cost_cents: number; scheduled_for: string; state: string }; topics: Record<string, unknown>[] };
  const spent = () => state.calls.reduce((sum, row) => sum + row.cents, 0);
  const save = () => writeFileSync(STATE, `${JSON.stringify(state, null, 1)}\n`);
  mkdirSync(path.join(outDir, "blind"), { recursive: true });

  console.log(`# Round 2 (#1164): the pipeline beside itself with first-party facts\n`);
  console.log(`cap ${opts.capCents}¢; spent so far ${cents(spent())}; per page CAPS.DRAFT_C = ${cents(CAPS.DRAFT_C)}`);

  // The ledger's rows become the round's calls, each named for what it bought.
  const ledger = proofLedger(opts.capCents, spent());
  let taken = 0;
  const book = (owner: string) => {
    for (const row of ledger.rows.slice(taken)) state.calls.push({ for: owner, step: row.source, tokensIn: row.tokensIn, tokensOut: row.tokensOut, cents: row.costCents });
    taken = ledger.rows.length;
    save();
  };

  const prepared = new Map<string, { snapshot: Snapshot; report: StoredReport; opportunity: Opportunity; market: { category: string; rivals: string[] } | null; extraPages: { url: string; text: string; measuredAt: Date }[] }>();
  for (const [at, site] of SITES.entries()) {
    const snapshot = readSnapshot(site.snapshot);
    const report = readStoredReport(snapshot.report);
    const siteId = siteIdOf(EVAL_SET.findIndex((slot) => slot.domain === site.domain));
    const held = (state.sites[site.domain] ??= { topic: null, knowledge: null, research: null, evidence: null });
    let opportunity: Opportunity;
    // Where the top ten for the topic is stored: the frozen report, or — for
    // pair 1's topic, which the re-scan did not measure — round 1's snapshot.
    let researchReport = report;
    if (site.domain === "reachkit.app") {
      const round1 = readStoredReport(readSnapshot("reachkit.app").report);
      const index = round1.questions.kind === "unmeasured" ? -1 : round1.questions.value.findIndex((q) => q.search.keyword === PAIR_1_TOPIC);
      const serp = round1.serps[index];
      const top = serp !== undefined && serp.kind !== "unmeasured" ? serp.value.organic[0] : undefined;
      if (round1.questions.kind === "unmeasured" || top === undefined) throw new Error("round 1's snapshot no longer holds pair 1's topic");
      opportunity = opportunityFor({ report, siteId, query: PAIR_1_TOPIC, type: "comparison_page", title: round1.questions.value[index]!.text, rival: top });
      researchReport = round1;
      held.topic ??= { search: PAIR_1_TOPIC, type: "comparison_page", why: "round 1's pair-1 topic, held constant" };
    } else {
      const pick = bestFreePage(report);
      if (pick === null) throw new Error(`${site.domain}: its stored report chooses no page`);
      opportunity = { ...freePageOpportunity(report, pick), siteId };
      held.topic ??= { search: opportunity.targetQuery ?? "", type: opportunity.type, why: "the page its stored report would write first" };
    }
    const measuredPage = reportPage(report);
    prepared.set(site.domain, { snapshot, report, opportunity, market: currentMarket(snapshot), extraPages: measuredPage === null ? [] : [measuredPage] });
    console.log(`${site.domain}: "${held.topic.search}" (${held.topic.type}); snapshot ${site.snapshot}, scan ${snapshot.scan.id.slice(0, 8)} of ${snapshot.scan.finishedAt.slice(0, 10)}, ${snapshot.pages.length} pages; market ${currentMarket(snapshot)?.category ?? `${report.market.kind === "unmeasured" ? "—" : report.market.value.profile.category} (the report's)`}`);

    if (!opts.run) continue;

    // The knowledge base, read once by the product's own step.
    if (held.knowledge === null) {
      const pages = [...ownPages(snapshot.pages, site.domain)].sort((x, y) => readFirstRank(x.url) - readFirstRank(y.url)).slice(0, KNOWLEDGE_PAGES);
      const read = await readKnowledge(ledger.contextFor(100 + at), { domain: site.domain, pages, previous: NO_KNOWLEDGE, now: new Date() });
      held.knowledge = { stored: read.knowledge, asked: read.asked, pagesOffered: pages.map((page) => page.url), answers: founderAnswersFor(site.domain, readme) };
      book(`${site.domain} knowledge`);
      console.log(`   knowledge: ${read.asked} pages asked, ${read.knowledge.pages.length} read (${read.stoppedBy}); ${cents(spent())} spent`);
    }
    // The market research, read once and handed to every page of the topic.
    if (held.research === null) {
      held.research = await researchMarket(ledger.contextFor(200 + at), {
        siteId,
        domain: site.domain,
        searches: targetSearches(opportunity),
        report: researchReport,
        rivals: currentMarket(snapshot)?.rivals ?? (report.rivals.kind === "unmeasured" ? [] : report.rivals.value.map((rival) => rival.domain)),
        today: new Date(today),
      }).catch((error: unknown) => {
        console.log(`   research failed: ${String(error).slice(0, 160)}`);
        return NO_RESEARCH;
      });
      book(`${site.domain} research`);
      console.log(`   research: ${held.research.facts.length} facts, ${held.research.topResults?.length ?? 0} top results read, ${held.research.products.length} rivals' own pages; ${cents(spent())} spent`);
    }
  }

  if (!opts.run) {
    console.log("\nDry run — nothing was bought. Pass --run to spend.");
  } else {
    // ── The pairs, one per site before a site's second.
    for (const pair of PAIR_ORDER) {
      const site = SITES.find((each) => each.pairs.includes(pair))!;
      const held = state.sites[site.domain]!;
      const inputs = prepared.get(site.domain)!;
      const owed = (["A", "B"] as const).filter((arm) => !state.pages.some((page) => page.id === `${arm}${pair}`));
      if (owed.length === 0) continue;
      // Two readings for this pair and for every pair already written.
      const pairsWritten = new Set(state.pages.map((page) => page.pair)).size;
      const judging = (pairsWritten + (owed.length === 2 ? 1 : 0)) * 2 * READING_RESERVE_C;
      if (spent() + owed.length * PAGE_RESERVE_C + judging > opts.capCents) {
        const note = `pair ${pair} (${site.domain}) not written: ${owed.length} pages at ${PAGE_RESERVE_C}¢ and the judging owed (${cents(judging)}) do not fit under ${opts.capCents}¢ with ${cents(spent())} spent`;
        if (!state.skipped.includes(note)) state.skipped.push(note);
        console.log(note);
        save();
        continue;
      }
      for (const arm of owed) {
        const id = `${arm}${pair}`;
        console.log(`${id} — ${site.domain}, "${held.topic!.search}"${arm === "B" ? ", with the knowledge base" : ""}`);
        const written = await writePage({
          ledger,
          draft: pair * 10 + (arm === "A" ? 1 : 2),
          today,
          site,
          snapshot: inputs.snapshot,
          opportunity: inputs.opportunity,
          market: inputs.market,
          knowledge: arm === "B" ? knowledgeBase({ stored: held.knowledge!.stored, answers: held.knowledge!.answers }) : null,
          extraPages: inputs.extraPages,
          research: reviveResearch(held.research!),
        });
        const before = spent();
        book(id);
        console.log(`   ${written.outcome}; ${cents(spent() - before)}; ${cents(spent())} of ${opts.capCents}¢`);
        if (written.title === null || written.body === null) {
          state.skipped.push(`${id}: no page (${written.outcome})`);
          save();
          continue;
        }
        const file = `${id}.md`;
        writeFileSync(path.join(outDir, file), `<!-- #1164 round 2, arm ${arm}, pair ${pair}: "${held.topic!.search}" for ${site.domain}. Not published. -->\n\n${render(written.title, written.body, written.faq)}`);
        state.pages.push({
          id,
          domain: site.domain,
          arm,
          pair,
          search: held.topic!.search,
          type: held.topic!.type,
          outcome: written.outcome,
          title: written.title,
          file,
          cents: spent() - before,
          factsUsed: written.factsUsed,
          marketFacts: written.marketFacts,
          profileItems: written.profileItems,
          adds: written.adds,
          critic: written.critic,
        });
        save();
      }
    }
  }

  // ── The reference: the page production drafted for 5 October.
  writeFileSync(
    path.join(outDir, "R-live-2026-10-05.md"),
    `<!-- #1164 reference: the page the production pipeline drafted for reachkit.app, scheduled ${live.draft.scheduled_for} (${live.draft.state} when read on ${state.startedAt}; ${cents(live.draft.cost_cents)}). As stored. -->\n\n${render(live.draft.title, live.draft.body_md, live.draft.meta.faq)}`
  );

  // ── Grade, site by site.
  const round1 = JSON.parse(readFileSync(path.join(SNAPSHOT_DIR, "ab-round-1.json"), "utf8")) as { evidence: Evidence };
  const round1Answers = JSON.parse(readFileSync(path.join(SNAPSHOT_DIR, "ab-round-1.answers.json"), "utf8")) as StoredAnswers;
  const answers: StoredAnswers = existsSync(ANSWERS) ? (JSON.parse(readFileSync(ANSWERS, "utf8")) as StoredAnswers) : { readings: {}, placements: {} };
  // The calibration pair's two readings are #1158's of today, bought once.
  answers.readings["C/control"] ??= round1Answers.readings["C/control"] ?? [];
  answers.placements.C ??= round1Answers.placements.C ?? {};
  answers.placements.control ??= round1Answers.placements.control ?? {};

  const grades: { site: SitePlan; grade: RoundGrade; pages: RoundPage[] }[] = [];
  for (const site of SITES) {
    const held = state.sites[site.domain]!;
    const inputs = prepared.get(site.domain)!;
    const pageOf = (id: string, file: string, search: string, type: OpportunityType, dir = outDir, title?: string): RoundPage => ({ id, search, type, ...readPageFile(readFileSync(path.join(dir, file), "utf8"), title) });
    const own = state.pages.filter((page) => page.domain === site.domain).sort((x, y) => x.pair - y.pair || x.arm.localeCompare(y.arm));
    const pages: RoundPage[] = own.map((page) => pageOf(page.id, page.file, page.search, page.type));
    const pairs: Pair[] = site.pairs
      .filter((pair) => own.some((page) => page.id === `A${pair}`) && own.some((page) => page.id === `B${pair}`))
      .map((pair) => ({ first: `A${pair}`, second: `B${pair}`, expect: null, why: "the owner's blind read is owed" }));
    if (site.domain === "reachkit.app") {
      const round1Dir = path.join(opts.root, "docs/walk/ab-reachkit");
      pages.push(pageOf("R", "R-live-2026-10-05.md", "reachkit vs aeo engine", "comparison_page"));
      pages.push(pageOf("C", "C-reference.md", C_SEARCH, "keyword_page", round1Dir, "Why does ChatGPT recommend my competitors?"));
      pages.push(pageOf("control", "control-bad.md", C_SEARCH, "keyword_page", round1Dir));
      pairs.push({ first: "C", second: "control", expect: "C", why: "a planted bad control" });
    }
    if (pages.length === 0) continue;

    if (opts.run && held.evidence === null && own.length > 0) {
      const fetched = await fetchEvidence(
        { round: 2, domain: site.domain, business: site.business, dir: DIR, report: REPORT, readWords: B.CLAIM_READ_WORDS, results: { [held.topic!.search]: (held.research?.topResults ?? []).map((each) => each.url) }, pages: [], pairs: [], evidence: null },
        pages.filter((page) => page.id !== "C" && page.id !== "control"),
        today
      );
      // The calibration pair is read against what #1158 read for it.
      held.evidence =
        site.domain === "reachkit.app"
          ? { ...fetched, reads: { ...fetched.reads, [C_SEARCH]: round1.evidence.reads[C_SEARCH] ?? [] }, sources: { ...round1.evidence.sources, ...fetched.sources } }
          : fetched;
      save();
    }
    if (held.evidence === null) continue;

    const sitePages = [...inputs.snapshot.pages.map((page) => ({ url: page.url, text: page.text })), ...inputs.extraPages.map((page) => ({ url: page.url, text: page.text }))];
    const founderFacts = site.domain === "reachkit.app" ? B.founderAnswers(readme) : [];
    const before = spent();
    const grade = await gradeRound({
      domain: site.domain,
      business: site.business,
      pages,
      pairs,
      evidence: held.evidence,
      sitePages,
      founderFacts,
      businessFacts: B.knowledgeBase(inputs.snapshot, site.domain === "reachkit.app" ? readme : "", today).map((fact) => fact.text).slice(0, JUDGE_FACTS),
      today,
      stored: answers,
      capCents: opts.run ? opts.capCents - before : null,
      placeByModel: false,
    });
    for (const row of grade.calls) state.calls.push({ for: row.page, step: `${row.step} (${row.model})`, tokensIn: row.tokensIn, tokensOut: row.tokensOut, cents: row.cents });
    if (opts.run) {
      writeFileSync(ANSWERS, `${JSON.stringify(answers, null, 1)}\n`);
      save();
    }
    grades.push({ site, grade, pages });
  }

  // ── The blind pack.
  const key: string[] = ["# Round 2 — the key", "", "Do not open this file before reading the pairs and rating the topics.", "", "## The pairs", "", "| Pair | Site | Topic | X | Y |", "|---|---|---|---|---|"];
  for (const pair of [1, 2, 3]) {
    const a = state.pages.find((page) => page.id === `A${pair}`);
    const b = state.pages.find((page) => page.id === `B${pair}`);
    if (a === undefined || b === undefined) continue;
    const x = (state.blind[String(pair)] ??= randomInt(2) === 0 ? "A" : "B");
    const [first, second] = x === "A" ? [a, b] : [b, a];
    const plain = (page: StoredPage) => readFileSync(path.join(outDir, page.file), "utf8").replace(/^<!--[\s\S]*?-->\s*/, "");
    writeFileSync(path.join(outDir, "blind", `pair-${pair}-X.md`), plain(first));
    writeFileSync(path.join(outDir, "blind", `pair-${pair}-Y.md`), plain(second));
    key.push(`| ${pair} | ${a.domain} | "${a.search}" | ${first.id} | ${second.id} |`);
  }
  key.push("", "A is the merged pipeline as it reads today. B is the same pipeline, also handed the knowledge base.", "");

  // The topic list: the ten write topics the product's passes of 3 October
  // derived for reachkit.app at fit 2 or more, in a drawn order.
  const topics = live.topics.filter((topic) => typeof topic.fit === "number" && (topic.fit as number) >= 2);
  if (state.topicOrder === null) {
    const order = topics.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    state.topicOrder = order;
  }
  const ordered = state.topicOrder.map((i) => topics[i]!).filter((topic) => topic !== undefined);
  writeFileSync(
    path.join(outDir, "blind", "topics.md"),
    [
      "# Round 2 — rate these topics",
      "",
      "Ten pages ReachKit could write for reachkit.app. No page has been written for this list. For each, write 0–3: **3** a buyer of ReachKit would search this and ReachKit is the answer · **2** ReachKit plainly helps · **1** ReachKit could only be mentioned · **0** not ours. Then mark the three you would publish first.",
      "",
      "| # | Search the page targets | Working title | Your 0–3 | First three? |",
      "|---|---|---|---|---|",
      ...ordered.map((topic, i) => `| ${i + 1} | ${esc(String(topic.search))} | ${esc(String(topic.title))} | | |`),
      "",
    ].join("\n")
  );
  key.push("## The topics", "", "What the product decided for each, on its passes of 2026-10-03.", "", "| # | Search | Fit | Source | Kind | What the product did with it |", "|---|---|---|---|---|---|");
  ordered.forEach((topic, i) => key.push(`| ${i + 1} | ${esc(String(topic.search))} | ${String(topic.fit)} | ${String(topic.source)} | ${String(topic.type)} | ${String(topic.status)}${topic.status === "queued" ? " (the page of 5 October)" : ""} |`));
  writeFileSync(path.join(outDir, "blind", "key.md"), `${key.join("\n")}\n`);
  if (opts.run) save();

  // ── The report's measured half.
  const L: string[] = [];
  L.push(`Written by \`npm run eval:content -- --round2${opts.run ? " --run" : ""}\` on ${today} (#1164). Everything below this line is the script's; the verdict above it is written by hand from these tables.`);
  L.push("");
  L.push("### The pages");
  L.push("");
  L.push("| Page | Site | Arm | Target search | Outcome | Business facts used | Market facts cited | Profile items in the prompt | The pipeline's own list of what the page adds (about the business) | Cost |");
  L.push("|---|---|---|---|---|---|---|---|---|---|");
  for (const page of [...state.pages].sort((x, y) => x.pair - y.pair || x.arm.localeCompare(y.arm))) {
    L.push(
      `| ${page.id} | ${page.domain} | ${page.arm === "A" ? "A: as it reads today" : "B: with the knowledge base"} | ${esc(page.search)} | ${esc(page.outcome)} | ${page.factsUsed.length} | ${page.marketFacts} | ${page.profileItems ?? "—"} | ${page.adds === null ? "not listed" : `${page.adds.claims.length} (${page.adds.claims.filter((each) => each.business).length})${page.adds.short ? "; short" : ""}`} | ${cents(page.cents)} |`
    );
  }
  L.push("");
  for (const note of state.skipped) L.push(`- ${note}`);
  if (state.skipped.length > 0) L.push("");
  L.push("### What each site was written from");
  L.push("");
  for (const site of SITES) {
    const held = state.sites[site.domain];
    const inputs = prepared.get(site.domain)!;
    if (held === undefined) continue;
    const base = held.knowledge === null ? null : knowledgeBase({ stored: held.knowledge.stored, answers: held.knowledge.answers });
    L.push(`**${site.domain}** — snapshot \`${site.snapshot}.json\`: scan \`${inputs.snapshot.scan.id.slice(0, 8)}\` (${inputs.snapshot.scan.tier}, finished ${inputs.snapshot.scan.finishedAt.slice(0, 10)}), ${inputs.snapshot.pages.length} pages. Topic: "${held.topic?.search}" — ${held.topic?.why}. Market: ${inputs.market === null ? "the stored report's own" : `${inputs.market.category}; rivals ${inputs.market.rivals.join(", ")} (\`sites.market\`)`}.`);
    L.push(`- Both arms: the snapshot's pages${inputs.extraPages.length > 0 ? `, and the report's ${inputs.extraPages[0]!.text.split("\n").length} measured sentences as one more page` : ""}; the confirmed profile; the research below.`);
    if (held.research !== null) {
      const kinds = new Map<string, number>();
      for (const fact of held.research.facts) kinds.set(fact.kind, (kinds.get(fact.kind) ?? 0) + 1);
      L.push(`- Research, read once and handed to every page: ${held.research.facts.length} market facts (${[...kinds].map(([kind, n]) => `${n} ${kind}`).join(", ") || "none"}) from ${new Set(held.research.facts.map((fact) => fact.url)).size} pages; rivals whose own pages answered: ${held.research.products.map((product) => product.domain).join(", ") || "none"}.`);
    }
    if (held.knowledge !== null && base !== null) {
      const lists = (["audience", "problems", "proof", "questions", "integrations", "places"] as const).map((list) => `${base[list].length} ${list}`);
      L.push(`- B only, the knowledge base: ${held.knowledge.asked} pages read of ${held.knowledge.pagesOffered.length} offered (the first ${KNOWLEDGE_PAGES} in read-first order, legal pages left out) — ${base.offerings.length} offerings, ${base.differentiators.length} differentiators, ${lists.join(", ")}. Founder's answers: ${Object.keys(held.knowledge.answers).length === 0 ? "none" : Object.entries(held.knowledge.answers).map(([question, answer]) => `*${question}* — "${answer}"`).join("; ")}.`);
      for (const item of base.proof.slice(0, 6)) L.push(`  - proof: ${esc(item.text)}`);
    }
    L.push("");
  }
  for (const { site, grade } of grades) {
    L.push(
      ...renderRound(grade, {
        heading: `Graded: ${site.domain}`,
        today,
        intro: `The grader is #1158's, unchanged: counted in code, and a blind judge on \`claude-sonnet-5\` choosing between the two pages of a pair, twice, with the order swapped. The top results were read on ${grade.evidence.takenAt}, ${grade.evidence.readWords} words of each. The model placed no sentence in this round: what a page adds is listed by code alone, and by the pipeline's own list in the table above.`,
      }).map((line) => (line.startsWith("## ") ? `### ${line.slice(3)}` : line.startsWith("### ") ? `#### ${line.slice(4)}` : line))
    );
  }
  L.push("### Every call");
  L.push("");
  const totals = new Map<string, { n: number; cents: number; tokensIn: number; tokensOut: number }>();
  for (const row of state.calls) {
    const held = totals.get(`${row.for}|${row.step}`) ?? { n: 0, cents: 0, tokensIn: 0, tokensOut: 0 };
    totals.set(`${row.for}|${row.step}`, { n: held.n + 1, cents: held.cents + row.cents, tokensIn: held.tokensIn + (row.tokensIn ?? 0), tokensOut: held.tokensOut + (row.tokensOut ?? 0) });
  }
  L.push("| For | Step | Calls | Tokens in | Tokens out | Cost |");
  L.push("|---|---|---|---|---|---|");
  for (const [name, row] of totals) L.push(`| ${name.split("|")[0]} | ${name.split("|")[1]} | ${row.n} | ${row.tokensIn} | ${row.tokensOut} | ${cents(row.cents)} |`);
  L.push("");
  const by = (test: (row: CallRow) => boolean) => cents(state.calls.filter(test).reduce((sum, row) => sum + row.cents, 0));
  L.push(`**Spent ${cents(spent())} of the ${opts.capCents}¢ cap**: ${by((row) => row.for.endsWith("knowledge"))} reading the knowledge bases, ${by((row) => row.for.endsWith("research"))} on research, ${by((row) => /^[AB]\d$/.test(row.for))} writing pages, ${by((row) => row.step.startsWith("judge"))} judging.`);
  L.push("");

  const START = "<!-- ROUND2:START -->";
  const END = "<!-- ROUND2:END -->";
  const reportPath = path.join(opts.root, REPORT);
  const existing = existsSync(reportPath) ? readFileSync(reportPath, "utf8") : `# Content test, round 2\n\n<!-- VERDICT -->\n\n## Measured\n\n${START}\n${END}\n`;
  const [head, rest] = existing.split(START);
  const tail = rest?.split(END)[1] ?? "\n";
  writeFileSync(reportPath, `${head}${START}\n\n${L.join("\n").trimEnd()}\n\n${END}${tail}`);
  console.log(`\nSpent ${cents(spent())} of ${opts.capCents}¢.\nReport: ${reportPath}\nPages: ${outDir}`);
  for (const { grade } of grades) for (const each of grade.pairs) console.log(`  ${each.pair.first}/${each.pair.second} → ${each.verdict?.pick ?? (each.verdict === null ? "not judged" : "split")}`);
  return 0;
}
