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
import type { Locale, Place } from "@/lib/locale/locales";
import type { PlaceSignals, ServingArea, ServingEvidence } from "@/lib/locale/place";
import { siteLocale } from "@/lib/locale/site";
import type { CostContext } from "@/lib/costs";
import { evidenceDomains, type EvidencePage } from "@/lib/market/infer/evidence";
import type { BrandDemand, MarketConclusion, RivalConclusion } from "@/lib/market/infer/types";
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
  /** The one place the business serves (D67, issue 1318), as this pass
   *  settled it; `null` where it sells nationally or online. The pass
   *  measures there from here on. */
  place: Place | null;
}

/**
 * Where the site serves, settled for this pass (SPEC §6, owner D67, issue
 * 1318). The founder's answer stands. Where nobody has said, the first
 * market call that read it decides, once — and a place read before the
 * site's own evidence was asked for (issue 1370: it carries no `because`)
 * is decided again by the first pass that reads the site. A place the search vendor's list
 * was not yet read for is looked up there — free, once — so Google's
 * results are read from that city. Never throws: a lookup that fails
 * leaves the place measured in its country, and the next pass asks again.
 */
export async function settleArea(a: {
  siteId: string;
  area: ServingArea | undefined;
  /** What this pass's market call read; `undefined` where it made none. */
  read: Place | null | undefined;
  /** What on the site said it serves `read` (issue 1370). */
  because?: ServingEvidence;
  locale: Locale;
}): Promise<ServingArea | undefined> {
  const unproven = a.area !== undefined && a.area.by === "read" && a.area.place !== null && a.area.because === undefined;
  let area = a.area;
  if (a.read !== undefined && (area === undefined || unproven)) {
    const same = a.read !== null && area !== undefined && area.place !== null && area.place.name.toLowerCase() === a.read.name.toLowerCase();
    if (unproven) log("serving_area_decided_again", { siteId: a.siteId, was: a.area?.place?.name ?? null, is: a.read?.name ?? null, because: a.because ?? null });
    // The same place keeps the search vendor's name for it.
    area = same
      ? { ...area!, ...(a.because === undefined ? {} : { because: a.because }) }
      : { place: a.read, by: "read", ...(a.read === null || a.because === undefined ? {} : { because: a.because }) };
  }
  if (area === undefined || area.place === null || area.located === true) return area;
  // The conclusion's own region tells two cities of one name apart where
  // the founder gave none ("Portland").
  const place: Place =
    area.place.region === undefined &&
    a.read !== null &&
    a.read !== undefined &&
    a.read.region !== undefined &&
    a.read.name.toLowerCase() === area.place.name.toLowerCase()
      ? { ...area.place, region: a.read.region }
      : area.place;
  try {
    const { placeLocation } = await import("@/lib/vendors/dataforseo");
    const found = await placeLocation({ place, country: a.locale.country });
    if (found !== null) {
      area = {
        ...area,
        place: { name: place.name, ...(place.region === undefined ? {} : { region: place.region }), ...(found.location === null ? {} : { location: found.location }) },
        located: true,
      };
    }
    log("serving_area_located", { siteId: a.siteId, place: place.name, location: found === null ? "unread" : found.location });
  } catch (error) {
    log("serving_area_unlocated", { siteId: a.siteId, because: error instanceof Error ? error.message : String(error) });
  }
  return area;
}

