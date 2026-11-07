// A stranger's first week at 0¢: each panel site's stored topics and market (`../plan/panel.ts`) are committed by
// `planFirstWeek`, and each of days 1 to 7 takes the day's pick and builds its `ContextPack` up to the write, as
// `writePage` does. Research, the model and every vendor throw, so a type that researches is built from no research,
// as the day's own catch leaves it. The site's own passages are the ones its stored prose-gate pack holds; a site with
// none has no knowledge base stored. The supply itself is not replayed: the pass that made it needs the model, so
// today's derive adds only what needs none, the questions buyers were seen asking beside the stored SERPs.
import "../../opportunities/env";
import { readFileSync, existsSync } from "node:fs";
import { afterAll, expect, it, vi } from "vitest";

vi.mock("@/lib/llm", () => ({ llm: async () => Promise.reject(new Error("week 1 asks no model")) }));

import type { SourcedFact } from "@/lib/generate/pipeline/grounding";
import { buildPack, type ContextPack } from "@/lib/generate/pipeline/pack";
import { NO_RESEARCH, storedAsk } from "@/lib/generate/pipeline/research";
import { TEMPLATES } from "@/lib/generate/templates";
import type { Language, Locale } from "@/lib/locale/locales";
import { measured } from "@/lib/measure/measured";
import { queueForDraft, restTopic, type Opportunity } from "@/lib/opportunities";
import { contentTypeOf } from "@/lib/opportunities/content-type";
import { askedOfReport, askedOnMarket, askedTopics, type AskedBeside } from "@/lib/opportunities/derive/topics";
import { queryKey } from "@/lib/opportunities/cluster";
import { pageForDay, planFirstWeek } from "@/lib/opportunities/plan";
import { setOpportunityStore, type OpportunityRow } from "@/lib/opportunities/store";
import { SHAPES } from "@/lib/locale/language";
import { brandOf } from "@/lib/market/questions/select";
import type { CanonicalDomain } from "@/lib/scan/domain";
import type { StoredReport } from "@/lib/scan/report";
import { assembleReport } from "@/lib/scan/store";
import { memoryStore, newMemoryState } from "../../opportunities/memory-store";
import { fullSections, SELECTED } from "../../scan/report/fixtures";
import { AT, panelDomains, panelSite, rowOf, SITE_ID, storedPayloads, storedSerps, type PanelSite } from "../plan/panel";

const DAY_MS = 86_400_000;
const DAYS = 7;
const fetchSpy = vi.spyOn(globalThis, "fetch");
afterAll(() => fetchSpy.mockRestore());

const listed: { sites: { domain: string; country: string; language: string }[] } = JSON.parse(readFileSync("docs/walk/panel/sites.json", "utf8"));

/** The site's stored pack from `docs/walk/prose-gate/`, where one is kept: its own passages and profile. */
function storedPack(domain: string): ContextPack | null {
  const file = `docs/walk/prose-gate/${domain}.pack.json`;
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as ContextPack) : null;
}

/** The site's report as far as the panel stores it: its searches and their stored organic SERPs. */
function reportOf(domain: string): StoredReport {
  const read = [...storedPayloads(domain).values()];
  return assembleReport(
    fullSections({
      domain: domain as CanonicalDomain,
      questions: measured(read.map(({ search }, n) => ({ id: `q${n}`, text: search, search: { ...SELECTED, keyword: search }, phrasing: "template" as const })), AT),
      serps: read.map(({ serp, at }) => measured(serp, at)),
      rivals: measured([], AT),
      aiAnswers: null,
    })
  );
}

/** Today's derive's asked topics on the market (issue 1519), as rows: unmeasured, and with no fit, which the pass's model judges live. */
function askedRows(site: PanelSite, asked: readonly AskedBeside[]): OpportunityRow[] {
  const own = [...site.profile.brandTokens, brandOf(site.domain)].map((name) => name.toLowerCase());
  const rivals = site.market.rivals.flatMap((rival) => [rival.name.toLowerCase(), brandOf(rival.domain)]);
  const taken = new Set(site.rows.map((row) => queryKey(row.target_query ?? "")));
  return askedTopics(asked, AT)
    .filter((topic) => !taken.has(queryKey(topic.query)) && askedOnMarket(topic.query, { market: site.market, own, rivals }))
    .map((topic, n) => {
      const type = SHAPES.comparison.test(topic.query) ? "comparison_page" : "keyword_page";
      const row = rowOf(site.domain, { query: topic.query, status: "open", type, fit: null, volume: null, ready: false }, site.rows.length + n);
      return { ...row, evidence: { ...(row.evidence as object), askedBeside: { term: topic.term, serpAt: topic.serpAt } } } as OpportunityRow;
    });
}

interface World {
  site: PanelSite;
  report: StoredReport;
  facts: SourcedFact[];
  profile: ContextPack["profile"];
  locale: Locale;
  name: string | null;
}

