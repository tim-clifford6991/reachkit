// src/lib/scan/market-evidence.ts — a stored report and the site's read
// pages, as the evidence ReachKit concludes a market from (#1185).
//
// It lives on the scan side because it reads the stored report's own type;
// `src/lib/market` never imports `src/lib/scan`'s report (the cycle
// `market/setup/state.ts` explains).
import type { EvidenceAnswer, EvidencePage, EvidenceTopTen, MarketEvidence } from "@/lib/market/infer/evidence";
import type { StoredReport } from "./report";

function bare(domain: string): string {
  return domain.toLowerCase().replace(/^www\./, "");
}

/** The AI answers of a report: each question with every domain any engine
 *  cited for it, once. */
function answersOf(report: StoredReport | null): EvidenceAnswer[] {
  const rows = report?.aiAnswers?.rows ?? [];
  return rows.map((row) => {
    const cited = new Set<string>();
    let namesSite = false;
    const cells = [row.cell, ...row.engines.map((e) => e.cell)];
    for (const cell of cells) {
      if (cell.kind !== "answered") continue;
      for (const d of cell.citedDomains) cited.add(bare(d));
      namesSite ||= cell.namesCustomer;
    }
    return { question: row.question.search, citedDomains: [...cited], namesSite };
  });
}

/** The domains of a report's measured top tens, with how often each
 *  appears and one of its titles. */
function topTensOf(report: StoredReport | null, own: string): EvidenceTopTen[] {
  const tally = new Map<string, EvidenceTopTen>();
  for (const serp of report?.serps ?? []) {
    if (serp.kind !== "measured") continue;
    for (const row of serp.value.organic) {
      const domain = bare(row.domain);
      if (domain === own) continue;
      const seen = tally.get(domain);
      if (seen === undefined) tally.set(domain, { domain, appearances: 1, title: row.title ?? "" });
      else seen.appearances += 1;
    }
  }
  return [...tally.values()];
}

export function marketEvidence(a: {
  domain: string;
  siteName: string | null;
  headline: string | null;
  pages: readonly EvidencePage[];
  products: readonly string[];
  claims: readonly string[];
  report: StoredReport | null;
}): MarketEvidence {
  const own = bare(a.domain);
  return {
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