function sameArea(a: ServingArea | undefined, b: ServingArea | undefined): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
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
  /** What the home page's structured data states of its address (D67). */
  stated?: PlaceSignals;
}): Promise<PassMarket | null> {
  const [{ readSiteMarket, writeSiteMarket }, { inferMarketFields }, { settleMarket }, { readCurrentReport }] =
    await Promise.all([
      import("@/lib/market/infer/stored"),
      import("@/lib/market/infer/infer"),
      import("@/lib/market/infer/stability"),
      import("./report"),
    ]);
  const site = await readSiteMarket(a.siteId);
  if (site === null) return null;
  const stored = await siteLocale(a.siteId);
  if (site.stored.categoryOverridden || a.pages.length === 0) {
    // No market is concluded here. A founder's place is still looked up,
    // and the next pass, which reads it stored, is made from that city.
    const area = await settleArea({ siteId: a.siteId, area: site.stored.area, read: undefined, locale: stored });
    if (!sameArea(area, site.stored.area) && area !== undefined) await writeSiteMarket(a.siteId, { stored: { ...site.stored, area } });
    return null;
  }

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
    ...(a.stated === undefined ? {} : { stated: a.stated }),
  });
  const fresh = await inferMarketFields(a.cost, evidence, stored);
  if (fresh.kind === "unmeasured") {
    log("market_conclusion_unmeasured", { siteId: a.siteId, reason: fresh.reason });
    return passMarket(site.stored.current, site.stored.rivalsOverridden, await founderBuyer(a.siteId), site.stored.area?.place ?? null);
  }
  // D67: where it serves is settled before anything is read for the market.
  const area = await settleArea({
    siteId: a.siteId,
    area: site.stored.area,
    read: fresh.value.serves,
    ...(fresh.value.servesBecause === undefined ? {} : { because: fresh.value.servesBecause }),
    locale: stored,
  });
  const place = area?.place ?? null;
  const locale: Locale = { country: stored.country, language: stored.language, ...(place === null ? {} : { place }) };

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
  // D69: a market that stands keeps its words and takes the kind the first
  // call that read one gave it.
  const standing = settled.next.current;
  const kinded =
    standing === null || standing.kind !== undefined || fresh.value.kind === undefined ? standing : { ...standing, kind: fresh.value.kind };
  const current = await withSearchTerms({
    market: kinded,
    locale,
    was: site.stored.area?.place ?? null,
    siteId: a.siteId,
    domain: a.domain,
    siteName: text.siteName,
    cost: a.cost,
    at: a.at,
  });
  await writeSiteMarket(a.siteId, {
    stored: { ...settled.next, current, ...(area === undefined ? {} : { area }) },
    ...(settled.adopted && current !== null ? { category: current.category } : {}),
  });
  log("market_conclusion", {
    siteId: a.siteId,
    adopted: settled.adopted,
    pending: settled.next.pending !== null,
    searchTerm: current?.searchTerm ?? null,
    kind: current?.kind ?? null,
    place: place?.name ?? null,
  });
  return passMarket(current, settled.next.rivalsOverridden, await founderBuyer(a.siteId), place);
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
  locale: Locale;
  /** The place the site was stored as serving before this pass settled it. */
  was: Place | null;
}): Promise<MarketConclusion | null> {
  const { market } = a;
  if (market === null) return null;
  try {
    const [{ termsDue }, { readMarketTerms }, { namesPlace }] = await Promise.all([
      import("@/lib/market/infer/terms"),
      import("@/lib/market/infer/read-terms"),
      import("@/lib/locale/place"),
    ]);
    // D67: terms read for the whole country are read again for the place,
    // whatever their age.
    const place = a.locale.place;
    const elsewhere = place !== undefined && (market.terms ?? []).some((term) => term.volume > 0 && !namesPlace(term.term, place));
    // Issue 1370: and terms read for a place the site no longer serves are
    // read again for where it sells.
    const was = a.was;
    const left =
      was !== null &&
      (place === undefined || place.name.toLowerCase() !== was.name.toLowerCase()) &&
      (market.terms ?? []).some((term) => namesPlace(term.term, was));
    if (!termsDue(market, a.at) && !elsewhere && !left) return market;
    const read = await readMarketTerms(a.cost, { market, siteName: a.siteName, domain: a.domain, at: a.at, locale: a.locale });
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
    const read = await judgeSearches(a.cost, { market: a.market, searches: a.searches, locale: await siteLocale(a.siteId) });
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
  founderBuyer: string | null,
  place: Place | null
): PassMarket | null {
  return market === null
    ? null
    : { category: market.category, synonyms: market.synonyms, market, rivalsOverridden, founderBuyer, place };
}

/**
 * The second moment: the rivals, from this pass's own report. Answers
 * whether the set the passes measure changed; the next pass measures it.
 */
export async function recheckRivals(a: {
  siteId: string;
  domain: string;
  cost: CostContext;
  report: StoredReport;
  at: Date;
}): Promise<{ changed: boolean; added: readonly RivalConclusion[]; dropped: readonly string[] }> {
  const none = { changed: false, added: [], dropped: [] };
  const [{ readSiteMarket, writeSiteMarket }, { inferRivals }, { settleRivals }, { seenByDomain }, { withoutCategoryBrands, withoutCategoryNames }, { ownKeywords }] =
    await Promise.all([
      import("@/lib/market/infer/stored"),
      import("@/lib/market/infer/infer"),
      import("@/lib/market/infer/stability"),
      import("@/lib/market/infer/presence"),
      import("@/lib/market/rivals/category-name"),
      import("@/lib/market/infer/demand"),
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
  const locale = await siteLocale(a.siteId);
  // Issue 1369: a volume an earlier pass read under the category's own
  // words is no product's, and is not carried into this read.
  const demand = withoutCategoryBrands(market.demand, market, {
    own: ownKeywords({ domain: a.domain, siteName: text.siteName }),
    language: locale.language,
  });
  // A founder's own rivals stand (D28). Their brand volumes are still read
  // (D50), since a comparison is derived only for a searched name — and
  // never under the category's words (issue 1369).
  if (site.stored.rivalsOverridden) {
    const weighed = await weighByDemand({ ...a, siteName: text.siteName, demand, rivals: withoutCategoryNames(market.rivals, market, locale.language) });
    if (weighed !== null) {
      const volume = new Map(weighed.rivals.map((r) => [r.domain, r.volume]));
      const rivals = market.rivals.map((r) => ({ ...r, volume: volume.get(r.domain) ?? 0 }));
      await writeSiteMarket(a.siteId, { stored: { ...site.stored, current: { ...market, rivals, demand: weighed.demand } } });
    }
    return none;
  }
  // The report's own derived rivals are the ones in force: the model has nothing to change.
  if (a.report.rivals.kind === "measured" && sameDomains(a.report.rivals.value.map((r) => r.domain), site.competitors)) {
    log("rival_conclusion_skipped", { siteId: a.siteId, because: "unchanged" });
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
  const fresh = await inferRivals(a.cost, evidence, market, RIVAL_CANDIDATES, locale);
  if (fresh.kind === "unmeasured") {
    log("rival_conclusion_unmeasured", { siteId: a.siteId, reason: fresh.reason });
    return none;
  }
  // Issue 1314: a candidate is a rival only at a domain that is its own.
  const checked = await withCheckedDomains({ siteId: a.siteId, domain: a.domain, rivals: fresh.value, seen: evidenceDomains(evidence) });
  // Issue 1369: a candidate whose name is the category's own words is
  // called by its domain, so no step below reads the category as its brand.
  const candidates = withoutCategoryNames(checked, market, locale.language);
  // D50: the candidates weighed by how often buyers search their brand.
  const weighed = await weighByDemand({ ...a, siteName: text.siteName, demand, rivals: candidates });
  const stored = { ...site.stored, current: { ...market, ...(weighed !== null ? { demand: weighed.demand } : demand === undefined ? {} : { demand }) } };
  // Issue 1365: and by what this pass's own first pages and answers show.
  const seen = seenByDomain(evidence, candidates);
  const settled = settleRivals({
    stored,
    standing: site.competitors,
    fresh: weighed?.rivals ?? candidates,
    seen,
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
    seen: candidates.map((r) => `${r.domain}:${seen.get(r.domain)?.firstPage ?? 0}/${seen.get(r.domain)?.named ?? 0}`),
    ownVolume: weighed?.demand.own ?? null,
  });
  return settled.changed && change !== null && change !== undefined
    ? { changed: true, added: change.added, dropped: change.dropped }
    : none;
}

function sameDomains(a: readonly string[], b: readonly string[]): boolean {
  return a.length > 0 && a.length === b.length && a.every((domain) => b.includes(domain));
}

/**
 * The candidates whose domain is their own (SPEC §6, 2026-10-07, issue
 * 1314): each home page is read once, a domain that is no site or another
 * company's is put right where the rival's own can be found, and the rival
 * is dropped where it cannot. Costs nothing and never throws; what it
 * changed is logged.
 */
async function withCheckedDomains(a: {
  siteId: string;
  domain: string;
  rivals: readonly RivalConclusion[];
  seen: Iterable<string>;
}): Promise<readonly RivalConclusion[]> {
  try {
    const { verifyRivalDomains } = await import("@/lib/market/rivals/verify");
    const checked = await verifyRivalDomains({ rivals: a.rivals, own: a.domain, seen: a.seen });
    if (checked.fixed.length > 0 || checked.dropped.length > 0) {
      log("rival_domains_checked", { siteId: a.siteId, fixed: checked.fixed, dropped: checked.dropped });
    }
    return checked.rivals;
  } catch (error) {
    log("rival_domains_failed", { siteId: a.siteId, because: error instanceof Error ? error.message : String(error) });
    return a.rivals;
  }
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
    const read = await readBrandDemand(a.cost, { ...a, locale: await siteLocale(a.siteId) });
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
  const locale = await siteLocale(a.siteId);
  return { market, stored, siteName, generated: generatePrompts(spokenMarket(market, await founderBuyer(a.siteId)), siteName, locale.language, locale.place) };
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

/** The rivals re-checked on the pass's own money (#1185). A failure
 *  changes nothing and says so in the log; the pass goes on. */
export async function recheckRivalsOf(a: {
  siteId: string;
  domain: string;
  cost: CostContext;
  report: StoredReport;
}): Promise<void> {
  try {
    await recheckRivals({ ...a, at: new Date() });
    await trackedPromptsFollowRivals(a);
  } catch (error) {
    console.log(
      JSON.stringify({
        event: "rival_conclusion_failed",
        siteId: a.siteId,
        because: error instanceof Error ? error.message : String(error),
      })
    );
  }
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
  const stored = await siteLocale(a.siteId);
  const held = await readSiteMarket(a.siteId);
  const concluded = await a.spend(async (c) => {
    const fields = await inferMarketFields(c, evidence, stored);
    if (fields.kind === "unmeasured") return null;
    // D67: the founder's place where they gave one at the step before,
    // else the one this call read — so the rivals offered are that place's.
    const area: ServingArea | undefined =
      held?.stored.area ??
      (fields.value.serves === undefined
        ? undefined
        : { place: fields.value.serves, by: "read", ...(fields.value.servesBecause === undefined ? {} : { because: fields.value.servesBecause }) });
    const place = area?.place ?? null;
    const locale: Locale = { country: stored.country, language: stored.language, ...(place === null ? {} : { place }) };
    const market =
      a.stated === null || a.stated.trim() === ""
        ? fields.value
        : { ...fields.value, category: a.stated.trim(), synonyms: [], categoryReason: "" };
    const rivals = await inferRivals(c, evidence, market, RIVAL_CANDIDATES, locale);
    if (rivals.kind === "unmeasured") return { market, rivals: [], demand: undefined, area };
    const { withoutCategoryNames } = await import("@/lib/market/rivals/category-name");
    const checked = await withCheckedDomains({ siteId: a.siteId, domain: a.domain, rivals: rivals.value, seen: evidenceDomains(evidence) });
    // Issue 1369: none is named by the category's own words.
    const candidates = withoutCategoryNames(checked, market, locale.language);
    // D50: the rivals setup offers are the ones buyers search for.
    const weighed = await weighByDemand({
      siteId: a.siteId,
      domain: a.domain,
      siteName: profile?.siteName ?? null,
      cost: c,
      demand: undefined,
      rivals: candidates,
      at: a.at,
    });
    // Issue 1365: of those, the ones the free report's own results show.
    const { chooseRivals, seenByDomain } = await import("@/lib/market/infer/presence");
    const chosen = chooseRivals({ fresh: weighed?.rivals ?? candidates, seen: seenByDomain(evidence, candidates) });
    return { market, rivals: chosen, demand: weighed?.demand, area };
  });
  if (concluded === null) return null;

  const site = await readSiteMarket(a.siteId);
  if (site !== null) {
    await writeSiteMarket(a.siteId, {
      stored: {
        ...site.stored,
        // A founder's answer saved meanwhile stands over the reading.
        ...(site.stored.area !== undefined || concluded.area === undefined ? {} : { area: concluded.area }),
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