/** Stages 1 and 2 for one topic, as `writePage` runs them; a named reason where the page stops before the write. */
function packed(w: World, o: Opportunity, as?: "documentation"): string {
  const type = as ?? o.writeAs ?? contentTypeOf(o);
  if (type === null) return "pack";
  const researched = TEMPLATES[type].research;
  const research = researched || type === "offering" ? storedAsk(w.report, [o.targetQuery ?? ""]) : NO_RESEARCH;
  const rivals = w.site.market.rivals.map((rival) => rival.domain);
  const pack = buildPack({
    type,
    opportunity: o,
    site: { businessName: w.name, domain: w.site.domain, doNotClaim: [], rivals },
    category: w.site.market.category,
    market: { from: "report", category: w.site.market.category },
    byline: w.profile?.knowledge?.byline ?? w.name,
    voice: null,
    profile: w.profile,
    facts: w.facts,
    research: researched ? { ...NO_RESEARCH, ...(research.asked === undefined ? {} : { asked: research.asked }) } : research,
    report: w.report,
    sitePages: [],
    links: [],
    now: AT,
    locale: w.locale,
  });
  // Both are read live: the knowledge base is crawled and the research bought inside the day's run.
  if (w.facts.length === 0) return `no site facts stored: ${pack.type} "${o.targetQuery}"`;
  if (researched && pack.missing.length > 0) return `research runs live: ${pack.type} "${o.targetQuery}"`;
  if (pack.missing.length > 0) return `pack: ${pack.missing.join(", ")}`;
  if (pack.adds.short) return "adds";
  return `writable: ${pack.type} "${o.targetQuery}"`;
}

/** One day as `generateDayPage` runs it: the planned page, then each spare a short pack rests its topic for, then the
 *  day's own-facts page as documentation. */
const OUTCOMES = ["writable", "research runs live", "no site facts stored"] as const;
const blocked = (cell: string) => !OUTCOMES.some((outcome) => cell.startsWith(outcome));

async function day(w: World, date: string): Promise<string> {
  const tried: string[] = [];
  let first: Opportunity | null = null;
  for (let o = await pageForDay(SITE_ID, date, AT, true); o !== null; o = await pageForDay(SITE_ID, date, AT, true)) {
    if (tried.length > 0 && (o.id === first?.id || tried.length > 20)) break;
    first ??= o;
    const cell = packed(w, o);
    if (!blocked(cell)) {
      await queueForDraft(o.id);
      return tried.length === 0 ? cell : `${cell} (after ${tried.length} short)`;
    }
    tried.push(cell);
    await restTopic(o.id, AT);
  }
  if (first === null) return "no_opportunity";
  const own = packed(w, first, "documentation");
  if (own.startsWith("writable")) return `${own} (own facts, after ${tried.join("; ")})`;
  return [...new Set(tried)].join("; ");
}

it("each panel site's first week ends each day in a writable pack or a named reason, at 0¢", async () => {
  const lines = [
    "# Week 1 at 0¢, from the stored panel supply",
    "",
    "Seeded from each site's last stored panel topics and market, banded from their stored volume at a site that ranks for nothing. The pass that derives the supply needs the model and the site's pages, which the evidence does not store, so only today's asked topics are added: the People-also-ask and related searches of the stored SERPs, unjudged for fit. That asked-beside evidence is read by readiness too.",
    "Ready is today's readiness over those rows (`asked` of them are asked topics), with the reasons the rest are held. `research runs live` and `no site facts stored` are days decided inside the live run, not blocked ones.",
    "",
  ];
  const head = Array.from({ length: DAYS }, (_, n) => `Day ${n + 1}`);
  const table = [`| Site | Ready | ${head.join(" | ")} | ${OUTCOMES.join(" | ")} | blocked |`, `|---|---|${head.map(() => "---|").join("")}---|---|---|---|`];
  const totals = [0, 0, 0, 0];
  for (const domain of panelDomains()) {
    const site = panelSite(domain);
    const stored = storedPack(domain);
    const entry = listed.sites.find((each) => each.domain === domain)!;
    const w: World = {
      site,
      report: reportOf(domain),
      facts: (stored?.facts ?? []).map((fact) => ({ fact: { passage: fact.passage, url: fact.url, readAt: new Date(fact.readAt) }, sourceText: fact.passage })),
      profile: stored?.profile ?? null,
      locale: { country: entry.country, language: entry.language as Language } as Locale,
      name: stored?.business.name ?? null,
    };
    const asked = askedOfReport(w.report);
    const extra = askedRows(site, asked);
    const state = newMemoryState({ profile: site.profile, market: site.market, now: AT, asked, rows: [...site.rows, ...extra].map((row) => ({ ...row })) });
    setOpportunityStore({ ...memoryStore(state), topTenRows: async () => storedSerps(domain) });
    await planFirstWeek(SITE_ID, AT);
    const unready = new Map<string, number>();
    for (const row of state.rows) if (!row.ready) unready.set(row.unready_reason ?? "unready", (unready.get(row.unready_reason ?? "unready") ?? 0) + 1);
    const readiness = `${state.rows.length - [...unready.values()].reduce((a, b) => a + b, 0)} of ${state.rows.length} (asked ${extra.length})${[...unready].map(([reason, count]) => `, ${reason} ${count}`).join("")}`;
    const cells: string[] = [];
    for (let n = 0; n < DAYS; n++) cells.push(await day(w, new Date(AT.getTime() + n * DAY_MS).toISOString().slice(0, 10)));
    setOpportunityStore(null);
    const counts = [...OUTCOMES.map((outcome) => cells.filter((cell) => cell.startsWith(outcome)).length), cells.filter(blocked).length];
    expect(cells.every((cell) => cell !== "" && !cell.includes("unknown"))).toBe(true);
    counts.forEach((count, n) => (totals[n]! += count));
    table.push(`| ${domain} | ${readiness} | ${cells.join(" | ")} | ${counts.join(" | ")} |`);
  }
  expect(fetchSpy).not.toHaveBeenCalled();
  const [writable, live, unstored, held] = totals;
  lines.push(...table, "", `**${writable} of ${DAYS * panelDomains().length} site-days writable, ${live} research runs live, ${unstored} no site facts stored, ${held} blocked, 0 unknown.** 0¢: no vendor, model or research call was made.`, "");
  await expect(lines.join("\n")).toMatchFileSnapshot("./week1-0c.md");
});
