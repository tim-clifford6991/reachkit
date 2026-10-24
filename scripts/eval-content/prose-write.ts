// scripts/eval-content/prose-write.ts — `npm run eval:content -- --prose
// --write` (SPEC §7, issue 1390): pages written with the house rules, the
// voices and the prose check, for sites of different kinds.
//
// # What it runs
//
// For each site of `prose/proof-sites.json` — the customer panel's kinds: a
// café, a SaaS tool, an agency, a creator, a consumer app, an accountancy
// and a German bakery — the product's own write call (`writePage`), layout
// (`layoutPage`), prose check (`proseScore`, `slopless`) and, where the
// check stops the page, its one fix call (`fixPage`) told what the pipeline
// would tell it (`proseNotes`).
//
// # What it is written from
//
// A proof pack, built here and at no cost: the site's name, market and
// measured searches from its latest stored panel run (`docs/walk/panel/`),
// where it has one; sentences read off the site's own pages by a plain GET,
// as the pack's business facts; and its searches worded as questions, the
// way a related search is (`templateQuestion`). No search is bought.
//
// **It is not the whole pipeline.** The other stage-4 checks need a site's
// stored report and are not run here; `npm run page` runs all of them for a
// site with a snapshot. What this shows is what issue 1390 changed: how a
// page reads, in which voice, and what the prose check makes of it.
//
// # What it spends
//
// One write call a site and at most one fix call, on the writer tier, up to
// `--cap-cents` for the run (default 60). Each call is written to the box's
// spend log (D57). `--judge` then reads reachkit.app's stored pages against
// pages written from the same stored packs, blind, in pairs (`./judge.ts`).
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CAPS } from "@/lib/config/constants";
import { bodyWords, lengthRangeFor } from "@/lib/generate/length";
import { layoutPage, withClosing } from "@/lib/generate/pipeline/compose";
import type { ContextPack } from "@/lib/generate/pipeline/pack";
import { fixPage, writePage, type PageParts } from "@/lib/generate/pipeline/write";
import { proseFaults, proseNotes, proseScore, proseText, type ProseFault } from "@/lib/generate/rules/prose";
import { lintProse } from "@/lib/generate/rules/prose-lint";
import { splitSentences } from "@/lib/generate/rules/text";
import { TEMPLATES } from "@/lib/generate/templates";
import { chooseVoice, voiceLength } from "@/lib/generate/voice/register";
import type { Language } from "@/lib/locale/locales";
import { templateQuestion } from "@/lib/market/questions/template";
import type { ContentType } from "@/lib/opportunities/content-type";
import { proofLedger } from "../page/ledger";
import { appendSpend } from "../spend-log.mjs";
import { judgePair, type JudgeSpend, type PairVerdict } from "./judge";
import { htmlToMarkdown } from "./prose";

export interface WriteOptions {
  root: string;
  sites: readonly string[];
  capCents: number;
  judge: boolean;
}

interface ProofSite {
  domain: string;
  kind: string;
  language: Language;
  country: string;
  /** Pages of the site's own to read for its facts. */
  pages: string[];
  /** Used where no stored panel run holds the site. */
  name?: string;
  category?: string;
  type: ContentType;
  /** The page's target; absent, the site's best-fitting stored search. */
  target?: string;
  questions?: string[];
}

interface PanelSite {
  site: { domain: string };
  siteName?: string;
  market?: { category?: string; buyer?: string; job?: string; differentiators?: string[]; notOurMarket?: string[] };
  topics?: { query: string; fit: number | null; volume: number | null }[];
}

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const FACTS_MAX = 30;

/** The site's latest stored panel run, or `null` where no run holds it. */
function panelRun(root: string, domain: string): PanelSite | null {
  const dir = path.join(root, "docs/walk/panel");
  for (const file of readdirSync(dir).filter((name) => /^\d{4}-\d{2}-\d{2}.*\.json$/.test(name)).sort().reverse()) {
    const run = JSON.parse(readFileSync(path.join(dir, file), "utf8")) as { sites?: PanelSite[] };
    const held = run.sites?.find((site) => site.site.domain === domain && site.market?.category !== undefined);
    if (held !== undefined) return held;
  }
  return null;
}

