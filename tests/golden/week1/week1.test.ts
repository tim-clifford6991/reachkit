// A stranger's first week at 0¢: each panel site's stored topics and market (`../plan/panel.ts`) are committed by
// `planFirstWeek`, and each of days 1 to 7 takes the day's pick and builds its `ContextPack` up to the write, as
// `writePage` does. Research, the model and every vendor throw, so a type that researches is built from no research,
// as the day's own catch leaves it. The site's own passages are the ones its stored prose-gate pack holds; a site with
// none has no knowledge base stored. The supply itself is not replayed: the pass that made it needs the model.
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
import { pageForDay, planFirstWeek } from "@/lib/opportunities/plan";
import { setOpportunityStore } from "@/lib/opportunities/store";
import type { CanonicalDomain } from "@/lib/scan/domain";
import type { StoredReport } from "@/lib/scan/report";
import { assembleReport } from "@/lib/scan/store";
import { memoryStore, newMemoryState } from "../../opportunities/memory-store";
import { fullSections, SELECTED } from "../../scan/report/fixtures";
import { AT, panelDomains, panelSite, SITE_ID, storedPayloads, storedSerps, type PanelSite } from "../plan/panel";

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
  if (w.facts.length === 0) return "no_own_facts";
  if (pack.missing.length > 0) return `${researched ? "research needed" : "pack"}: ${pack.missing.join(", ")}`;
  if (pack.adds.short) return "adds";
  return `writable: ${pack.type} "${o.targetQuery}"`;
}

/** One day as `generateDayPage` runs it: the planned page, then each spare a short pack rests its topic for, then the
 *  day's own-facts page as documentation. */
async function day(w: World, date: string): Promise<string> {
  const tried: string[] = [];
  let first: Opportunity | null = null;
  for (let o = await pageForDay(SITE_ID, date, AT, true); o !== null; o = await pageForDay(SITE_ID, date, AT, true)) {
    if (tried.length > 0 && (o.id === first?.id || tried.length > 20)) break;
    first ??= o;
    const cell = packed(w, o);
    if (cell.startsWith("writable")) {
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
    "Seeded from each site's last stored panel topics and market. The supply itself is not replayed at 0¢: the pass that derives it needs the model and the site's pages, which the evidence does not store.",
    "Ready is today's readiness over the stored topics, with the reasons the rest are held. The stored topics keep no asked-beside, composed or tracked-prompt evidence, so `no_intent` may hold rows a fresh pass would not.",
    "",
  ];
  const head = Array.from({ length: DAYS }, (_, n) => `Day ${n + 1}`);
  const table = [`| Site | Ready | ${head.join(" | ")} | Writable | Named |`, `|---|---|${head.map(() => "---|").join("")}---|---|`];
  let writable = 0;
  let named = 0;
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
    const state = newMemoryState({ profile: site.profile, market: site.market, now: AT, rows: site.rows.map((row) => ({ ...row })) });
    setOpportunityStore({ ...memoryStore(state), topTenRows: async () => storedSerps(domain) });
    await planFirstWeek(SITE_ID, AT);
    const unready = new Map<string, number>();
    for (const row of state.rows) if (!row.ready) unready.set(row.unready_reason ?? "unready", (unready.get(row.unready_reason ?? "unready") ?? 0) + 1);
    const readiness = `${state.rows.length - [...unready.values()].reduce((a, b) => a + b, 0)} of ${state.rows.length}${[...unready].map(([reason, count]) => `, ${reason} ${count}`).join("")}`;
    const cells: string[] = [];
    for (let n = 0; n < DAYS; n++) cells.push(await day(w, new Date(AT.getTime() + n * DAY_MS).toISOString().slice(0, 10)));
    setOpportunityStore(null);
    const ok = cells.filter((cell) => cell.startsWith("writable")).length;
    expect(cells.every((cell) => cell !== "" && !cell.includes("unknown"))).toBe(true);
    writable += ok;
    named += cells.length - ok;
    table.push(`| ${domain}${stored === null ? " (no own passages stored)" : ""} | ${readiness} | ${cells.join(" | ")} | ${ok} | ${cells.length - ok} |`);
  }
  expect(fetchSpy).not.toHaveBeenCalled();
  lines.push(...table, "", `**${writable} of ${writable + named} site-days writable, ${named} named, 0 unknown.** 0¢: no vendor, model or research call was made.`, "");
  await expect(lines.join("\n")).toMatchFileSnapshot("./week1-0c.md");
});
