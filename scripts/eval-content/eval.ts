// scripts/eval-content/eval.ts — #1132: today's pipeline, run over the
// evaluation set and graded, so every later change to generation is judged on
// the same ten sites.
//
// For each domain with a snapshot:
//
//   1. **Topic.** `bestFreePage` over the stored report — the page the paid
//      engine would write first, chosen by the product's own Write derivation,
//      right-sizing and ranking. No model, no vendor.
//   2. **Draft.** `generateDraft`, unmodified: the brief, outline, draft and
//      answerability prompts, the hard-rule battery and the claim check are the
//      product's own. A draft the rules stop is graded as written, with the
//      rules that stopped it; only a step that did not answer is tried again,
//      as the product tries it (#813).
//   3. **Grade.** `./grade.ts`: counted in code, every number traced. No
//      model grades a single page (#1158); pages are judged in pairs by
//      `./round.ts`.
//
// A draft spends inside one cost context capped at `CAPS.DRAFT_C`, so a page
// never spends more than the product allows for one. The model is the only
// live call. Nothing publishes: the drafts live in this process and in
// `.review/eval-content/` (gitignored), and the one committed output is the
// table at `docs/walk/content-eval.md`.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CAPS, EFFORT_BY_TYPE, ADDS } from "@/lib/config/constants";
import { generateDraft, type GenerateOutcome } from "@/lib/generate/pipeline";
import { readRecordedRules } from "@/lib/generate/record";
import type { AddsRecord } from "@/lib/generate/pipeline/adds";
import { NO_RESEARCH, researchMarket } from "@/lib/generate/pipeline/research";
import { targetSearches } from "@/lib/generate/pipeline/steps";
import { siteLinkTargets } from "@/lib/generate/links/select";
import type { DraftInsert, DraftPatch, DraftRow, GenerateStore } from "@/lib/generate/store";
import { setGenerateStore } from "@/lib/generate/store";
import { promptProfile } from "@/lib/generate/voice/profile-block";
import { measured } from "@/lib/measure/measured";
import { bestFreePage, freePageOpportunity, type FreePagePick } from "@/lib/opportunities/free-page";
import type { Opportunity } from "@/lib/opportunities/types";
import { readStoredReport, type StoredReport } from "@/lib/scan/report";
import { confirmedProfile } from "@/lib/site-profile/business/confirm";
import { NO_EDITS } from "@/lib/site-profile/business/types";
import type { KnowledgeBase } from "@/lib/site-profile/knowledge/types";
import type { InventoryRow } from "@/lib/site-profile/types";
import { proofLedger, type ProofLedger } from "../live-drafts/cost";
import { checklist, traceNumbers, type Checklist, type Trace } from "./grade";
import { servePages } from "./measured-text";
import { EVAL_SET, type EvalSlot } from "./set";
import { inventoryOf, readSnapshot, type Snapshot } from "./snapshot";

export interface Options {
  run: boolean;
  /** Only these domains; empty is the whole set. */
  only: readonly string[];
  outDir: string;
  tablePath: string;
}

export interface Result {
  slot: EvalSlot;
  domain: string;
  scan: Snapshot["scan"];
  target: { search: string; type: string } | null;
  outcome: string;
  title: string | null;
  bodyMarkdown: string | null;
  checklist: Checklist | null;
  /** Every figure on the page, traced to the fact that holds it. */
  traces: Trace[];
  costCents: number;
  /** The business facts the draft stood on, and its buyer questions, as the
   *  pipeline stored them on the row. */
  factsUsed: { passage: string; url: string }[];
  faq: unknown;
  /** What the page adds (issue 1143), as the pipeline listed it on the row:
   *  `null` where no page reached the listing. */
  adds: AddsRecord | null;
}

const cents = (n: number): string => `${n.toFixed(2)}¢`;

/** Every page this run has written, by draft id, across the set's sites —
 *  so a site's draft is compared with the pages written for the sites before
 *  it, as the product compares across customers (issue 1144). */
const written = new Map<string, { siteId: string; markdown: string }>();

