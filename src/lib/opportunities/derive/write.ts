// BUILD §7 — the Write family, from measured evidence only.
//
// §7's four Write triggers, and which of them this file can derive:
//
//   answer_page      "AI answer for a question names rivals, not customer"
//                    — the question's answer cell is `answered`, does not
//                    name the customer, and cites a domain that is not
//                    theirs.
//   keyword_page     "Rival top-20 for a query >=10/mo; customer absent"
//                    — no organic row in the bought top ten is on the
//                    customer's domain, and the search clears the volume
//                    floor.
//   comparison_page  "Gap query names a rival or contains vs/alternative"
//                    — the search's own words say so.
//   format_page      **not derived here.** "Rivals have a page type
//                    customer lacks entirely" names a page *type*, and no
//                    measurement in the stored report states one. Deriving
//                    it would mean composing a value the product never
//                    measured. It arises only where `refineType` refines an
//                    already-derived candidate's type within the closed
//                    enum — the one thing a model is allowed to do here.
//                    Adding a deterministic rule later is a branch in this
//                    file and a fixture; nothing stored changes.
//
// **At most one Write candidate per search.** The three triggers overlap —
// a "best X vs Y" search can be absent from its top ten *and* name a rival
// *and* be the one an AI answer ignored the customer on — and three pages
// for one search is three near-duplicates §8's gate would refuse anyway.
// Precedence is `answer_page` > `comparison_page` > `keyword_page`:
// strongest evidence first (an AI answer that named rivals is a measured
// absence from the surface §7 exists to win), then the more specific
// shape. Chosen here, recorded here; reversing it is this ordering and its
// fixtures.
import { WRITE_VOLUME_FLOOR_PER_MONTH } from "@/lib/config/constants";
import { EFFORT_BY_TYPE } from "@/lib/config/constants";
import { isOwnDomain, registrableDomain } from "@/lib/market/rivals/domains";
import { measured, type Measured } from "@/lib/measure/measured";
import type { StoredReport } from "@/lib/scan/report";
import type { SerpResult } from "@/lib/vendors/dataforseo/types";
import { assess, rightSizedBand } from "../winnability/band";
import { rankedCountsFor, type RankedCounts } from "../winnability/counts";
import { FAMILY_OF, noRejections, type Evidence, type OpportunityType } from "../types";
import { emptyDerivation, slugify, type Candidate, type DerivationResult } from "./candidate";
import { targetFactsOf } from "./target";

/** §7's comparison trigger, second half: "contains vs/alternative". */
const COMPARISON_SHAPES = [/\bvs\b/, /\bversus\b/, /\balternatives?\b/];

interface WriteInput {
  siteId: string;
  scanId: string;
  report: StoredReport;
  ownRanked: number;
  rankedCounts: RankedCounts;
}

/** The rival row a Write candidate points at: the best-placed organic
 *  result that is not the customer's own. `null` where the SERP had none —
 *  a top ten made entirely of the customer's own pages is not a gap. */
function bestRival(
  serp: SerpResult,
  ownDomain: string,
  at: Date
): { domain: string; url: Measured<string>; position: Measured<number> } | null {
  for (const row of serp.organic) {
    const domain = registrableDomain(row.domain) ?? row.domain;
    if (isOwnDomain(domain, ownDomain)) continue;
    return { domain, url: measured(row.url, at), position: measured(row.position, at) };
  }
  return null;
}

/** The rival named by an AI answer that ignored the customer: the first
 *  cited domain that is not theirs. */
function citedRival(citedDomains: readonly string[], ownDomain: string): string | null {
  for (const cited of citedDomains) {
    const domain = registrableDomain(cited) ?? cited;
    if (!isOwnDomain(domain, ownDomain)) return domain;
  }
  return null;
}

function namesARival(query: string, rivalDomains: readonly string[]): boolean {
  const text = query.toLowerCase();
  if (COMPARISON_SHAPES.some((shape) => shape.test(text))) return true;
  return rivalDomains.some((domain) => {
    // The rival's brand token is the registrable domain's first label —
    // the same tokenisation the citation/mention rule uses (DECISIONS,
    // 2026-09-05).
    const [brand] = (registrableDomain(domain) ?? domain).split(".");
    return brand !== undefined && brand.length > 2 && text.includes(brand);
  });
}

