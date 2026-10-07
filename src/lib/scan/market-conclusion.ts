// src/lib/scan/market-conclusion.ts — each paid pass re-checks the site's
// market and rivals and keeps them current (SPEC §6, owner D28 of
// 2026-10-02, #1185).
//
// Two moments in a pass, because the two halves need different evidence:
//
//   1. **The market, before anything is bought for it.** The site's own
//      pages, just crawled, with the last report's measurements as a check.
//      The stability rule decides whether it replaces the standing market;
//      what stands is what this pass seeds and measures.
//   2. **The rivals, once this pass's own answers are in.** Who the AI
//      answers to the market's own questions name, and who holds its top
//      tens — evidence about the market the pass just measured, not the one
//      before (`docs/walk/market-inference.md` says why the order matters).
//
// A founder's override stands; neither moment touches a field they set.
// Every failure leaves what is stored alone: a pass never loses its market
// because a model call did not come back.
import type { CostContext } from "@/lib/costs";
import type { EvidencePage } from "@/lib/market/infer/evidence";
import type { BrandDemand, MarketConclusion, RivalConclusion } from "@/lib/market/infer/types";
import { RIVALS_MAX } from "@/lib/market/infer/types";
import type { GeneratedPrompt } from "@/lib/market/prompts/generate";
import type { PromptSet } from "@/lib/market/prompts/set";
import { marketEvidence } from "./market-evidence";
import type { StoredReport } from "./report";

/** How many rivals the second call is asked for: more than the five kept,
 *  so a standing rival concluded again further down still counts as seen
 *  (`settleRivals`). */
const RIVAL_CANDIDATES = 10;

function log(event: string, fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ event, ...fields }));
}

async function siteText(domain: string): Promise<{ products: readonly string[]; claims: readonly string[]; siteName: string | null }> {
  try {
    const { readSiteProfile } = await import("@/lib/site-profile");
    const profile = await readSiteProfile(domain);
    return { products: profile?.products ?? [], claims: profile?.claims ?? [], siteName: profile?.siteName ?? null };
  } catch {
    return { products: [], claims: [], siteName: null };
  }
}

/** The home page's title and first heading, as the crawl read them. */
export function headlineOf(pages: readonly (EvidencePage & { h1?: string })[]): string | null {
  const home = pages.find((p) => {
    try {
      return new URL(p.url).pathname === "/";
    } catch {
      return false;
    }
  });
  if (home === undefined) return null;
  const h1 = home.h1 ?? "";
  return h1 !== "" && !home.title.includes(h1) ? `${home.title} — ${h1}` : home.title || null;
}

/** What the first moment hands the pass: the market it measures, and
 *  whether the founder chose the rivals themselves. */
export interface PassMarket {
  category: string;
  synonyms: readonly string[];
  market: MarketConclusion;
  rivalsOverridden: boolean;
  /** The founder's own answer about who buys, where they gave one (D49). */
  founderBuyer: string | null;
}

/**
 * The first moment: the market this pass measures, or `null` to measure
 * the category already stored (`sites.category`) — where the founder set
 * it, no page was read, or no market was ever concluded.
 */
export async function concludeMarketForPass(a: {
  siteId: string;
  domain: string;
  scanId: string;
  cost: CostContext;
  pages: readonly (EvidencePage & { h1?: string })[];
  at: Date;
}): Promise<PassMarket | null> {
  const [{ readSiteMarket, writeSiteMarket }, { inferMarketFields }, { settleMarket }, { readCurrentReport }] =
    await Promise.all([
      import("@/lib/market/infer/stored"),
      import("@/lib/market/infer/infer"),
      import("@/lib/market/infer/stability"),
      import("./report"),
    ]);
  const site = await readSiteMarket(a.siteId);
  if (site === null || site.stored.categoryOverridden || a.pages.length === 0) return null;

  const before = await readCurrentReport(a.domain).catch(() => null);
  const text = await siteText(a.domain);
  const evidence = marketEvidence({
    domain: a.domain,
    siteName: text.siteName,
    headline: headlineOf(a.pages),
    pages: a.pages,
    products: text.products,
    claims: text.claims,
    report: before,
  });
  const fresh = await inferMarketFields(a.cost, evidence);
  if (fresh.kind === "unmeasured") {
    log("market_conclusion_unmeasured", { siteId: a.siteId, reason: fresh.reason });
    return passMarket(site.stored.current, site.stored.rivalsOverridden, await founderBuyer(a.siteId));
  }

  const settled = settleMarket({
    stored: site.stored,
    standing: site.category,
    fresh: fresh.value,
    siteText: [evidence.headline ?? "", ...a.pages.map((p) => `${p.title} ${p.text}`)].join(" "),
    scanId: a.scanId,
    at: a.at,
  });
  // D49: the market that stands has its words checked against search
  // volume, on this pass's money.
  const current = await withSearchTerms({
    market: settled.next.current,
    siteId: a.siteId,
    domain: a.domain,
    siteName: text.siteName,
    cost: a.cost,
    at: a.at,
  });
  await writeSiteMarket(a.siteId, {
    stored: { ...settled.next, current },
    ...(settled.adopted && current !== null ? { category: current.category } : {}),
  });
  log("market_conclusion", {
    siteId: a.siteId,
    adopted: settled.adopted,
    pending: settled.next.pending !== null,
    searchTerm: current?.searchTerm ?? null,
  });
  return passMarket(current, settled.next.rivalsOverridden, await founderBuyer(a.siteId));
}

