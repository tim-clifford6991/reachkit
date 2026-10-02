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
import type { MarketConclusion, RivalConclusion } from "@/lib/market/infer/types";
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
    return passMarket(site.stored.current, site.stored.rivalsOverridden);
  }

  const settled = settleMarket({
    stored: site.stored,
    standing: site.category,
    fresh: fresh.value,
    siteText: [evidence.headline ?? "", ...a.pages.map((p) => `${p.title} ${p.text}`)].join(" "),
    scanId: a.scanId,
    at: a.at,
  });
  const current = settled.next.current;
  await writeSiteMarket(a.siteId, {
    stored: settled.next,
    ...(settled.adopted && current !== null ? { category: current.category } : {}),
  });
  log("market_conclusion", {
    siteId: a.siteId,
    adopted: settled.adopted,
    pending: settled.next.pending !== null,
  });
  return passMarket(current, settled.next.rivalsOverridden);
}

function passMarket(market: MarketConclusion | null, rivalsOverridden: boolean): PassMarket | null {
  return market === null ? null : { category: market.category, synonyms: market.synonyms, market, rivalsOverridden };
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
  if (site === null || market === null || site.stored.rivalsOverridden) return none;

  const text = await siteText(a.domain);
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
  const settled = settleRivals({
    stored: site.stored,
    standing: site.competitors,
    fresh: fresh.value,
    scanId: a.report.scanId,
    at: a.at,
  });
  await writeSiteMarket(a.siteId, {
    stored: settled.next,
    ...(settled.changed ? { competitors: settled.rivals } : {}),
  });
  const change = settled.next.lastChange;
  log("rival_conclusion", { siteId: a.siteId, changed: settled.changed, rivals: settled.rivals.length });
  return settled.changed && change !== null && change !== undefined
    ? { changed: true, added: change.added, dropped: change.dropped }
    : none;
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
    return (await recheckRivals({ ...a, at: new Date() })).changed;
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
    const rivals = await inferRivals(c, evidence, market);
    return { market, rivals: rivals.kind === "unmeasured" ? [] : rivals.value };
  });
  if (concluded === null) return null;

  const site = await readSiteMarket(a.siteId);
  if (site !== null) {
    await writeSiteMarket(a.siteId, {
      stored: {
        ...site.stored,
        current: { ...concluded.market, rivals: concluded.rivals },
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