/**
 * The Write candidates one completed scan's evidence produces.
 *
 * Deterministic: no model call, no network, no clock. Every evidence value
 * is copied out of the report at construction — the value and its date —
 * so the day panel's explanation still reads correctly after the next
 * weekly scan has moved the numbers.
 */
export function writeCandidates(a: WriteInput): DerivationResult {
  const { report } = a;
  if (report.questions.kind === "unmeasured") return emptyDerivation();

  const at = report.verdict.measuredAt;
  const ownDomain = registrableDomain(report.domain) ?? report.domain;
  const rivalDomains =
    report.rivals.kind === "unmeasured" ? [] : report.rivals.value.map((rival) => rival.domain);
  const answerRows = report.aiAnswers?.rows ?? [];

  const result: DerivationResult = {
    candidates: [],
    assessed: 0,
    rejected: noRejections(),
  };

  report.questions.value.forEach((question, index) => {
    const serpAt = report.serps[index];
    if (serpAt === undefined || serpAt.kind === "unmeasured") return;
    const serp = serpAt.value;
    const query = question.search.keyword;
    const volume = measured(question.search.volume, at);

    result.assessed += 1;

    const top10RankedCounts = rankedCountsFor(
      serp.organic.map((row) => registrableDomain(row.domain) ?? row.domain),
      a.rankedCounts,
      at
    );
    // The search's own difficulty, where the vendor measured one (issue
    // 858): it reads a top ten the counts could not, and it still does
    // where a pass's purse could not size every domain its own SERPs hold
    // (issue 901).
    const sizing = {
      top10RankedCounts,
      ownRanked: a.ownRanked,
      volume: question.search.volume,
      difficulty: question.search.difficulty ?? null,
    };
    const verdict = assess(sizing);

    const rival = bestRival(serp, ownDomain, at);
    if (rival === null) return;

    // Every answer column the pass measured, not only the AI Overview
    // (issue 858): a long-tail search often has no Overview at all, while
    // ChatGPT and AI Mode — bought beside it on a paid pass — answer it and
    // name rivals. A stored row from before the engines has its cell alone.
    const row = answerRows[index];
    const answerCells = row === undefined ? [] : row.engines.length > 0 ? row.engines.map((engine) => engine.cell) : [row.cell];
    const ignoredByTheAnswer = answerCells.some(
      (answerCell) =>
        answerCell.kind === "answered" &&
        !answerCell.namesCustomer &&
        citedRival(answerCell.citedDomains, ownDomain) !== null
    );

    const customerAbsent = !serp.organic.some((row) =>
      isOwnDomain(registrableDomain(row.domain) ?? row.domain, ownDomain)
    );

    let type: OpportunityType | null = null;
    if (ignoredByTheAnswer) type = "answer_page";
    else if (customerAbsent && namesARival(query, rivalDomains)) type = "comparison_page";
    else if (customerAbsent && question.search.volume >= WRITE_VOLUME_FLOOR_PER_MONTH)
      type = "keyword_page";
    if (type === null) return;

    // The competition bar gates `keyword_page` only (SPEC §6, 2026-09-15).
    // An answer or comparison page keeps its band — ranking still weighs it
    // — but a top ten of large domains does not drop it. A search outsized
    // for the site drops every type (right-sizing law, §6, 2026-09-16).
    if (!verdict.qualified && (type === "keyword_page" || verdict.because === "outsized")) {
      if (verdict.because === "unmeasured_top10") result.rejected.unmeasured_top10 += 1;
      else result.rejected.not_yet += 1;
      return;
    }

    const evidence: Evidence = {
      family: "write",
      query,
      volume,
      rival,
      // What this page is optimising for, copied at creation (issue 867).
      target: targetFactsOf({
        difficulty: question.search.difficulty,
        ownRanked: a.ownRanked,
        answerRow: row,
        at,
      }),
    };
    result.candidates.push({
      siteId: a.siteId,
      scanId: a.scanId,
      type,
      family: FAMILY_OF[type],
      targetQuery: query,
      targetRef: slugify(query),
      title: null,
      volume,
      evidence,
      acceptance:
        type === "answer_page"
          ? { form: "named_on", question: question.text }
          : { form: "top20", query },
      fitBand: verdict.qualified ? verdict.band : rightSizedBand(sizing),
      effort: EFFORT_BY_TYPE[type],
    } satisfies Candidate);
  });

  return result;
}
