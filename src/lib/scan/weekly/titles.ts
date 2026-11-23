// SPEC §6 *Every topic is an angle*: every page a committed week holds has a title. A new page the fit call gave no
// angle (a fit of 2, a top-up, a row held from an earlier pass) is asked in one batched call on the fit call's tier,
// in a context of its own under `CAPS.WEEKLY_C`, since the pass itself ends near its cap; an update shows its live
// page's own title, at 0¢. No title never stops a topic: a row left untitled stays planned, and the site's next daily
// run asks again.
import { z } from "zod";
import { withCostContext, type CostContext } from "@/lib/costs";
import { DRAFT_POLICY_VERSION } from "@/lib/generate/cost";
import { llm } from "@/lib/llm";
import { siteLocale } from "@/lib/locale/site";
import { ANGLE_ASK, ANGLE_PATTERNS, pickAngle } from "@/lib/market/questions/angle";
import { canonicalUrl } from "@/lib/measure/page-reading";
import { queryKey, topTenRowsOf } from "@/lib/opportunities/cluster";
import { addressKey, ownLivePages } from "@/lib/opportunities/refresh";
import { opportunityStore, readOpportunity, type OpportunityRow } from "@/lib/opportunities/store";
import { readScanReport, type StoredReport } from "@/lib/scan/report";

const SCHEMA = z.strictObject({
  titles: z.array(
    z.strictObject({
      i: z.number().int(),
      angles: z.array(z.strictObject({ pattern: z.enum(ANGLE_PATTERNS), title: z.string(), promise: z.string(), fact: z.number().int().nullable() })),
    })
  ),
});

const TASK = [`Each of \`searches\` is a page this business will write this week. For each, give \`angles\`: ${ANGLE_ASK.pages}`, ANGLE_ASK.title].join(" ");

/** Titles the open rows of the site's committed week that have none, from `scanId`'s report (else its latest paid
 *  pass's); how many it titled. Never throws. */
export async function titleWeek(siteId: string, scanId?: string): Promise<number> {
  try {
    const store = opportunityStore();
    const rows = (await store.plannedRows(siteId)).filter((row) => row.status === "open" && (row.title ?? "").trim() === "");
    if (rows.length === 0) return 0;
    const at = scanId ?? (await latestPass(siteId));
    const report = at === null ? null : await readScanReport(at);
    if (at === null || report === null) return 0;
    let titled = await liveTitles(siteId, report.domain, rows.filter((row) => row.family === "improve"));
    const pages = rows.filter((row) => row.family === "write" || row.family === "earn");
    const spend = { scanId: at, cap: "WEEKLY", policyVersion: DRAFT_POLICY_VERSION, rollUp: "none", activity: "weekly" } as const;
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

/** One call for the week's untitled new pages; each keeps the angle `pickAngle` keeps, stored as the fit call's is. */
async function angleTitles(c: CostContext, siteId: string, rows: readonly OpportunityRow[], report: StoredReport): Promise<number> {
  const store = opportunityStore();
  const [{ market, knowledge }, locale] = await Promise.all([store.marketFor(siteId), siteLocale(siteId)]);
  const profile = report.market.kind === "unmeasured" ? null : report.market.value.profile;
  if (market === null && profile === null) return 0;
  const ranked = topTenRowsOf(report);
  const searches = rows.map((row) => ({ row, query: row.target_query ?? "", ranks: (ranked.get(queryKey(row.target_query ?? ""))?.rows ?? []).slice(0, 5).map((top) => top.title) }));
  const answer = await llm(c, {
    site: "topic-title",
    tier: "sonnet",
    locale,
    schema: SCHEMA,
    input: {
      task: TASK,
      product: { domain: report.domain, offering: profile?.offeringType ?? null, ...(knowledge == null ? {} : { knowledge: knowledge.map((passage, i) => ({ i, about: passage.about, text: passage.text })) }) },
      market:
        market === null
          ? { category: profile!.category, job: profile!.job, buyer: profile!.audienceTerms.join(", ") }
          : { buyer: market.buyer, job: market.job, category: market.category, synonyms: market.synonyms, differentiators: market.differentiators, rivals: market.rivals.map((rival) => rival.name || rival.domain) },
      searches: searches.map((search, i) => ({ i, search: search.query, ...(search.ranks.length === 0 ? {} : { ranks: search.ranks }) })),
    },
  });
  if (answer.kind === "unmeasured") return 0;
  const rivals = market?.rivals.flatMap((rival) => [rival.name, rival.domain]) ?? [];
  const sources = [...(knowledge ?? []).map((passage) => passage.text), report.domain, ...rivals];
  const done = new Set<number>();
  for (const { i, angles } of answer.value.titles) {
    const search = searches[i];
    if (search === undefined || done.has(i)) continue;
    const kept = pickAngle(angles, { search: search.query, sources, ranks: search.ranks, rivals, ...(knowledge == null ? {} : { passages: knowledge.length }) });
    const evidence = readOpportunity(search.row).evidence;
    if (kept === null || (evidence.family !== "write" && evidence.family !== "earn")) continue;
    await store.setEvidence(search.row.id, { ...evidence, angle: { pattern: kept.pattern, promise: kept.promise, gap: kept.gap } }, kept.title);
    done.add(i);
  }
  return done.size;
}

/** The site's latest paid pass, whose report the titles read and whose row their spend is ledgered on. */
async function latestPass(siteId: string): Promise<string | null> {
  const { dbAdmin } = await import("@/lib/db");
  const { data, error } = await dbAdmin().from("scans").select("id").eq("site_id", siteId).in("tier", ["deep", "weekly"]).in("status", ["done", "degraded"]).order("created_at", { ascending: false }).limit(1);
  if (error) throw new Error(`latestPass: ${error.message}`);
  return data?.[0]?.id ?? null;
}