export function memoryStore(a: { siteId: string; domain: string; report: StoredReport; inventory: InventoryRow[] }): GenerateStore {
  const rows = new Map<string, DraftRow>();
  let next = 0;
  const keep = (id: string): void => {
    const markdown = rows.get(id)?.body_md ?? "";
    if (markdown !== "") written.set(id, { siteId: a.siteId, markdown });
  };
  return {
    async siteFacts() {
      return null;
    },
    async latestReport() {
      return a.report;
    },
    async insertDraft(row: DraftInsert) {
      next += 1;
      const id = `${a.domain}-${next}`;
      rows.set(id, {
        id,
        site_id: row.site_id,
        opportunity_id: row.opportunity_id,
        state: row.state,
        title: row.title,
        body_md: row.body_md,
        meta: row.meta ?? null,
        grounded_fact: row.grounded_fact,
        attribution: row.attribution,
        hard_rule_attempts: 0,
        rule_failures: null,
        claim_check: null,
        cost_cents: row.cost_cents,
        scheduled_for: row.scheduled_for,
        veto_deadline: null,
        created_at: new Date().toISOString(),
      });
      keep(id);
      return id;
    },
    async patchDraft(draftId: string, patch: DraftPatch) {
      const existing = rows.get(draftId);
      if (existing !== undefined) rows.set(draftId, { ...existing, ...patch } as DraftRow);
      keep(draftId);
    },
    async draftById(draftId: string) {
      return rows.get(draftId) ?? null;
    },
    // A site in the set has published nothing of ours and queued nothing.
    async publishedPages() {
      return [];
    },
    async queuedPages() {
      return [];
    },
    async pagesElsewhere(siteId: string) {
      return [...written.values()].filter((page) => page.siteId !== siteId).map((page) => page.markdown);
    },
    async draftsShortOfHandOff() {
      return [];
    },
    async countShortOfHandOff() {
      return 0;
    },
    async siteInventory() {
      return a.inventory;
    },
    async knownPages() {
      return [];
    },
    async clusterPages() {
      return [];
    },
    async draftOnDate() {
      return false;
    },
    async restartedDrafts() {
      return [];
    },
  };
}

export function describe(outcome: GenerateOutcome): string {
  if (outcome.ok) return "passed";
  if (outcome.reason === "rules") return `stopped: ${outcome.failed.map((f) => f.rule).join(", ")}`;
  if (outcome.step === "adds") return "held: adds too little";
  if (outcome.step === "elsewhere") return "held: too close to a page written for another site";
  return `step failed: ${outcome.step}`;
}

/**
 * Where the pass chooses nothing, the report's first question with a measured
 * top ten, as a plain answer page — so the draft is still graded. The table
 * says the pass chose nothing; this is the evaluation's fallback, never the
 * product's.
 */
function fallbackOpportunity(report: StoredReport, siteId: string): Opportunity | null {
  if (report.questions.kind === "unmeasured") return null;
  const at = report.verdict.measuredAt;
  const index = report.questions.value.findIndex((_, i) => report.serps[i]?.kind === "measured");
  const question = report.questions.value[index];
  const serp = report.serps[index];
  if (question === undefined || serp === undefined || serp.kind === "unmeasured") return null;
  const top = serp.value.organic[0];
  if (top === undefined) return null;
  const query = question.search.keyword;
  const volume = measured(question.search.volume, at);
  return {
    id: `${report.scanId}:fallback`,
    siteId,
    scanId: report.scanId,
    type: "answer_page",
    family: "write",
    targetQuery: query,
    targetRef: query.replace(/[^a-z0-9]+/gi, "-").toLowerCase(),
    title: question.text,
    volume,
    evidence: {
      family: "write",
      query,
      volume,
      rival: { domain: top.domain, url: measured(top.url, at), position: measured(top.position, at) },
    },
    acceptance: { form: "top20", query },
    fitBand: "winnable",
    effort: EFFORT_BY_TYPE.answer_page,
    status: "open",
    clusterKey: null,
    absorbedQueries: [],
    ready: true,
    unreadyReason: null,
    createdAt: at,
  };
}

