// SPEC §7 *Five stages* — what a day's write reads once for the day, before any topic's pack is built.
import { siteLocale } from "@/lib/locale/site";
import { sitePagesFor, type Opportunity } from "@/lib/opportunities";
import type { StoredReport } from "@/lib/scan/report";
import { newSite } from "./day-refresh";
import { clusterLinkTargets, knownLinkTargets as knownContentTargets, siteLinkTargets, urlKey, type LinkTarget } from "./links/select";
import { targetSearches } from "./pipeline";
import { siteRulesOf } from "./pipeline/battery";
import { allowedFacts, readAllFacts, readDemoPhrases } from "./pipeline/grounding";
import { confirmedForWriting } from "./voice/confirmed";
import { siteWritingMarket } from "./voice/market";
import { generateStore, type SiteFacts } from "./store";

export type DayInputs = Awaited<ReturnType<typeof dayInputs>>;

/** SPEC §7 (2026-10-10, issue 1391): the newer live page a refresh planned
 *  for `link` adds a link to, as its row records it. */
export function linkBackOf(opportunity: Opportunity): { url: string; title: string; replaces?: string } | null {
  const shortfall = (opportunity.evidence as { shortfall?: { cause?: unknown; link?: { url?: unknown; title?: unknown; replaces?: unknown } } } | undefined)?.shortfall;
  const link = shortfall?.cause === "link" ? shortfall.link : undefined;
  if (typeof link?.url !== "string" || typeof link.title !== "string") return null;
  return { url: link.url, title: link.title, ...(typeof link.replaces === "string" ? { replaces: link.replaces } : {}) };
}

export async function dayInputs(a: { siteId: string; site: SiteFacts; report: StoredReport; opportunity: Opportunity }) {
  const store = generateStore();
  const { site, report, opportunity } = a;

  const ruleInputs = siteRulesOf(site, report, await newSite(a.siteId, new Date()));
  // The confirmed business profile, the customer's corrections over the crawl, as both screens read it, once for the day.
  const confirmed = await confirmedForWriting({ siteId: a.siteId, domain: site.domain });
  // D66: the page is researched and written in the site's own country and language.
  const locale = await siteLocale(a.siteId);
  // Issue 1390: the voice the customer fixed in Settings, where they did.
  const writingVoice = await store.writingVoice(a.siteId);

  // SPEC §7 (2026-10-04, issue 1248): the page is written for the site's
  // market in force (`sites.market`, D28) — the report's category is the one
  // that pass was bought under, and stands in only where no market is stored.
  const writingFor = siteWritingMarket(site, report, confirmed.buyers);
  const category = writingFor.category;

  // SPEC §7 (2026-09-12): the site's own pages from the profile's inventory,
  // the cluster's earlier live pages, and the pages the site already has
  // (#928) — what the page links, read once for the day.
  const inventory = await store.siteInventory(site.domain);
  const earlier =
    opportunity.clusterKey === null ? [] : await store.clusterPages(a.siteId, opportunity.clusterKey);
  const known = await store.knownPages(a.siteId);
  const linksFor = (o: Opportunity): LinkTarget[] => {
    const selfUrl = o.family === "improve" ? o.targetRef : null;
    // Issue 1391: a refresh planned to link a newer page links it first.
    const newer = linkBackOf(o);
    const chosen: LinkTarget[] = [
      ...siteLinkTargets({ domain: site.domain, inventory, query: o.targetQuery ?? "", selfUrl }),
      ...(newer === null ? [] : [{ source: "known" as const, url: newer.url, label: newer.title, why: { kind: "newer" as const } }]),
      ...clusterLinkTargets(earlier).filter((target) => newer === null || urlKey(target.url) !== urlKey(newer.url)),
    ];
    return [
      ...chosen,
      ...knownContentTargets(known, { domain: site.domain, query: o.targetQuery ?? "", selfUrl, already: chosen }),
    ];
  };
  // SPEC §7 (2026-10-03, D36, issue 1209): every page the site has published
  // or planned, each with its address where the index knows it.
  const sitePages = (await sitePagesFor(a.siteId, { except: opportunity.id })).map((page) => ({
    ...page,
    url: page.title === null ? null : (known.find((held) => held.title === page.title)?.url ?? null),
  }));

  // The customer's own passages, the pages that speak to the target first
  // (issue 900), minus the ones they switched off (#927).
  const facts = allowedFacts(
    await readAllFacts({ siteId: a.siteId, scanId: report.scanId, target: targetSearches(opportunity)[0] }),
    confirmed.factsOff
  );
  // What no page may repeat whole (issue 1249): the site's demo phrases —
  // the ones kept with its knowledge base ride in `factsOff`.
  const demoPhrases = [
    ...(await readDemoPhrases({ siteId: a.siteId, scanId: report.scanId }).catch(() => [])),
    ...confirmed.factsOff,
  ];

  // Issue 1509: what the site's live pages already say, so a fact said on
  // two of them is offered last. A read that fails offers them as before.
  const livePages = await store.livePages(a.siteId).catch(() => []);

  return { ruleInputs, confirmed, locale, writingVoice, writingFor, category, known, linksFor, sitePages, facts, demoPhrases, livePages };
}