/** Whole sentences of the site's own pages, each with its page. */
async function factsOf(root: string, site: ProofSite): Promise<{ passage: string; url: string; readAt: string }[]> {
  const dir = path.join(root, ".review/prose/proof");
  mkdirSync(dir, { recursive: true });
  const out: { passage: string; url: string; readAt: string }[] = [];
  const seen = new Set<string>();
  for (const url of site.pages) {
    const file = path.join(dir, `${url.replace(/[^a-z0-9]+/gi, "_").slice(0, 120)}.html`);
    let html = existsSync(file) ? readFileSync(file, "utf8") : "";
    if (html === "") {
      try {
        const answer = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(20_000) });
        html = answer.ok ? await answer.text() : "";
        if (html !== "") writeFileSync(file, html);
      } catch {
        html = "";
      }
    }
    const blocks = htmlToMarkdown(html).split(/\n{2,}/).filter((block) => !block.startsWith("## "));
    for (const block of blocks) {
      for (const sentence of splitSentences(block.replace(/^(?:[-*+]|\d+\.)\s+/gm, ""))) {
        const passage = sentence.replace(/\s+/g, " ").trim();
        const words = passage.split(" ").length;
        if (words < 7 || words > 45 || !/[.!?]$/.test(passage) || seen.has(passage)) continue;
        seen.add(passage);
        out.push({ passage, url, readAt: new Date().toISOString() });
      }
    }
  }
  return out.slice(0, FACTS_MAX);
}

function packFor(site: ProofSite, panel: PanelSite | null, facts: ContextPack["facts"]): ContextPack {
  const topics = [...(panel?.topics ?? [])].sort((a, b) => (b.fit ?? 0) - (a.fit ?? 0) || (b.volume ?? 0) - (a.volume ?? 0)).map((topic) => topic.query);
  const target = site.target ?? topics[0] ?? site.category ?? site.domain;
  const category = panel?.market?.category ?? site.category ?? "";
  const asked = site.questions ?? topics.filter((query) => query !== target).map((query) => templateQuestion(query, site.language));
  const home = `https://${site.domain}/`;
  // A site that renders in the browser yields no sentence to a plain GET:
  // what its stored market says it does differently stands in, as its own.
  const stated = facts.length > 0 ? facts : (panel?.market?.differentiators ?? []).map((passage) => ({ passage, url: home, readAt: new Date().toISOString() }));
  const question = site.type === "qa" || site.type === "how_to" || site.type === "documentation" ? templateQuestion(target, site.language) : target;
  return {
    version: 1,
    type: site.type,
    builtAt: new Date().toISOString(),
    ...(site.language === "en" && site.country === "US" ? {} : { locale: { country: site.country, language: site.language } as NonNullable<ContextPack["locale"]> }),
    target: { question: site.type === "qa" ? question : target, searches: [target] },
    business: {
      name: panel?.siteName ?? site.name ?? null,
      domain: site.domain,
      category,
      byline: panel?.siteName ?? site.name ?? null,
      voice: null,
      market:
        panel?.market === undefined
          ? { from: "report", category }
          : { from: "site", category, buyer: panel.market.buyer ?? null, job: panel.market.job ?? null, rivals: [], notOurMarket: panel.market.notOurMarket ?? [] },
      rivals: [],
    },
    profile: null,
    neverClaim: [],
    facts: stated,
    claims: [],
    products: [],
    pages: [],
    links: [{ url: home, label: panel?.siteName ?? site.name ?? site.domain, purpose: "product" }],
    questions: asked.slice(0, 8),
    voice: chooseVoice({ setting: null, voiceText: null, category, question, type: site.type, language: site.language }),
    measurements: null,
    live: null,
    adds: { claims: [], short: false },
    missing: [],
  };
}

interface Checked {
  markdown: string;
  title: string;
  faults: ProseFault[];
}

