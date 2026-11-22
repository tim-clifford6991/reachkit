// The setup group: the calls a pass replay never makes alone (the site's reading calls, market inference and terms,
// question phrasing, the claim check and the page fix) run through the product's own functions on the committed
// snapshots and pipeline pages. Each answer is scored against today's model's first answer on the same input, with
// today's own repeats as the noise; question phrasing is also scored against the phrasing the report stored.
import { readFileSync } from "node:fs";
import path from "node:path";
import { inferMarketFields } from "@/lib/market/infer/infer";
import { readMarketTerms } from "@/lib/market/infer/read-terms";
import { phraseQuestions } from "@/lib/market/questions/phrase";
import { deriveProfile } from "@/lib/market/questions/profile";
import { fitCheck } from "@/lib/generate/claims/fit";
import { generatePageFix } from "@/lib/generate/pipeline/page-fix";
import { setGenerateStore } from "@/lib/generate/store";
import { DEFAULT_LOCALE } from "@/lib/locale/locales";
import { registerSiteLocaleStore } from "@/lib/locale/site";
import { OWN_FETCH_SOURCE } from "@/lib/measure/own-fetch";
import { marketEvidence } from "@/lib/scan/market-evidence";
import { readStoredReport } from "@/lib/scan/report";
import type { CostContext } from "@/lib/costs";
import { memoryStore, type PageSnapshot } from "../page/run";
import { readKnowledge } from "@/lib/site-profile/knowledge/extract";
import { deriveVoice } from "@/lib/site-profile/summary";
import { passThrough } from "./context";
import { agreement } from "./pass-site";
import type { Run } from "./transport";

export const SETUP_SITES = ["profile", "site-profile", "site-knowledge", "market-inference", "market-terms", "question-phrasing", "generate.fit_check", "generate.page_fix"] as const;
const PIPELINE_PAGES = ["documentation", "how_to", "research", "qa", "update", "listicle", "insights"];
/** Pages per site whose title and description the page fix rewrites. */
const FIX_PAGES = 2;
const SNAPSHOTS = ["scripts/page/snapshot/reachkit.app.json", ...["linear.app", "plausible.io", "pipedrive.com", "crisp.chat", "todoist.com"].map((d) => `scripts/eval-content/snapshot/${d}.json`)];
/** Pages read per site for site-knowledge, so its cost stays near one site's weekly read. */
const KNOWLEDGE_PAGES = 4;

interface Page { url: string; title?: string | null; h1?: string | null; text: string }
type Answer = { site: string; call: string; value: unknown; stored?: unknown };
type Snapshot = { domain: string; pages: Page[]; report: unknown; siteProfile?: { siteName?: string | null; products?: string[]; claims?: string[] } | null };
/** Today's first market conclusion per site: every model's terms call reads the same market. */
const markets = new Map<string, unknown>();

/** The page fix reads the page through the cache; here the cache is the snapshot's page, as plain HTML. */
function servingPages(pages: readonly Page[]): CostContext {
  const inner = passThrough();
  const html = (p: Page) => `<html><head><title>${p.title ?? ""}</title></head><body><h1>${p.h1 ?? ""}</h1><main><p>${p.text}</p></main></body></html>`;
  return {
    ...inner,
    async recordFetch(call) {
      const page = call.source === OWN_FETCH_SOURCE ? pages.find((p) => p.url === call.cacheKey) : undefined;
      if (page === undefined) return inner.recordFetch(call);
      const doc = html(page);
      return { payload: { url: page.url, status: 200, html: doc, bytes: doc.length, readAt: new Date().toISOString(), headers: {} } as never, fresh: false, costCents: 0, storedAt: null };
    },
  } as CostContext;
}

const home = (pages: readonly Page[], domain: string): Page | undefined =>
  pages.find((p) => new URL(p.url).pathname.replace(/\/$/, "") === "") ?? pages.find((p) => p.url.includes(domain));