/**
 * The market with its search terms read (SPEC §6, D49, issue 1270), where
 * they are due: never read, or older than `MARKET_TERMS.REFRESH_DAYS`. A
 * read that did not come back leaves the market as it was, and the next
 * pass asks again.
 */
async function withSearchTerms(a: {
  market: MarketConclusion | null;
  siteId: string;
  domain: string;
  siteName: string | null;
  cost: CostContext;
  at: Date;
}): Promise<MarketConclusion | null> {
  const { market } = a;
  if (market === null) return null;
  try {
    const [{ termsDue }, { readMarketTerms }] = await Promise.all([
      import("@/lib/market/infer/terms"),
      import("@/lib/market/infer/read-terms"),
    ]);
    if (!termsDue(market, a.at)) return market;
    const read = await readMarketTerms(a.cost, { market, siteName: a.siteName, domain: a.domain, at: a.at });
    if (read.kind === "unmeasured") {
      log("market_terms_unmeasured", { siteId: a.siteId, reason: read.reason, because: read.because ?? null });
      return market;
    }
    log("market_terms", { siteId: a.siteId, searchTerm: read.value.searchTerm, terms: read.value.terms });
    return { ...market, ...read.value };
  } catch (error) {
    log("market_terms_failed", { siteId: a.siteId, because: error instanceof Error ? error.message : String(error) });
    return market;
  }
}

/**
 * SPEC §6 (owner D65, issue 1303) — the searches a pass is about to measure,
 * judged against its market and kept on it, so a search is judged once.
 * Answers the market with the judgements added, or `null` where the call
 * did not come back: the pass then measures what it selected, and the next
 * pass asks again. Never throws.
 */