async function checked(parts: PageParts, pack: ContextPack): Promise<Checked> {
  const laid = layoutPage(parts, TEMPLATES[pack.type], {
    facts: pack.facts.map((fact) => fact.passage),
    promises: [],
    queries: pack.target.searches,
    names: [pack.business.name ?? "", pack.business.domain.split(".")[0] ?? ""],
    sources: pack.facts.map((fact) => ({ passage: fact.passage, url: fact.url })),
  });
  const markdown = withClosing(laid.body.bodyMarkdown, laid.closing, pack.links[0]?.url ?? `https://${pack.business.domain}/`);
  const language = pack.locale?.language ?? "en";
  const passages = pack.facts.map((fact) => fact.passage);
  const flagged = language === "en" ? await lintProse(proseText(markdown, passages)) : [];
  const score = proseScore(markdown, { language, passages, subjects: [...pack.target.searches, pack.business.name ?? ""].filter(Boolean), flagged });
  return { markdown, title: laid.body.title, faults: proseFaults(score) };
}

export async function main(options: WriteOptions): Promise<number> {
  const all = (JSON.parse(readFileSync(path.join(options.root, "scripts/eval-content/prose/proof-sites.json"), "utf8")) as { sites: ProofSite[] }).sites;
  const sites = options.sites.length === 0 ? all : all.filter((site) => options.sites.includes(site.domain));
  const outDir = path.join(options.root, "docs/walk/prose-gate");
  mkdirSync(outDir, { recursive: true });
  const ledger = proofLedger(options.capCents, 0, "prose-proof");
  const runFile = path.join(outDir, "run.json");
  const runs: Record<string, unknown>[] = existsSync(runFile) ? (JSON.parse(readFileSync(runFile, "utf8")) as Record<string, unknown>[]) : [];

  let at = 0;
  for (const site of options.judge ? [] : sites) {
    at++;
    if (ledger.headroomCents() < CAPS.DRAFT_C / 3) {
      console.log(`${site.domain}: not started, the run's cap is near (${ledger.spentCents().toFixed(1)}¢ of ${options.capCents}¢).`);
      continue;
    }
    const cost = ledger.contextFor(at);
    const pack = packFor(site, panelRun(options.root, site.domain), await factsOf(options.root, site));
    const template = TEMPLATES[pack.type];
    const writing = { template, pack, pageType: null, length: lengthRangeFor(template, { questions: pack.questions.length, cap: voiceLength(pack.voice)?.ceiling }) ?? { floor: 600, ceiling: 1500 } };
    const written = await writePage(cost, writing);
    if (written.kind === "unmeasured") {
      console.log(`${site.domain}: the write call did not answer (${written.reason}).`);
      continue;
    }
    const first = await checked(written.value, pack);
    let last = first;
    let fixed = false;
    if (first.faults.length > 0) {
      const again = await fixPage(cost, { ...writing, parts: written.value, fix: [{ rule: "plain_prose", sentences: proseNotes(first.faults) }] });
      if (again.kind !== "unmeasured") {
        fixed = true;
        last = await checked(again.value, pack);
      }
    }
    writeFileSync(path.join(outDir, `${site.domain}.md`), `# ${last.title}\n\n${last.markdown}\n`);
    writeFileSync(path.join(outDir, `${site.domain}.pack.json`), `${JSON.stringify(pack, null, 2)}\n`);
    const row = {
      site: site.domain,
      kind: site.kind,
      type: pack.type,
      target: pack.target.question,
      voice: pack.voice,
      facts: pack.facts.length,
      questions: pack.questions.length,
      words: bodyWords(last.markdown),
      asWritten: first.faults.map((fault) => `${fault.tell} ${fault.count}`),
      fixCall: fixed,
      afterFix: fixed ? last.faults.map((fault) => `${fault.tell} ${fault.count}`) : null,
      outcome: last.faults.length === 0 ? "passes" : "held",
      cents: Math.round(cost.spentCents() * 100) / 100,
      at: new Date().toISOString(),
    };
    runs.splice(0, runs.length, ...runs.filter((each) => each.site !== site.domain), row);
    writeFileSync(runFile, `${JSON.stringify(runs, null, 2)}\n`);
    console.log(JSON.stringify(row));
  }

  if (options.judge) await judgeStored(options, ledger, outDir);
  console.log(`\nspent ${ledger.spentCents().toFixed(2)}¢ of ${options.capCents}¢ → ${path.relative(options.root, outDir)}`);
  return 0;
}