/** A stable id per domain, so two runs write the same rows. */
export function siteIdOf(index: number): string {
  return `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
}

/** What a round holds constant or varies over the set's defaults (#1164). */
export interface Over {
  /** A frozen snapshot, in place of the set's own for the domain. */
  snapshot?: Snapshot;
  /** The page to write, in place of the report's first. */
  opportunity?: Opportunity;
  /** The market the site holds now (`sites.market`), where the stored
   *  report's own reading is older. */
  category?: string;
  rivals?: readonly string[];
  /** The knowledge base (#1133), where the arm has one. */
  knowledge?: KnowledgeBase | null;
  /** Pages served beside the snapshot's: the report's measurements (#1163),
   *  which production reads from the database. */
  extraPages?: readonly { url: string; text: string; measuredAt: Date }[];
}

/** Everything one domain's draft is written from, in the product's own
 *  shapes, and the in-memory store it is written to. `null` with the reason
 *  where the report gives no page to write. */
export function prepare(
  slot: EvalSlot,
  index: number,
  today: string,
  given?: FreePagePick,
  over: Over = {}
):
  | { ok: false; outcome: string }
  | {
      ok: true;
      snapshot: Snapshot;
      report: StoredReport;
      market: Extract<StoredReport["market"], { kind: "measured" }>["value"]["profile"];
      siteId: string;
      opportunity: Opportunity;
      target: { search: string; type: string };
      chose: string;
      businessName: string;
      store: GenerateStore;
      pages: { url: string; text: string; measuredAt: Date }[];
      args: Parameters<typeof generateDraft>[1];
    } {
  const domain = slot.domain!;
  const snapshot = over.snapshot ?? readSnapshot(domain);
  const report = readStoredReport(snapshot.report);
  if (report.market.kind === "unmeasured") return { ok: false, outcome: "no market reading in the report" };
  const market = over.category === undefined ? report.market.value.profile : { ...report.market.value.profile, category: over.category };

  const siteId = siteIdOf(index);
  const pick = over.opportunity !== undefined ? null : (given ?? bestFreePage(report));
  const opportunity = over.opportunity ?? (pick === null ? fallbackOpportunity(report, siteId) : { ...freePageOpportunity(report, pick), siteId });
  if (opportunity === null) return { ok: false, outcome: "no topic, and no measured question to fall back on" };
  const target = { search: opportunity.targetQuery ?? "", type: opportunity.type };
  const chose = pick === null && over.opportunity === undefined ? "the pass chose nothing; drafted for the report's first question. " : "";

  const inventory = inventoryOf(snapshot);
  const pages = [...snapshot.pages.map((page) => ({ url: page.url, text: page.text, measuredAt: new Date(page.readAt) })), ...(over.extraPages ?? [])];
  const profile = promptProfile(
    confirmedProfile({
      profile:
        snapshot.siteProfile === null
          ? null
          : {
              domain,
              siteName: snapshot.siteProfile.siteName,
              products: snapshot.siteProfile.products,
              claims: snapshot.siteProfile.claims,
              voice: snapshot.siteProfile.voice,
              inventory,
              pagesRead: inventory.length,
              refreshedAt: new Date(snapshot.scan.finishedAt),
            },
      market,
      edits: NO_EDITS,
    }),
    over.knowledge ?? null
  );
  const businessName = market.brandTokens[0] ?? snapshot.siteProfile?.siteName ?? domain;
  const rivals = over.rivals !== undefined ? [...over.rivals] : report.rivals.kind === "unmeasured" ? [] : report.rivals.value.map((rival) => rival.domain);

  const store = memoryStore({ siteId, domain, report, inventory });
  const args = {
    siteId,
    opportunity,
    scheduledFor: today,
    site: {
      businessName,
      domain,
      doNotClaim: snapshot.site?.doNotClaim ?? [],
      rivals,
    },
    voiceText: snapshot.site?.voiceText ?? null,
    category: market.category,
    links: siteLinkTargets({ domain, inventory, query: target.search }),
    known: [],
    profile,
    factsOff: [],
    scanId: report.scanId,
  };
  return { ok: true, snapshot, report, market, siteId, opportunity, target, chose, businessName, store, pages, args };
}

/** One page for one domain. `given` is a topic chosen elsewhere (#1153 runs
 *  the ranking's second and third picks); without it, the report's first. */
export async function evaluate(
  ledger: ProofLedger,
  slot: EvalSlot,
  index: number,
  today: string,
  given?: FreePagePick
): Promise<Result> {
  const domain = slot.domain!;
  const prepared = prepare(slot, index, today, given);
  const snapshot = readSnapshot(domain);
  const base = { slot, domain, scan: snapshot.scan, title: null, bodyMarkdown: null, checklist: null, traces: [], costCents: 0, factsUsed: [], faq: null, adds: null };
  if (!prepared.ok) return { ...base, target: null, outcome: prepared.outcome };
  const { report, siteId, opportunity, target, chose, businessName, store, pages } = prepared;
  if (!ledger.canStartDraft()) return { ...base, target, outcome: "not started: the run cap" };

  setGenerateStore(store);
  servePages({ siteId, domain, pages });
  const cost = ledger.contextFor(index + 1);
  try {
    // The market pool (issue 1135), read once as the product reads it: the
    // public pages are fetched live and free; the claim calls are inside the
    // page's cap. A read that fails leaves the page to its business facts.
    const research = await researchMarket(cost, {
      siteId,
      domain,
      searches: targetSearches(opportunity),
      report,
      rivals: prepared.args.site.rivals,
      today: new Date(today),
    }).catch(() => NO_RESEARCH);
    const write = (): Promise<GenerateOutcome> => generateDraft(cost, { ...prepared.args, market: research });
    // A step that did not answer gets the second attempt the product gives it
    // (#813), inside the same cost context. A rule stop is graded as written.
    let outcome = await write();
    if (!outcome.ok && outcome.reason === "step_failed" && outcome.draftId === null && !cost.capHit()) {
      outcome = await write();
    }

    const row = outcome.draftId === null ? null : await store.draftById(outcome.draftId);
    const meta = (row?.meta ?? null) as { factsUsed?: { passage: string; url: string }[]; faq?: unknown; adds?: AddsRecord } | null;
    const failed = readRecordedRules(row?.rule_failures ?? null) ?? [];
    const said = chose + (outcome.ok ? "passed" : failed.length > 0 ? `stopped: ${failed.map((f) => f.rule).join(", ")}` : describe(outcome));
    if (row === null || row.body_md === null) return { ...base, target, outcome: said, costCents: cost.spentCents() };

    const factsUsed = meta?.factsUsed ?? [];
    const list = checklist({
      bodyMarkdown: row.body_md,
      type: opportunity.type,
      query: target.search,
      domain,
      businessName,
      factsUsed,
      faq: meta?.faq,
      pages: snapshot.pages,
    });
    const traces = traceNumbers({
      body: row.body_md,
      facts: [
        ...factsUsed.map((fact) => ({ text: fact.passage, source: fact.url })),
        ...research.facts.map((fact) => ({ text: `${fact.title} ${fact.passage}`, source: fact.url })),
      ],
      pool: [
        ...snapshot.pages.map((page) => ({ text: page.text, source: page.url })),
        ...(research.topResults ?? []).map((result) => ({ text: result.text, source: result.url })),
      ],
    });
    return {
      ...base,
      target,
      outcome: said,
      title: row.title,
      bodyMarkdown: row.body_md,
      checklist: list,
      traces,
      costCents: cost.spentCents(),
      factsUsed,
      faq: meta?.faq ?? null,
      adds: meta?.adds ?? null,
    };
  } finally {
    setGenerateStore(null);
    servePages(null);
  }
}

// ── The table ──────────────────────────────────────────────────────────

const esc = (text: string): string => text.replace(/\|/g, "\\|").replace(/\n/g, " ");

/** The list's size, how many of it are about the business, and whether a new
 *  page of that list is short of the bar. */
function addsCell(adds: AddsRecord | null): string {
  if (adds === null) return "not listed";
  return `${adds.claims.length} (${adds.claims.filter((each) => each.business).length})${adds.short ? "; short" : ""}`;
}

function blocksCell(list: Checklist): string {
  const required = Object.values(list.blocks).filter((value) => value !== null);
  return `${required.filter(Boolean).length}/${required.length}`;
}

function table(results: readonly Result[], ledger: ProofLedger, today: string): string {
  const lines: string[] = [];
  lines.push("# Content evaluation");
  lines.push("");
  lines.push(
    `Written by \`node scripts/eval-content.mjs --run\` on ${today} (#1132). It is a tool, not a gate. Each row is one draft by today's pipeline for the page the stored report would write first. Nothing was published. How the grades are made: \`scripts/eval-content/grade.ts\` — all of it counted in code; no model scores a single page (#1158). One draft per site is noisy: the same pipeline passed a different set of sites on each of three runs on 2026-09-29, so compare runs, not single rows.`
  );
  lines.push("");
  lines.push("| Site | Target search (type) | Outcome | Words / target | Blocks | Answer box | Business facts | Market facts | New claims (business) | Nav text | Fact labels | Repeated sentences | Empty cells | Numbers traced / pool only / invented | Cost |");
  lines.push("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const r of results) {
    const list = r.checklist;
    const target = r.target === null ? "—" : `${esc(r.target.search)} (${r.target.type})`;
    const words = list === null ? "—" : list.target === null ? String(list.words) : `${list.words} / ${list.target.floor}–${list.target.ceiling}`;
    const nav = list === null ? "—" : `${list.navigationFacts > 0 ? `${list.navigationFacts} fact(s) on 3+ pages` : "none in facts"}; ${list.sitePhrases.length === 0 ? "none on the page" : `${list.sitePhrases.length} runs on the page`}`;
    const count = (verdict: Trace["verdict"]) => r.traces.filter((each) => each.verdict === verdict).length;
    lines.push(
      `| ${r.domain} | ${target} | ${esc(r.outcome)} | ${words} | ${list === null ? "—" : blocksCell(list)} | ${list === null ? "—" : list.answerWords === 0 ? "none" : `${list.answerWords} words`} | ${list?.businessFacts ?? "—"} | ${list?.marketFacts ?? "—"} | ${addsCell(r.adds)} | ${nav} | ${list?.factLabels ?? "—"} | ${list?.duplicateSentences.length ?? "—"} | ${list?.emptyCells ?? "—"} | ${list === null ? "—" : `${count("traced")} / ${count("pool")} / **${count("invented")}**`} | ${cents(r.costCents)} |`
    );
  }
  for (const slot of EVAL_SET.filter((s) => s.domain === null)) {
    lines.push(`| *${slot.kind}* | waiting for the owner's pick | | | | | | | | | | | | | |`);
  }
  lines.push("");
  lines.push(`Total spend ${cents(ledger.spentCents())}; each page is capped at \`CAPS.DRAFT_C\` = ${cents(CAPS.DRAFT_C)} for its draft.`);
  lines.push("");
  lines.push("## Required blocks, per draft");
  lines.push("");
  const graded = results.filter((r) => r.checklist !== null);
  const names = Object.keys(graded[0]?.checklist?.blocks ?? {});
  if (graded.length > 0) {
    lines.push(`| Block | ${graded.map((r) => r.domain).join(" | ")} |`);
    lines.push(`|---|${graded.map(() => "---").join("|")}|`);
    for (const name of names) {
      const cells = graded.map((r) => {
        const value = r.checklist!.blocks[name];
        return value === null ? "n/a" : value ? "yes" : "no";
      });
      lines.push(`| ${name} | ${cells.join(" | ")} |`);
    }
    lines.push("");
  }
  lines.push("## What each page adds");
  lines.push("");
  lines.push(
    `The pipeline's own list (#1143): each sentence of the draft that neither the target's top results nor the site's pages state, kept only where its words are on the page. A new page needs ${ADDS.min}, at least ${ADDS.businessMin} of them about the business; short of that it is held or becomes an update.`
  );
  lines.push("");
  for (const r of results) {
    if (r.bodyMarkdown === null) continue;
    lines.push(`**${r.domain}** (${addsCell(r.adds)})`);
    for (const each of r.adds?.claims ?? []) lines.push(`- ${each.business ? "business" : "other"}: ${esc(each.claim)}`);
    lines.push("");
  }
  lines.push("## Numbers nothing holds");
  lines.push("");
  for (const r of results) {
    const invented = r.traces.filter((each) => each.verdict === "invented");
    if (invented.length === 0) continue;
    lines.push(`**${r.domain}** — ${esc(r.title ?? "")}`);
    for (const each of invented) lines.push(`- ${each.number}: ${esc(each.said)}`);
    lines.push("");
  }
  lines.push("## The reports graded");
  lines.push("");
  for (const r of results) {
    lines.push(`- ${r.domain}: ${r.scan.tier} scan \`${r.scan.id}\` (${r.scan.status}, ${r.scan.finishedAt.slice(0, 10)})`);
  }
  return `${lines.join("\n")}\n`;
}

