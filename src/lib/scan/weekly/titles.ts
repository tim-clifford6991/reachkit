// SPEC §6 *Every topic is an angle*: every page a committed week holds has a title. A new page the fit call gave no
// angle (a fit of 2, a top-up, a row held from an earlier pass), or whose stored title fails today's checks, is asked in one batched call on the fit call's tier,
// in a context of its own from the week's one sum, `CAPS.WEEK_C`, beside the titles the
// commit's research already read for each search, at 0¢; an update shows its live page's own title, at 0¢. A search
// whose every angle fails is asked once more with its failed gates named, then its angles repaired, then titled as its
// own words in Title Case: a title gate ranks and never leaves a row untitled. A call that does not answer leaves its
// rows to the site's next daily run.
import { z } from "zod";
import { withCostContext, type CostContext } from "@/lib/costs";
import { DRAFT_POLICY_VERSION } from "@/lib/generate/cost";
import { llm } from "@/lib/llm";
import { siteLocale } from "@/lib/locale/site";
import { researchSerps } from "@/lib/generate/pipeline/research";
import type { Locale } from "@/lib/locale/locales";
import { ANGLE_ASK, ANGLE_PATTERNS, angleGates, casedTitle, pickAngle, repairedAngle, type AngleContext, type ProposedAngle } from "@/lib/market/questions/angle";
import { plannedTitleFaults } from "@/lib/generate/rules/title";
import { canonicalUrl } from "@/lib/measure/page-reading";
import { queryKey, topTenRowsOf } from "@/lib/opportunities/cluster";
import { addressKey, ownLivePages } from "@/lib/opportunities/refresh";
import { opportunityStore, readOpportunity, type OpportunityRow } from "@/lib/opportunities/store";
import { readScanReport, type StoredReport } from "@/lib/scan/report";
import { cachedSerp } from "@/lib/vendors/dataforseo/serp";

const SCHEMA = z.strictObject({
  titles: z.array(
    z.strictObject({
      i: z.number().int(),
      angles: z.array(z.strictObject({ pattern: z.enum(ANGLE_PATTERNS), title: z.string(), promise: z.string(), fact: z.number().int().nullable() })),
    })
  ),
});

const TASK = [`Each of \`searches\` is a page this business will write this week. For each, give \`angles\`: ${ANGLE_ASK.pages}`, ANGLE_ASK.title].join(" ");
const RETRY = [
  TASK,
  "Each search's `rejected` angles failed the `gates` named: term, it does not lead with the search's main noun phrase; banned, a hype word, a trope or a word said twice; claim, a clause about this business after the search's words, with or without a break; promise_figure, a price leading a page not about price; pattern, the pattern does not fit the search; names, it names what no source writes; rival, it names a rival the search does not; restates, it adds nothing to the search; fact, its passage was not shown. Give new angles that pass them.",
].join(" ");

/** Titles the open rows of the site's committed week that have none, or a new page's that fails today's title checks,
 *  from `scanId`'s report (else its latest paid pass's); how many it titled. Never throws. */
export async function titleWeek(siteId: string, scanId?: string): Promise<number> {
  try {
    const store = opportunityStore();
    // A new page's stored title is read again in `angleTitles`: a title planned by older rules would be published as it stands.
    const rows = (await store.plannedRows(siteId)).filter((row) => row.status === "open" && ((row.title ?? "").trim() === "" || row.family === "write" || row.family === "earn"));
    if (rows.length === 0) return 0;
    const at = scanId ?? (await latestPass(siteId));
    const report = at === null ? null : await readScanReport(at);
    if (at === null || report === null) return 0;
    let titled = await liveTitles(siteId, report.domain, rows.filter((row) => row.family === "improve" && (row.title ?? "").trim() === ""));
    const pages = rows.filter((row) => row.family === "write" || row.family === "earn");
    const spend = { scanId: at, cap: "WEEK", policyVersion: DRAFT_POLICY_VERSION, rollUp: "none", activity: "weekly" } as const;
    if (pages.length > 0) titled += await withCostContext(spend, (c) => angleTitles(c, siteId, pages, report));
    console.log(JSON.stringify({ event: "week_titled", siteId, untitled: rows.length, titled }));
    return titled;
  } catch (error) {
    console.warn(JSON.stringify({ event: "week_titles_failed", siteId, detail: String(error).slice(0, 200) }));
    return 0;
  }
}

/** An update's title is its live page's: ReachKit's own version, else the crawl's read of the site's page. 0¢. */
async function liveTitles(siteId: string, domain: string, rows: readonly OpportunityRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const store = opportunityStore();
  const own = new Map((await ownLivePages(siteId)).map((page) => [addressKey(page.url), (page.title ?? "").trim()]));
  const crawled = new Map((await store.inventoryFor(domain)).map((page) => [canonicalUrl(page.url), (page.title || page.h1).trim()]));
  let titled = 0;
  for (const row of rows) {
    const title = own.get(addressKey(row.target_ref)) || crawled.get(canonicalUrl(row.target_ref)) || "";
    if (title === "") continue;
    await store.setEvidence(row.id, readOpportunity(row).evidence, title);
    titled += 1;
  }
  return titled;
}

/** One call for the week's new pages untitled or titled by older rules (`staleTitle`), and one more for the searches it
 *  kept no angle for; each keeps the angle `pickAngle` keeps, stored as the fit call's is, else a repaired one, else its
 *  search in Title Case. */
