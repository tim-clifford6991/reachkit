// scripts/page/run.ts — `npm run page` (SPEC §7, D43): one page, through the
// product's own five stages, from a site's production data.
//
// # What it reads
//
// `scripts/page/snapshot/<domain>.json` is the site's production rows as one
// file — this box's database key is a placeholder, so they are exported
// through the Supabase connector:
//
//   * `report`, `scan`, `siteProfile`, `site`, `market`, `pages` — as
//     `scripts/eval-content/snapshot.ts` describes them;
//   * `knowledge` — `site_profiles.knowledge` and the founder's answers
//     (`business_edits.answers`), where the site has them;
//   * `written` — the pages ReachKit wrote for the site that are live
//     (`drafts` in `published`): title, address, type, question and text.
//
// # What it does
//
//   1. **Decide**: `--type` names the type; `--topic` names the question,
//      else the snapshot's first live page for an update and the type's own
//      default topic otherwise.
//   2. **Context pack**: the research step runs live (its reads, its one
//      search, at most two model calls) and the pack is built by the
//      product's `buildPack`, then cached under `.review/page/packs/`. A
//      rerun reuses it unless `--fresh`.
//   3–4. **Write and check**: the product's `generateDraft`, against an
//      in-memory store. Nothing reaches a database or a destination.
//
// It prints the page's path, each check's result and the cost, and writes
// the page as Markdown and its pack as JSON under `--out`.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CAPS, EFFORT_BY_TYPE, RESEARCH } from "@/lib/config/constants";
import { bodyWords } from "@/lib/generate/length";
import { clusterLinkTargets, siteLinkTargets } from "@/lib/generate/links/select";
import { generateDraft, targetSearches, type GenerateOutcome } from "@/lib/generate/pipeline";
import { allowedFacts, readAllFacts } from "@/lib/generate/pipeline/grounding";
import { buildPack, missingFrom, type ContextPack } from "@/lib/generate/pipeline/pack";
import { NO_RESEARCH, researchMarket, type MarketResearch } from "@/lib/generate/pipeline/research";
import { readRecordedRules, readRecordedVerdict } from "@/lib/generate/record";
import { HARD_RULES } from "@/lib/generate/rules/types";
import { setGenerateStore, type DraftInsert, type DraftPatch, type DraftRow, type GenerateStore } from "@/lib/generate/store";
import { TEMPLATES } from "@/lib/generate/templates";
import { writingMarket } from "@/lib/generate/voice/market";
import { promptProfile } from "@/lib/generate/voice/profile-block";
import { parseStoredMarket } from "@/lib/market/infer/stored";
import { measured } from "@/lib/measure/measured";
import { CONTENT_TYPES, type ContentType } from "@/lib/opportunities/content-type";
import type { Opportunity, OpportunityType } from "@/lib/opportunities/types";
import { readStoredReport } from "@/lib/scan/report";
import { confirmedProfile } from "@/lib/site-profile/business/confirm";
import { NO_EDITS } from "@/lib/site-profile/business/types";
import { knowledgeBase } from "@/lib/site-profile/knowledge/merge";
import type { FounderAnswers, StoredKnowledge } from "@/lib/site-profile/knowledge/types";
import { inventoryOf, type Snapshot } from "../eval-content/snapshot";
import { proofLedger } from "./ledger";
import { servePages } from "./measured-text";

export interface Options {
  root: string;
  site: string;
  type: string;
  topic: string | null;
  fresh: boolean;
  outDir: string;
  capCents: number;
}

/** A site's production rows, as `npm run page` reads them. */
export interface PageSnapshot extends Snapshot {
  knowledge?: { stored: StoredKnowledge; answers: FounderAnswers };
  written?: { title: string; url: string; type: OpportunityType; question: string | null; markdown: string }[];
}

interface CachedPack {
  pack: ContextPack;
  research: MarketResearch;
  researchCents: number;
}

const SITE_ID = "00000000-0000-4000-8000-000000000001";
const cents = (n: number): string => `${n.toFixed(2)}¢`;
const slugOf = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

/** The opportunity type a tested page is written as: an update refreshes a
 *  live page, every other type is a new page for its question. */
