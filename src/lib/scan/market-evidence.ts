// src/lib/scan/market-evidence.ts — a stored report and the site's read
// pages, as the evidence ReachKit concludes a market from (#1185).
//
// It lives on the scan side because it reads the stored report's own type;
// `src/lib/market` never imports `src/lib/scan`'s report (the cycle
// `market/setup/state.ts` explains).
import type { EvidenceAnswer, EvidencePage, EvidenceTopTen, MarketEvidence } from "@/lib/market/infer/evidence";
import { resolvedHost } from "@/lib/market/rivals/domains";
import type { PlaceSignals } from "@/lib/locale/place";
import type { Measured } from "@/lib/measure/measured";
import type { AnswerCell, StoredReport } from "./report";

/** What evidence reads of a report: the stored report, or the slice of it
 *  the re-score exports (issue 1426). */
export interface EvidenceReport {
  marketPrompts?: StoredReport["marketPrompts"];
  aiAnswers: {
    rows: readonly { question: { search: string }; cell: AnswerCell; engines: readonly { cell: AnswerCell }[] }[];
  } | null;
  serps: readonly Measured<{
    organic: readonly { domain: string; url?: string; title?: string }[];
    localPack?: readonly { domain: string; title?: string }[];
  }>[];
  measuredCategory: string | null;
  market: Measured<{ profile: { category: string | null } }>;
  ownRankedRows: readonly { keyword: string; position: number }[];
}

function bare(domain: string): string {
  return domain.toLowerCase().replace(/^www\./, "");
}

/** The AI answers of a report: the market's buyer prompts first (#1195),
 *  each with the start of its answer, then each question with every domain
 *  any engine cited for it, once. */
function answersOf(report: EvidenceReport | null): EvidenceAnswer[] {
  const prompts: EvidenceAnswer[] = (report?.marketPrompts ?? []).map((p) => ({
    question: p.prompt,
    citedDomains: p.citedDomains,
    namesSite: p.namesSite,
    excerpt: p.excerpt,
  }));
  const rows = report?.aiAnswers?.rows ?? [];
  return [...prompts, ...rows.map((row) => {
    const cited = new Set<string>();
    let namesSite = false;
    const cells = [row.cell, ...row.engines.map((e) => e.cell)];
    for (const cell of cells) {
      if (cell.kind !== "answered") continue;
      for (const d of cell.citedDomains) cited.add(bare(d));
      namesSite ||= cell.namesCustomer;
    }
    return { question: row.question.search, citedDomains: [...cited], namesSite };
  })];
}

/** The domains of a report's measured top tens, with how many of the
 *  measured searches each appears on and one of its titles. A domain with
 *  two results for one search holds that search once (issue 1365): the
 *  count is what the rivals are chosen by, and what the Rivals tab draws. */
function topTensOf(report: EvidenceReport | null, own: string): EvidenceTopTen[] {
  const tally = new Map<string, EvidenceTopTen>();
  for (const serp of report?.serps ?? []) {
    if (serp.kind !== "measured") continue;
    const here = new Set<string>();
    // D67: a business in the local pack is found for this search as one
    // in the top ten is.
    for (const row of [...serp.value.organic.map((each) => ({ ...each, domain: resolvedHost(each) ?? "" })), ...(serp.value.localPack ?? [])]) {
      const domain = bare(row.domain);
      if (domain === "" || domain === own || here.has(domain)) continue;
      here.add(domain);
      const seen = tally.get(domain);
      if (seen === undefined) tally.set(domain, { domain, appearances: 1, title: row.title ?? "" });
      else seen.appearances += 1;
    }
  }
  return [...tally.values()];
}

/** Whether a measured search of the report showed the site in Google's
 *  local pack (issue 1370). */
function inLocalPack(report: EvidenceReport | null, own: string): boolean {
  return (report?.serps ?? []).some(
    (serp) => serp.kind === "measured" && (serp.value.localPack ?? []).some((row) => bare(row.domain) === own)
  );
}

export function marketEvidence(a: {
  domain: string;
  siteName: string | null;
  headline: string | null;
  pages: readonly EvidencePage[];
  products: readonly string[];
  claims: readonly string[];
  report: EvidenceReport | null;
  /** What the home page's structured data states of its address (D67). */
  stated?: PlaceSignals;
}): MarketEvidence {
  const own = bare(a.domain);
  return {
    ...(a.stated === undefined ? {} : { stated: a.stated }),
    ...(inLocalPack(a.report, own) ? { ownLocalPack: true } : {}),
    domain: own,
    siteName: a.siteName,
    headline: a.headline,
    measuredUnder:
      a.report?.measuredCategory ??
      (a.report?.market.kind === "measured" ? a.report.market.value.profile.category : null),
    pages: a.pages,
    products: a.products,
    claims: a.claims,
    answers: answersOf(a.report),
    ownSearches: (a.report?.ownRankedRows ?? []).map((r) => ({ keyword: r.keyword, position: r.position })),
    topTens: topTensOf(a.report, own),
  };
}