/** One answer per committed site and setup call site, each through the product's own function. */
async function answersFor(root: string): Promise<Answer[]> {
  const out: Answer[] = [];
  // EVAL_SETUP_SITES (comma-separated domains) runs a subset, so one job stays inside its time limit.
  const only = process.env.EVAL_SETUP_SITES?.split(",").filter(Boolean);
  // EVAL_SETUP_CALLS (comma-separated call sites) evaluates only those.
  const calls = process.env.EVAL_SETUP_CALLS?.split(",").filter(Boolean);
  const wants = (site: string) => calls === undefined || calls.includes(site);
  for (const file of SNAPSHOTS.filter((f) => only === undefined || only.some((d) => f.endsWith(`/${d}.json`)))) {
    const snap = JSON.parse(readFileSync(path.join(root, file), "utf8")) as Snapshot;
    const pages = snap.pages.filter((p) => typeof p.text === "string" && p.text.length > 0);
    const front = home(pages, snap.domain);
    const pricing = pages.find((p) => /pric/i.test(p.url));
    if (front !== undefined && wants("profile")) {
      const profile = await deriveProfile(passThrough(), { home: front.text, ...(pricing === undefined ? {} : { pricing: pricing.text }) });
      out.push({ site: snap.domain, call: "profile", value: profile.kind === "unmeasured" ? null : profile.value });
    }
    if (wants("site-profile")) {
    const voice = await deriveVoice(passThrough(), { domain: snap.domain, pages: pages.map((p) => ({ url: p.url, title: p.title ?? null, h1: p.h1 ?? null, text: p.text })) as never, tier: "deep" });
    out.push({ site: snap.domain, call: "site-profile", value: voice.kind === "unmeasured" ? null : voice.value });
    }
    if (wants("site-knowledge")) {
    const read = await readKnowledge(passThrough(), { domain: snap.domain, pages: pages.slice(0, KNOWLEDGE_PAGES).map((p) => ({ url: p.url, text: p.text })), previous: { pages: [], readAt: null, demoPhrases: [] } as never });
    for (const page of read.knowledge.pages) out.push({ site: snap.domain, call: `site-knowledge ${page.url}`, value: page.reading });
    }
    const report = readStoredReport(snap.report as never);
    if (wants("market-inference") || wants("market-terms")) {
      const evidence = marketEvidence({ domain: snap.domain, siteName: snap.siteProfile?.siteName ?? null, headline: front?.h1 ?? front?.title ?? null, pages: pages.map((p) => ({ url: p.url, title: p.title ?? "", text: p.text })), products: snap.siteProfile?.products ?? [], claims: snap.siteProfile?.claims ?? [], report: report as never });
      if (wants("market-inference") || !markets.has(snap.domain)) {
        const market = await inferMarketFields(passThrough(), evidence);
        const value = market.kind === "unmeasured" ? null : market.value;
        if (wants("market-inference")) out.push({ site: snap.domain, call: "market-inference", value });
        if (!markets.has(snap.domain) && value !== null) markets.set(snap.domain, { ...value, rivals: [] });
      }
      const market = markets.get(snap.domain);
      if (wants("market-terms") && market !== undefined) {
        const terms = await readMarketTerms(passThrough(), { market: market as never, siteName: snap.siteProfile?.siteName ?? null, domain: snap.domain, at: new Date(), locale: DEFAULT_LOCALE });
        out.push({ site: snap.domain, call: "market-terms", value: terms.kind === "unmeasured" ? null : terms.value.terms.map((t) => t.term) });
      }
    }
    const asked = (report as { questions?: { kind: string; value?: { text: string; search: unknown }[] } }).questions;
    if (wants("question-phrasing") && asked?.kind === "measured" && asked.value !== undefined) {
      const phrased = await phraseQuestions(passThrough(), { selected: asked.value.map((q) => q.search) as never });
      out.push({ site: snap.domain, call: "question-phrasing", value: phrased.kind === "unmeasured" ? null : phrased.value.map((q) => q.text), stored: asked.value.map((q) => q.text) });
    }
    if (wants("generate.fit_check") && snap.domain === "reachkit.app") {
      for (const type of PIPELINE_PAGES) {
        const dir = path.join(root, "tests/fixtures/walk/pipeline-v2");
        const pack = JSON.parse(readFileSync(path.join(dir, `${type}.pack.json`), "utf8")) as { business: { name: string; domain: string; market?: unknown }; profile?: { knowledge?: unknown } };
        const markdown = readFileSync(path.join(dir, `${type}.md`), "utf8");
        const title = /^# (.+)$/m.exec(markdown)?.[1] ?? type;
        const verdict = await fitCheck(passThrough(), { title, markdown, businessName: pack.business.name, domain: pack.business.domain, knowledge: pack.profile?.knowledge as never, market: pack.business.market });
        out.push({ site: snap.domain, call: `generate.fit_check ${type}`, value: verdict.state === "unrun" ? null : verdict });
      }
    }
    if (wants("generate.page_fix")) {
      // The page fix asks the site's row for its locale; the case has no row, so none is stored and nothing is written.
      registerSiteLocaleStore({ read: async () => null, write: async () => { throw new Error("eval: no site row to write"); } });
      const others = pages.map((p) => p.title ?? "").filter(Boolean);
      for (const page of pages.filter((p) => p !== front).slice(0, FIX_PAGES)) {
        const store = memoryStore({ domain: snap.domain, pages: [], written: [] } as unknown as PageSnapshot, null as never);
        setGenerateStore(store);
        try {
          const at = new Date();
          const opportunity = { id: `eval:fix:${page.url}`, siteId: "eval", scanId: "eval", type: "fix_page", family: "fix", targetQuery: page.url, targetRef: page.url, title: page.title ?? page.url, volume: null, evidence: { family: "fix", issues: ["page_titles", "meta_descriptions"], pageUrl: page.url }, acceptance: null, fitBand: "winnable", effort: 0.2, status: "open", clusterKey: null, absorbedQueries: [], ready: true, unreadyReason: null, createdAt: at };
          const outcome = await generatePageFix(servingPages(pages), { siteId: "eval", opportunity: opportunity as never, scheduledFor: null, domain: snap.domain, doNotClaim: [], voiceText: null, otherTitles: others.filter((t) => t !== page.title) });
          const row = outcome.draftId === null ? null : await store.draftById(outcome.draftId);
          const fix = (row?.meta as { fix?: { title: string | null; description: string | null } } | undefined)?.fix ?? null;
          out.push({ site: snap.domain, call: `generate.page_fix ${page.url}`, value: fix === null ? null : { title: fix.title, description: fix.description, titleChars: fix.title?.length ?? 0, descriptionChars: fix.description?.length ?? 0, ok: outcome.ok } });
        } finally {
          setGenerateStore(null);
        }
      }
    }
  }
  return out;
}