const OPPORTUNITY_TYPE: Readonly<Record<ContentType, OpportunityType>> = {
  listicle: "listed_page",
  how_to: "keyword_page",
  documentation: "keyword_page",
  research: "keyword_page",
  qa: "answer_page",
  insights: "keyword_page",
  update: "refresh_page",
};

function memoryStore(snapshot: PageSnapshot, report: ReturnType<typeof readStoredReport>): GenerateStore {
  const rows = new Map<string, DraftRow>();
  let next = 0;
  return {
    async siteFacts() {
      return null;
    },
    async latestReport() {
      return report;
    },
    async insertDraft(row: DraftInsert) {
      next += 1;
      const id = `${snapshot.domain}-${next}`;
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
      return id;
    },
    async patchDraft(draftId: string, patch: DraftPatch) {
      const existing = rows.get(draftId);
      if (existing !== undefined) rows.set(draftId, { ...existing, ...patch } as DraftRow);
    },
    async draftById(draftId: string) {
      return rows.get(draftId) ?? null;
    },
    async publishedPages() {
      return (snapshot.written ?? []).map((page) => ({ ref: page.url, title: page.title, markdown: page.markdown }));
    },
    async queuedPages() {
      return [];
    },
    // One site at a time: there is no other customer's page to compare with.
    async pagesElsewhere() {
      return [];
    },
    async draftsShortOfHandOff() {
      return [];
    },
    async countShortOfHandOff() {
      return 0;
    },
    async siteInventory() {
      return inventoryOf(snapshot);
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

function describe(outcome: GenerateOutcome): string {
  if (outcome.ok) return "passed";
  if (outcome.reason === "rules") return `stopped by: ${outcome.failed.map((failure) => failure.rule).join(", ")}`;
  if (outcome.step === "pack") return `not written — the pack is short of: ${(outcome.missing ?? []).join(", ")}`;
  if (outcome.step === "adds") return "not written — the pack adds too little the top results do not say";
  return `step failed: ${outcome.step}`;
}

export async function main(opts: Options): Promise<number> {
  const type = CONTENT_TYPES.find((known) => known === opts.type);
  if (type === undefined) throw new Error(`--type must be one of ${CONTENT_TYPES.join(", ")}.`);
  const file = path.join(opts.root, "scripts/page/snapshot", `${opts.site}.json`);
  if (!existsSync(file)) throw new Error(`No production export for ${opts.site} at ${file}. scripts/page/run.ts says how one is taken.`);
  const snapshot = JSON.parse(readFileSync(file, "utf8")) as PageSnapshot;
  const report = readStoredReport(snapshot.report);
  if (report.market.kind === "unmeasured") throw new Error(`${opts.site}: its report holds no market reading.`);

  const template = TEMPLATES[type];
  const profile = report.market.value.profile;
  // The market in force (`sites.market`, issue 1248), as the product reads it.
  const writingFor = writingMarket({
    site:
      snapshot.market === undefined
        ? null
        : {
            category: (snapshot.site as { category?: string | null } | null)?.category ?? null,
            competitors: (snapshot.site as { competitors?: string[] } | null)?.competitors ?? [],
            stored: parseStoredMarket(snapshot.market),
          },
    reportCategory: profile.category,
  });
  const category = writingFor.category;
  const rivals =
    writingFor.market?.rivals.map((rival) => rival.domain) ??
    (report.rivals.kind === "unmeasured" ? [] : report.rivals.value.map((rival) => rival.domain));
  const businessName = profile.brandTokens[0] ?? snapshot.siteProfile?.siteName ?? opts.site;

  // 1. Decide.
  const live = type === "update" ? ((snapshot.written ?? []).find((page) => opts.topic === null || page.question === opts.topic) ?? null) : null;
  const topic =
    opts.topic ??
    live?.question ??
    { listicle: `best ${category} tools`, how_to: `how to choose ${category}`, documentation: `what is ${category}`, research: `${category} statistics`, qa: `${category} questions`, insights: `${category} news`, update: "" }[type];
  const at = report.verdict.measuredAt;
  const opportunityType = OPPORTUNITY_TYPE[type];
  const volume = measured(0, at);
  const opportunity = {
    id: `${report.scanId}:page:${type}`,
    siteId: SITE_ID,
    scanId: report.scanId,
    type: opportunityType,
    family: type === "update" ? "improve" : type === "listicle" ? "earn" : "write",
    targetQuery: topic,
    targetRef: live?.url ?? slugOf(topic),
    title: live?.title ?? topic,
    volume,
    evidence: { family: type === "update" ? "improve" : "write", query: topic, volume },
    acceptance: { form: "top20", query: topic },
    fitBand: "winnable",
    effort: (EFFORT_BY_TYPE as Record<string, number>)[opportunityType] ?? 0.5,
    status: "open",
    clusterKey: null,
    absorbedQueries: [],
    ready: true,
    unreadyReason: null,
    createdAt: at,
  } as unknown as Opportunity;

  const inventory = inventoryOf(snapshot);
  const pages = snapshot.pages.map((page) => ({ url: page.url, text: page.text, measuredAt: new Date(page.readAt) }));
  const site = { businessName, domain: opts.site, doNotClaim: snapshot.site?.doNotClaim ?? [], rivals };
  const store = memoryStore(snapshot, report);
  setGenerateStore(store);
  servePages({ siteId: SITE_ID, domain: opts.site, pages });

  // The product's own ceiling bounds the calls; `--cap-cents` is what the
  // page's actual spend is held against when the run reports.
  const ledger = proofLedger(CAPS.DRAFT_C);
  const cost = ledger.contextFor(1);
  const started = Date.now();
  try {
    const facts = allowedFacts(await readAllFacts({ siteId: SITE_ID, scanId: report.scanId, target: topic }), []);
    const links = [
      ...siteLinkTargets({ domain: opts.site, inventory, query: topic, selfUrl: live?.url ?? null }),
      ...clusterLinkTargets([]),
    ];

    // 2. The context pack, cached on disk.
    const packFile = path.join(opts.root, ".review/page/packs", `${opts.site}.${type}.${slugOf(topic)}.json`);
    let cached: CachedPack | null = !opts.fresh && existsSync(packFile) ? (JSON.parse(readFileSync(packFile, "utf8")) as CachedPack) : null;
    if (cached === null) {
      const research = !template.research
        ? NO_RESEARCH
        : await researchMarket(cost, {
            siteId: SITE_ID,
            domain: opts.site,
            searches: targetSearches(opportunity),
            report,
            rivals,
            today: new Date(),
            ...(type === "insights" ? { recent: { market: category, days: RESEARCH.recentDays } } : {}),
          });
      const pack = buildPack({
        type,
        opportunity,
        site,
        category,
        market: writingFor.market === null ? { from: "report", category } : { from: "site", ...writingFor.market },
        byline: snapshot.knowledge?.answers.byline ?? businessName,
        voice: snapshot.site?.voiceText ?? null,
        profile: promptProfile(
          confirmedProfile({
            profile:
              snapshot.siteProfile === null
                ? null
                : {
                    domain: opts.site,
                    siteName: snapshot.siteProfile.siteName,
                    products: snapshot.siteProfile.products,
                    claims: snapshot.siteProfile.claims,
                    voice: snapshot.siteProfile.voice,
                    inventory,
                    pagesRead: inventory.length,
                    refreshedAt: new Date(snapshot.scan.finishedAt),
                  },
            market: profile,
            edits: NO_EDITS,
          }),
          snapshot.knowledge === undefined ? null : knowledgeBase(snapshot.knowledge)
        ),
        facts,
        research,
        report,
        sitePages: (snapshot.written ?? [])
          .filter((page) => page.url !== live?.url)
          .map((page) => ({ title: page.title, question: page.question, url: page.url, kind: null, status: "published" as const })),
        links,
        live: live === null ? null : { url: live.url, title: live.title, markdown: live.markdown, why: "age" },
        now: new Date(),
      });
      cached = { pack, research, researchCents: ledger.spentCents() };
      mkdirSync(path.dirname(packFile), { recursive: true });
      writeFileSync(packFile, `${JSON.stringify(cached, null, 1)}\n`);
    }
    // What a cached pack lacks is read again: the pack is data, the reading
    // of it is the code's.
    const pack = { ...cached.pack, missing: missingFrom(cached.pack) };

    // 3–4. Write and check.
    const outcome = await generateDraft(cost, {
      siteId: SITE_ID,
      opportunity,
      scheduledFor: new Date().toISOString().slice(0, 10),
      site,
      pack,
      facts,
      links,
      demoPhrases: snapshot.pages.flatMap((page) => (page as { examples?: string[] }).examples ?? []),
      startedAt: Date.now(),
    });
    const row = outcome.draftId === null ? null : await store.draftById(outcome.draftId);

    mkdirSync(opts.outDir, { recursive: true });
    const pageFile = path.join(opts.outDir, `${type}.md`);
    const meta = (row?.meta ?? {}) as { faq?: { question: string; answer: string }[]; description?: string; length?: { words: number }; repairs?: unknown[] };
    const calls = ledger.rows.filter((call) => call.costCents > 0).map((call) => `${call.source} ${cents(call.costCents)}`).join(" · ");
    const spent = ledger.spentCents();
    if (row !== null && row.body_md !== null) {
      const faq = meta.faq ?? [];
      writeFileSync(
        pageFile,
        [
          `# ${row.title ?? topic}`,
          "",
          `*${pack.business.byline ?? businessName}*`,
          "",
          row.body_md.trim(),
          ...(faq.length === 0
            ? []
            : ["", "---", "", "*Buyer questions, stored with the page (`drafts.meta.faq`):*", "", ...faq.flatMap((entry) => [`**${entry.question}**`, "", entry.answer, ""])]),
        ]
          .join("\n")
          .trimEnd() + "\n"
      );
    }
    writeFileSync(path.join(opts.outDir, `${type}.pack.json`), `${JSON.stringify(pack, null, 1)}\n`);

    const failures = readRecordedRules(row?.rule_failures ?? null);
    const claim = readRecordedVerdict(row?.claim_check ?? null);
    const failed = new Set((failures ?? []).map((failure) => failure.rule));
    console.log(`\n# ${opts.site} · ${type} · “${topic}”\n`);
    console.log(`page    ${row?.body_md == null ? "(not written)" : path.relative(opts.root, pageFile)}`);
    console.log(`pack    ${path.relative(opts.root, path.join(opts.outDir, `${type}.pack.json`))} — ${pack.facts.length} business facts, ${pack.claims.length} market claims, ${pack.products.length} rivals read${cached.researchCents === ledger.spentCents() && ledger.rows.length === 0 ? " (cached)" : ""}`);
    console.log(`outcome ${describe(outcome)}`);
    if (row?.body_md != null) console.log(`words   ${bodyWords(row.body_md)} (template: ${"floor" in template.length ? `${template.length.floor}–${template.length.ceiling}` : "within 20% of the live page"})`);
    console.log("\nchecks");
    for (const rule of HARD_RULES) {
      const state =
        failures === null
          ? "not run"
          : rule === "do_not_claim"
            ? claim === null
              ? "not run"
              : claim.state
            : rule === "fit_claim" && type !== "listicle"
              ? "skipped (D44: listicle only)"
              : failed.has(rule)
                ? `FAILED ${JSON.stringify((failures ?? []).find((failure) => failure.rule === rule)?.detail ?? {})}`
                : "passed";
      console.log(`  ${rule.padEnd(26)} ${state}`);
    }
    if ((meta.repairs ?? []).length > 0) console.log(`\nrepairs ${JSON.stringify(meta.repairs)}`);
    const whole = spent + (ledger.rows.some((call) => call.source === "generate.research") ? 0 : cached.researchCents);
    console.log(`\ncost    ${cents(spent)} this run; ${cents(whole)} with its pack's research — ${whole <= opts.capCents ? "inside" : "OVER"} the ${cents(opts.capCents)} a page (CAPS.DRAFT_C ${cents(CAPS.DRAFT_C)})`);
    console.log(`calls   ${calls === "" ? "none" : calls}`);
    console.log(`time    ${Math.round((Date.now() - started) / 1000)}s`);
    const state = { type, topic, outcome: describe(outcome), cents: spent, words: row?.body_md == null ? 0 : bodyWords(row.body_md), calls: ledger.rows.length, at: new Date().toISOString() };
    writeFileSync(path.join(opts.outDir, `${type}.run.json`), `${JSON.stringify(state, null, 1)}\n`);
    return outcome.ok ? 0 : 2;
  } finally {
    setGenerateStore(null);
    servePages(null);
  }
}