export async function judgeSearchesForPass(a: {
  siteId: string;
  cost: CostContext;
  market: MarketConclusion;
  searches: readonly string[];
}): Promise<MarketConclusion | null> {
  try {
    const [{ judgeSearches }, { withJudged }, { readSiteMarket, writeSiteMarket }] = await Promise.all([
      import("@/lib/market/infer/read-terms"),
      import("@/lib/market/questions/measured"),
      import("@/lib/market/infer/stored"),
    ]);
    const read = await judgeSearches(a.cost, { market: a.market, searches: a.searches });
    if (read.kind === "unmeasured") {
      log("market_searches_unmeasured", { siteId: a.siteId, reason: read.reason, because: read.because ?? null });
      return null;
    }
    const judged = withJudged(a.market.judged, read.value);
    const site = await readSiteMarket(a.siteId);
    if (site !== null && site.stored.current !== null) {
      await writeSiteMarket(a.siteId, { stored: { ...site.stored, current: { ...site.stored.current, judged } } });
    }
    log("market_searches", {
      siteId: a.siteId,
      judged: Object.keys(read.value).length,
      off: Object.values(read.value).filter((on) => !on).length,
    });
    return { ...a.market, judged };
  } catch (error) {
    log("market_searches_failed", { siteId: a.siteId, because: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/** The founder's own answer about who buys (§5's first question), which
 *  outranks the inferred buyer (D49). `null` where they gave none. */
async function founderBuyer(siteId: string): Promise<string | null> {
  try {
    const { readBusinessEdits } = await import("@/lib/site-profile/business/edits");
    return (await readBusinessEdits(siteId)).answers.buyers ?? null;
  } catch {
    return null;
  }
}

function passMarket(
  market: MarketConclusion | null,
  rivalsOverridden: boolean,
  founderBuyer: string | null
): PassMarket | null {
  return market === null
    ? null
    : { category: market.category, synonyms: market.synonyms, market, rivalsOverridden, founderBuyer };
}

/**
 * The second moment: the rivals, from this pass's own report. Answers
 * whether the set the passes measure changed, so the caller can measure
 * again (#1185 point 4).
 */
export async function recheckRivals(a: {
  siteId: string;
  domain: string;
  cost: CostContext;
  report: StoredReport;
  at: Date;
}): Promise<{ changed: boolean; added: readonly RivalConclusion[]; dropped: readonly string[] }> {
  const none = { changed: false, added: [], dropped: [] };
  const [{ readSiteMarket, writeSiteMarket }, { inferRivals }, { settleRivals }] = await Promise.all([
    import("@/lib/market/infer/stored"),
    import("@/lib/market/infer/infer"),
    import("@/lib/market/infer/stability"),
  ]);
  // A pass its ceiling stopped did not finish reading its market (#1195):
  // its few answers are no measure of who competes in it.
  if (a.report.stoppedReason === "time_ceiling") {
    log("rival_conclusion_skipped", { siteId: a.siteId, because: "time_ceiling" });
    return none;
  }
  const site = await readSiteMarket(a.siteId);
  const market = site?.stored.current ?? null;
  if (site === null || market === null) return none;

  const text = await siteText(a.domain);
  // A founder's own rivals stand (D28). Their brand volumes are still read
  // (D50), since a comparison is derived only for a searched name.
  if (site.stored.rivalsOverridden) {
    const weighed = await weighByDemand({ ...a, siteName: text.siteName, demand: market.demand, rivals: market.rivals });
    if (weighed !== null) {
      const volume = new Map(weighed.rivals.map((r) => [r.domain, r.volume]));
      const rivals = market.rivals.map((r) => ({ ...r, volume: volume.get(r.domain) ?? 0 }));
      await writeSiteMarket(a.siteId, { stored: { ...site.stored, current: { ...market, rivals, demand: weighed.demand } } });
    }
    return none;
  }
  const evidence = marketEvidence({
    domain: a.domain,
    siteName: text.siteName,
    headline: null,
    pages: [],
    products: text.products,
    claims: text.claims,
    report: a.report,
  });
  const fresh = await inferRivals(a.cost, evidence, market, RIVAL_CANDIDATES);
  if (fresh.kind === "unmeasured") {
    log("rival_conclusion_unmeasured", { siteId: a.siteId, reason: fresh.reason });
    return none;
  }
  // D50: the candidates weighed by how often buyers search their brand.
  const weighed = await weighByDemand({ ...a, siteName: text.siteName, demand: market.demand, rivals: fresh.value });
  const stored =
    weighed === null ? site.stored : { ...site.stored, current: { ...market, demand: weighed.demand } };
  const settled = settleRivals({
    stored,
    standing: site.competitors,
    fresh: weighed?.rivals ?? fresh.value,
    scanId: a.report.scanId,
    at: a.at,
  });
  await writeSiteMarket(a.siteId, {
    stored: settled.next,
    ...(settled.changed ? { competitors: settled.rivals } : {}),
  });
  const change = settled.next.lastChange;
  log("rival_conclusion", {
    siteId: a.siteId,
    changed: settled.changed,
    rivals: settled.rivals.length,
    searched: weighed === null ? null : (settled.next.current?.rivals ?? []).map((r) => `${r.name}:${r.volume ?? 0}`),
    ownVolume: weighed?.demand.own ?? null,
  });
  return settled.changed && change !== null && change !== undefined
    ? { changed: true, added: change.added, dropped: change.dropped }
    : none;
}

/**
 * The candidates in the order D50 chooses them, with the demand read for
 * them: one keyword-overview call for the names not yet held, on the
 * caller's money. `null` where it did not come back — the caller keeps the
 * conclusion's own order, and the next pass asks again.
 */
async function weighByDemand(a: {
  siteId: string;
  domain: string;
  siteName: string | null;
  cost: CostContext;
  demand: BrandDemand | undefined;
  rivals: readonly RivalConclusion[];
  at: Date;
}): Promise<{ rivals: RivalConclusion[]; demand: BrandDemand } | null> {
  try {
    const [{ readBrandDemand }, { byDemand }] = await Promise.all([
      import("@/lib/market/infer/read-demand"),
      import("@/lib/market/infer/demand"),
    ]);
    const read = await readBrandDemand(a.cost, a);
    if (read.kind === "unmeasured") {
      log("rival_demand_unmeasured", { siteId: a.siteId, reason: read.reason, because: read.because ?? null });
      return null;
    }
    return { rivals: byDemand(a.rivals, read.value), demand: read.value };
  } catch (error) {
    log("rival_demand_failed", { siteId: a.siteId, because: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * The market in force, the stored prompt set and what that market yields
 * today, read once: what the set follows (issue 1285) and what a pass's
 * health is checked against (D58, issue 1287). `null` where the site has no
 * market.
 */
export async function promptsInForce(a: { siteId: string; domain: string }): Promise<{
  market: MarketConclusion;
  stored: PromptSet;
  generated: GeneratedPrompt[];
  siteName: string;
} | null> {
  const [{ readPromptSet }, { generatePrompts, promptSiteName }, { readSiteMarket }, { spokenMarket }] = await Promise.all([
    import("@/lib/market/prompts/store"),
    import("@/lib/market/prompts/generate"),
    import("@/lib/market/infer/stored"),
    import("@/lib/market/infer/terms"),
  ]);
  const market = (await readSiteMarket(a.siteId))?.stored.current ?? null;
  if (market === null) return null;
  const stored = await readPromptSet(a.siteId);
  const siteName = promptSiteName((await siteText(a.domain)).siteName, a.domain);
  return { market, stored, siteName, generated: generatePrompts(spokenMarket(market, await founderBuyer(a.siteId)), siteName) };
}

/**
 * SPEC §6 (D54, issue 1285) — the stored set's comparison and branded
 * prompts, brought to the rivals a pass has just concluded. The rivals are
 * concluded from the pass's own answers, so after the pass built and asked
 * the set: without this the set names the rivals of the pass before. This
 * pass's stored answers are to the prompts it asked; the next pass asks
 * these. Nothing here throws.
 */
export async function trackedPromptsFollowRivals(a: { siteId: string; domain: string }): Promise<void> {
  try {
    const [{ writePromptSet }, { followRivals }] = await Promise.all([
      import("@/lib/market/prompts/store"),
      import("@/lib/market/prompts/set"),
    ]);
    const inForce = await promptsInForce(a);
    if (inForce === null) return;
    const { stored, generated } = inForce;
    if (stored.prompts.length === 0) return;
    const set = followRivals(stored, generated, new Date());
    if (set === stored) return;
    await writePromptSet(a.siteId, set);
    const held = new Set(stored.prompts.map((prompt) => prompt.id));
    console.log(
      JSON.stringify({
        event: "tracked_prompts_follow_rivals",
        siteId: a.siteId,
        replaced: set.prompts.filter((prompt) => !held.has(prompt.id)).length,
      })
    );
  } catch (error) {
    console.log(
      JSON.stringify({
        event: "tracked_prompts_follow_rivals_failed",
        siteId: a.siteId,
        because: error instanceof Error ? error.message : String(error),
      })
    );
  }
}

/** The rivals re-checked on the pass's own money (#1185). Answers whether
 *  the set the passes measure changed. A failure changes nothing and says
 *  so in the log; the pass goes on. */
export async function recheckRivalsOf(a: {
  siteId: string;
  domain: string;
  cost: CostContext;
  report: StoredReport;
}): Promise<boolean> {
  try {
    const { changed } = await recheckRivals({ ...a, at: new Date() });
    await trackedPromptsFollowRivals(a);
    return changed;
  } catch (error) {
    console.log(
      JSON.stringify({
        event: "rival_conclusion_failed",
        siteId: a.siteId,
        because: error instanceof Error ? error.message : String(error),
      })
    );
    return false;
  }
}

/** One re-measure for a rival change, under #837's own bound; a refusal is
 *  logged and the next pass measures the new set. */
export async function remeasureForRivals(a: { siteId: string; domain: string; scanId: string }): Promise<null> {
  try {
    const { startRemeasure } = await import("./deep/remeasure");
    const started = await startRemeasure({ siteId: a.siteId, domain: a.domain, remeasureOf: a.scanId });
    console.log(
      JSON.stringify({
        event: "rivals_remeasure",
        siteId: a.siteId,
        started: started.started,
        ...(started.started ? {} : { because: started.because }),
      })
    );
  } catch (error) {
    console.log(
      JSON.stringify({
        event: "rivals_remeasure_failed",
        siteId: a.siteId,
        because: error instanceof Error ? error.message : String(error),
      })
    );
  }
  return null;
}

/**
 * Setup's conclusion (§5, D28): the market and rivals ReachKit identified,
 * each with its reason, shown on the rivals step and stored as the market
 * in force. Read from what is already known of the site — the pages its
 * scans read, its profile, and its free report where it has one. A market
 * the founder stated is kept as theirs, and the rivals are found for it.
 *
 * `null` where nothing of the site has been read yet, or the call did not
 * come back: setup then offers what it offered before #1185.
 */
export async function concludeAtSetup(a: {
  siteId: string;
  domain: string;
  stated: string | null;
  spend: <T>(body: (c: CostContext) => Promise<T>) => Promise<T>;
  at: Date;
}): Promise<{ category: string; categoryReason: string; rivals: readonly RivalConclusion[] } | null> {
  const [{ readMeasuredText, readDomainText }, { readSiteProfile }, { readCurrentReport }] = await Promise.all([
    import("@/lib/measure/text"),
    import("@/lib/site-profile"),
    import("./report"),
  ]);
  const [own, free, profile, report] = await Promise.all([
    readMeasuredText({ siteId: a.siteId }).catch(() => []),
    readDomainText(a.domain).catch(() => []),
    readSiteProfile(a.domain).catch(() => null),
    readCurrentReport(a.domain).catch(() => null),
  ]);
  const latest = new Map<string, { url: string; text: string; at: number }>();
  for (const page of [...own, ...free]) {
    const held = latest.get(page.url);
    if (held === undefined || held.at < page.measuredAt.getTime()) {
      latest.set(page.url, { url: page.url, text: page.text, at: page.measuredAt.getTime() });
    }
  }
  const titles = new Map((profile?.inventory ?? []).map((row) => [row.url, row]));
  const pages = [...latest.values()].map((p) => ({
    url: p.url,
    title: titles.get(p.url)?.title ?? "",
    h1: titles.get(p.url)?.h1 ?? "",
    text: p.text,
  }));
  if (pages.length === 0) return null;

  const evidence = marketEvidence({
    domain: a.domain,
    siteName: profile?.siteName ?? null,
    headline: headlineOf(pages),
    pages,
    products: profile?.products ?? [],
    claims: profile?.claims ?? [],
    report,
  });
  const [{ inferMarketFields, inferRivals }, { readSiteMarket, writeSiteMarket }] = await Promise.all([
    import("@/lib/market/infer/infer"),
    import("@/lib/market/infer/stored"),
  ]);
  const concluded = await a.spend(async (c) => {
    const fields = await inferMarketFields(c, evidence);
    if (fields.kind === "unmeasured") return null;
    const market =
      a.stated === null || a.stated.trim() === ""
        ? fields.value
        : { ...fields.value, category: a.stated.trim(), synonyms: [], categoryReason: "" };
    const rivals = await inferRivals(c, evidence, market, RIVAL_CANDIDATES);
    if (rivals.kind === "unmeasured") return { market, rivals: [], demand: undefined };
    // D50: the rivals setup offers are the ones buyers search for.
    const weighed = await weighByDemand({
      siteId: a.siteId,
      domain: a.domain,
      siteName: profile?.siteName ?? null,
      cost: c,
      demand: undefined,
      rivals: rivals.value,
      at: a.at,
    });
    return { market, rivals: (weighed?.rivals ?? rivals.value).slice(0, RIVALS_MAX), demand: weighed?.demand };
  });
  if (concluded === null) return null;

  const site = await readSiteMarket(a.siteId);
  if (site !== null) {
    await writeSiteMarket(a.siteId, {
      stored: {
        ...site.stored,
        current: {
          ...concluded.market,
          rivals: concluded.rivals,
          ...(concluded.demand === undefined ? {} : { demand: concluded.demand }),
        },
        adoptedAt: a.at.toISOString(),
        pending: null,
      },
    });
  }
  log("market_conclusion_setup", { siteId: a.siteId, rivals: concluded.rivals.length, stated: a.stated !== null });
  return {
    category: concluded.market.category,
    categoryReason: concluded.market.categoryReason,
    rivals: concluded.rivals,
  };
}