async function angleTitles(c: CostContext, siteId: string, rows: readonly OpportunityRow[], report: StoredReport): Promise<number> {
  const store = opportunityStore();
  const [{ market, knowledge }, locale] = await Promise.all([store.marketFor(siteId), siteLocale(siteId)]);
  const profile = report.market.kind === "unmeasured" ? null : report.market.value.profile;
  if (market === null && profile === null) return 0;
  const ranked = topTenRowsOf(report);
  const all = await Promise.all(
    rows.map(async (row) => {
      const query = row.target_query ?? "";
      const stored = (ranked.get(queryKey(query))?.rows ?? []).map((top) => top.title);
      return { row, query, ranks: (stored.length > 0 ? stored : await researchTitles(siteId, locale, query)).slice(0, 5) };
    })
  );
  const rivals = market?.rivals.flatMap((rival) => [rival.name, rival.domain]) ?? [];
  const sources = [...(knowledge ?? []).map((passage) => passage.text), report.domain, ...rivals];
  const context = (search: (typeof all)[number]): AngleContext => ({ search: search.query, sources, ranks: search.ranks, rivals, language: locale.language, ...(knowledge == null ? {} : { passages: knowledge.length }) });
  const searches = all.filter((search) => staleTitle(search.row.title ?? "", context(search)));
  if (searches.length === 0) return 0;
  const ask = (task: string, list: readonly Record<string, unknown>[]) =>
    llm(c, {
      site: "topic-title",
      tier: "sonnet",
      locale,
      schema: SCHEMA,
      input: {
        task,
        product: { domain: report.domain, offering: profile?.offeringType ?? null, ...(knowledge == null ? {} : { knowledge: knowledge.map((passage, i) => ({ i, about: passage.about, text: passage.text })) }) },
        market:
          market === null
            ? { category: profile!.category, job: profile!.job, buyer: profile!.audienceTerms.join(", ") }
            : { buyer: market.buyer, job: market.job, category: market.category, synonyms: market.synonyms, differentiators: market.differentiators, rivals: market.rivals.map((rival) => rival.name || rival.domain) },
        searches: list,
      },
    });
  const shown = (search: (typeof searches)[number], i: number) => ({ i, search: search.query, ...(search.ranks.length === 0 ? {} : { ranks: search.ranks }) });
  const proposed = new Map<number, ProposedAngle[]>();
  const kept = new Map<number, ProposedAngle & { gap: number }>();
  const take = (answer: Awaited<ReturnType<typeof ask>>): void => {
    if (answer.kind === "unmeasured") return;
    for (const { i, angles } of answer.value.titles) {
      const search = searches[i];
      if (search === undefined || kept.has(i)) continue;
      proposed.set(i, [...(proposed.get(i) ?? []), ...angles]);
      const angle = pickAngle(angles, context(search));
      if (angle !== null) kept.set(i, angle);
    }
  };
  const first = await ask(TASK, searches.map(shown));
  if (first.kind === "unmeasured") return 0;
  take(first);
  const rejected = searches.flatMap((search, i) => (kept.has(i) ? [] : [{ ...shown(search, i), rejected: (proposed.get(i) ?? []).map((angle) => ({ title: angle.title, pattern: angle.pattern, gates: angleGates(angle, context(search)) })) }]));
  for (const each of rejected) console.log(JSON.stringify({ event: "week_title_rejected", siteId, search: each.search, angles: each.rejected.map(({ pattern, gates }) => ({ pattern, gates })) }));
  if (rejected.length > 0) take(await ask(RETRY, rejected));
  let titled = 0;
  for (const [i, search] of searches.entries()) {
    const evidence = readOpportunity(search.row).evidence;
    if (search.query.trim() === "" || (evidence.family !== "write" && evidence.family !== "earn")) continue;
    const angle = kept.get(i) ?? repairedAngle(proposed.get(i) ?? [], context(search));
    const title = angle?.title ?? casedTitle(search.query, context(search), (proposed.get(i) ?? []).map((each) => each.promise));
    await store.setEvidence(search.row.id, angle === null ? evidence : { ...evidence, angle: { pattern: angle.pattern, promise: angle.promise, gap: angle.gap } }, title);
    titled += 1;
  }
  return titled;
}

/** A stored title to ask again: none, or one that fails the writer's wording rules or is not its own Title Case with
 *  each name in its sources' casing. Its search in Title Case, the last fallback, is never asked again. */
export function staleTitle(stored: string, a: AngleContext): boolean {
  const title = stored.trim();
  if (title === "") return true;
  if (title === casedTitle(a.search, a)) return false;
  return plannedTitleFaults(title, a.search, a.language).length > 0 || title !== casedTitle(title, a);
}

/** The titles of the search's top results as the commit's research read them, at 0¢; none where none is held. */
async function researchTitles(siteId: string, locale: Locale, query: string): Promise<string[]> {
  if (query.trim() === "") return [];
  return (await cachedSerp(researchSerps({ siteId, locale, target: query }, 0)[0]!, DRAFT_POLICY_VERSION).catch(() => null))?.organic.map((top) => top.title) ?? [];
}

/** The site's latest paid pass, whose report the titles read and whose row their spend is ledgered on. */
async function latestPass(siteId: string): Promise<string | null> {
  const { dbAdmin } = await import("@/lib/db");
  const { data, error } = await dbAdmin().from("scans").select("id").eq("site_id", siteId).in("tier", ["deep", "weekly"]).in("status", ["done", "degraded"]).order("created_at", { ascending: false }).limit(1);
  if (error) throw new Error(`latestPass: ${error.message}`);
  return data?.[0]?.id ?? null;
}
