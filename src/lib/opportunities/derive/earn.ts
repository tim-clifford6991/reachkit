// SPEC §0 · issue 478 — the Earn family: a source names a rival and not the
// customer, and the answer is a first-party citable asset on the customer's
// own domain. Never outreach: nothing here, or downstream of it, writes to the
// source or to anyone else.
//
// One deriver, at most one candidate per market question, from the measured
// SERP and AI answer alone:
//
//   ai_answer      the question's AI answer does not name the customer, and
//                  cites a platform host (the source) beside a domain that is
//                  neither the customer's nor a platform (a rival — SPEC §0's
//                  "named in an AI answer").
//   search_result  otherwise: the customer holds no place in the bought top
//                  ten, and it carries a platform row beside a rival row.
//
// The AI answer is the stronger surface, so it is preferred. A platform is
// `PLATFORM_DOMAINS`' closed list — the same partition rival derivation puts
// into `StoredReport.sources`. A publisher that is not on that list cannot be
// told apart from a rival by any measurement the report holds, so it is not
// read as a source.
//
// **The asset is chosen by the query's own words** — never by a model:
// an integration search asks for an integration page, a comparison search for
// a comparison table, and anything else for an original-data page. It is
// stored on the evidence, copied at creation like every other value there.
//
// Winnability is Write's own `assess` over the same top ten, so an Earn row
// carries the same band a Write row for that search would.
import { EFFORT_BY_TYPE } from "@/lib/config/constants";
import { isOwnDomain, isPlatformDomain, registrableDomain } from "@/lib/market/rivals/domains";
import { measured } from "@/lib/measure/measured";
import type { StoredReport } from "@/lib/scan/report";
import { assess } from "../winnability/band";
import { rankedCountsFor, type RankedCounts } from "../winnability/counts";
import { FAMILY_OF, noRejections, type EarnAsset, type Evidence } from "../types";
import { emptyDerivation, slugify, type Candidate, type DerivationResult } from "./candidate";

interface EarnInput {
  siteId: string;
  scanId: string;
  report: StoredReport;
  ownRanked: number;
  rankedCounts: RankedCounts;
}

/** The words that make a search, or a page, about integrating — read by
 *  `earnAssetFor` here and by Earn readiness (`../earn-grounding.ts`). */
export const INTEGRATION_SHAPE = /\b(?:integrat\w*|connect\w*|plugins?|api|sync\w*|zapier)\b/;
const COMPARISON_SHAPE = /\b(?:vs|versus|alternatives?|compare\w*|comparison|best|top)\b/;

/** The asset a query's shape asks for. Pure and total. */
export function earnAssetFor(query: string): EarnAsset {
  const text = query.toLowerCase();
  if (INTEGRATION_SHAPE.test(text)) return "integration_page";
  if (COMPARISON_SHAPE.test(text)) return "comparison_table";
  return "original_data_page";
}

/** The first platform and the first rival among a surface's domains, or
 *  `null` where it lacks either. The customer's own domain is neither. */
function sourceAndRival(
  hosts: readonly string[],
  ownDomain: string
): { source: string; rival: string } | null {
  let source: string | null = null;
  let rival: string | null = null;
  for (const host of hosts) {
    const domain = registrableDomain(host);
    if (domain === null || isOwnDomain(domain, ownDomain)) continue;
    if (isPlatformDomain(domain)) source ??= domain;
    else rival ??= domain;
  }
  return source === null || rival === null ? null : { source, rival };
}

export function earnCandidates(a: EarnInput): DerivationResult {
  const { report } = a;
  if (report.questions.kind === "unmeasured") return emptyDerivation();

  const at = report.verdict.measuredAt;
  const ownDomain = registrableDomain(report.domain) ?? report.domain;
  const answerRows = report.aiAnswers?.rows ?? [];
  const result: DerivationResult = { candidates: [], assessed: 0, rejected: noRejections() };

  report.questions.value.forEach((question, index) => {
    const serpAt = report.serps[index];
    if (serpAt === undefined || serpAt.kind === "unmeasured") return;
    const serp = serpAt.value;
    const query = question.search.keyword;
    const organicHosts = serp.organic.map((row) => row.domain);

    const cell = answerRows[index]?.cell;
    const fromAnswer =
      cell !== undefined && cell.kind === "answered" && !cell.namesCustomer
        ? sourceAndRival(cell.citedDomains, ownDomain)
        : null;
    const customerAbsent = !organicHosts.some((host) =>
      isOwnDomain(registrableDomain(host) ?? host, ownDomain)
    );
    const fromSearch = fromAnswer === null && customerAbsent ? sourceAndRival(organicHosts, ownDomain) : null;
    const found = fromAnswer ?? fromSearch;
    if (found === null) return;

    result.assessed += 1;
    const verdict = assess({
      top10RankedCounts: rankedCountsFor(
        organicHosts.map((host) => registrableDomain(host) ?? host),
        a.rankedCounts,
        at
      ),
      ownRanked: a.ownRanked,
      volume: question.search.volume,
    });
    if (!verdict.qualified) {
      if (verdict.because === "unmeasured_top10") result.rejected.unmeasured_top10 += 1;
      else result.rejected.not_yet += 1;
      return;
    }

    const surface = fromAnswer !== null ? "ai_answer" : "search_result";
    const volume = measured(question.search.volume, at);
    const evidence: Evidence = {
      family: "earn",
      query,
      volume,
      source: { surface, ref: found.source },
      rival: { domain: found.rival },
      asset: earnAssetFor(query),
    };
    result.candidates.push({
      siteId: a.siteId,
      scanId: a.scanId,
      type: "listed_page",
      family: FAMILY_OF.listed_page,
      targetQuery: query,
      targetRef: slugify(query),
      title: null,
      volume,
      evidence,
      acceptance:
        surface === "ai_answer" ? { form: "named_on", question: question.text } : { form: "top20", query },
      fitBand: verdict.band,
      effort: EFFORT_BY_TYPE.listed_page,
    } satisfies Candidate);
  });

  return result;
}