/** reachkit.app's stored pages against pages written now from the same
 *  stored packs (`docs/walk/pipeline-v2/`), read blind, in pairs. */
async function judgeStored(options: WriteOptions, ledger: ReturnType<typeof proofLedger>, outDir: string): Promise<void> {
  const from = path.join(options.root, "docs/walk/pipeline-v2");
  const verdicts: Record<string, unknown>[] = [];
  let judged = 0;
  const spend: JudgeSpend = {
    guard(reserveCents) {
      if (ledger.spentCents() + judged + reserveCents > options.capCents) throw new Error("the run's cap is met");
    },
    record(call) {
      judged += call.cents;
      appendSpend({ script: "prose-proof", source: "llm", cents: call.cents });
    },
  };
  let draft = 100;
  for (const type of ["how_to", "qa", "documentation"] as const) {
    const cost = ledger.contextFor(draft++);
    const stored = JSON.parse(readFileSync(path.join(from, `${type}.pack.json`), "utf8")) as ContextPack;
    const pack: ContextPack = {
      ...stored,
      voice: chooseVoice({ setting: null, voiceText: stored.business.voice, category: stored.business.category, question: stored.target.question, type: stored.type, language: "en" }),
    };
    const template = TEMPLATES[pack.type];
    const writing = { template, pack, pageType: null, length: lengthRangeFor(template, { questions: pack.questions.length, cap: voiceLength(pack.voice)?.ceiling }) ?? { floor: 600, ceiling: 1500 } };
    const written = await writePage(cost, writing);
    if (written.kind === "unmeasured") continue;
    let page = await checked(written.value, pack);
    const asWritten = page.faults.map((fault) => `${fault.tell} ${fault.count}`);
    if (page.faults.length > 0) {
      const again = await fixPage(cost, { ...writing, parts: written.value, fix: [{ rule: "plain_prose", sentences: proseNotes(page.faults) }] });
      if (again.kind !== "unmeasured") page = await checked(again.value, pack);
    }
    writeFileSync(path.join(outDir, `reachkit.app-${type}.md`), `# ${page.title}\n\n${page.markdown}\n`);
    // The stored file prints the page's buyer questions under a rule; the
    // page is what stands above it, as the new one is.
    const old = readFileSync(path.join(from, `${type}.md`), "utf8").split(/\n---\n/)[0]!;
    const judgedPage = (id: string, title: string, body: string) => ({ id, search: pack.target.searches[0] ?? pack.target.question, title, body, resultClaims: pack.claims.map((claim) => claim.passage).slice(0, 12) });
    let verdict: PairVerdict | null = null;
    try {
      verdict = await judgePair(spend, {
        today: new Date().toISOString().slice(0, 10),
        business: pack.business.name ?? pack.business.domain,
        domain: pack.business.domain,
        businessFacts: pack.facts.map((fact) => fact.passage),
        first: judgedPage("stored", /^# (.*)$/m.exec(old)?.[1] ?? "", old.replace(/^# .*$/m, "")),
        second: judgedPage("new", page.title, page.markdown),
        held: [],
      });
    } catch (error) {
      console.log(`${type}: not judged (${String(error).slice(0, 80)})`);
    }
    const row = { type, voice: pack.voice, asWritten, afterFix: page.faults.map((fault) => `${fault.tell} ${fault.count}`), pick: verdict?.pick ?? null, winRate: verdict?.winRate ?? null, why: verdict?.readings.map((reading) => reading.why) ?? [] };
    verdicts.push(row);
    console.log(JSON.stringify(row));
  }
  writeFileSync(path.join(outDir, "judge.json"), `${JSON.stringify({ at: new Date().toISOString(), judgeCents: Math.round(judged * 100) / 100, verdicts }, null, 2)}\n`);
}