// ── Entry ──────────────────────────────────────────────────────────────

export async function main(opts: Options): Promise<number> {
  const slots = EVAL_SET.filter((slot) => slot.domain !== null && (opts.only.length === 0 || opts.only.includes(slot.domain)));
  const runCap = slots.length * CAPS.DRAFT_C;
  console.log(`# Content evaluation (#1132)\n`);
  console.log(`domains     ${slots.map((s) => s.domain).join(", ")}`);
  console.log(`waiting     ${EVAL_SET.filter((s) => s.domain === null).length} slots for the owner's pick`);
  console.log(`per page    CAPS.DRAFT_C = ${cents(CAPS.DRAFT_C)}`);
  console.log(`worst case  ${slots.length} x ${cents(CAPS.DRAFT_C)} = ${cents(runCap)}`);
  console.log(`publishes   nothing\n`);
  if (!opts.run) {
    for (const slot of slots) {
      const report = readStoredReport(readSnapshot(slot.domain!).report);
      const pick = bestFreePage(report);
      const fallback = pick === null ? fallbackOpportunity(report, "") : null;
      console.log(
        `${slot.domain!.padEnd(16)} ${pick !== null ? `${pick.candidate.targetQuery} (${pick.candidate.type})` : `the pass chose nothing; fallback: ${fallback?.targetQuery ?? "none"}`}`
      );
    }
    console.log("\nDry run — no model was called and nothing was spent. Pass --run to spend.");
    return 0;
  }

  const today = new Date().toISOString().slice(0, 10);
  const ledger = proofLedger(runCap);
  const results: Result[] = [];
  for (const slot of slots) {
    console.log(`${slot.domain} — writing...`);
    const result = await evaluate(ledger, slot, EVAL_SET.indexOf(slot), today);
    results.push(result);
    console.log(`   ${result.outcome}; ${cents(result.costCents)}; run total ${cents(ledger.spentCents())}`);
  }

  mkdirSync(opts.outDir, { recursive: true });
  for (const r of results) {
    const body = r.bodyMarkdown === null ? `_No page was written: ${r.outcome}._` : `# ${r.title ?? ""}\n\n${r.bodyMarkdown}`;
    writeFileSync(path.join(opts.outDir, `${r.domain}.md`), `<!-- #1132 evaluation draft. Not published. -->\n\n${body}\n`);
  }
  writeFileSync(path.join(opts.outDir, "results.json"), `${JSON.stringify({ calls: ledger.rows, refusals: ledger.refusals, results }, null, 2)}\n`);
  mkdirSync(path.dirname(opts.tablePath), { recursive: true });
  writeFileSync(opts.tablePath, table(results, ledger, today));
  console.log(`\nTable: ${opts.tablePath}\nDrafts: ${opts.outDir} (gitignored)`);
  return 0;
}