/** `repeat` rounds of today's model, then of the candidate; one scored line per answer, `null` where none came back. */
export async function runSetup(run: Run, root: string, candidate: string | null, repeat: number, emit: (line: object) => void): Promise<void> {
  const reference = new Map<string, unknown>();
  for (const model of candidate === null ? [null] : [null, candidate]) {
    run.swap = model === null ? {} : Object.fromEntries(SETUP_SITES.map((site) => [site, model]));
    for (let r = 1; r <= repeat && run.halted === null; r++) {
      for (const a of await answersFor(root)) {
        const key = `${a.site}|${a.call}`;
        if (model === null && r === 1) reference.set(key, a.value);
        const ref = reference.get(key);
        const scored = a.value === null || ref === undefined || ref === null || (model === null && r === 1);
        const [call, page] = a.call.split(" ");
        const extra = call === "generate.page_fix" && a.value !== null ? { fix: a.value } : {};
        const stored = a.stored === undefined ? {} : { storedAgreement: a.value === null ? "not measured" : Math.round(agreement(a.value, a.stored) * 1000) / 1000 };
        emit({ site: a.site, call, page: page ?? null, model: model ?? "today", repeat: r, answered: a.value !== null, agreement: scored ? "not measured" : Math.round(agreement(a.value, ref) * 1000) / 1000, ...stored, ...extra });
      }
    }
  }
}
