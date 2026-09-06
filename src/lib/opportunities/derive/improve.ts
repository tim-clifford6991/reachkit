// BUILD §7 — the Improve family, over pages the scan actually measured.
//
// §7's three Improve triggers, and which of them this file can derive:
//
//   expand_page      "Customer ranks 4-30, page thin" — the customer's own
//                    page is in the bought top ten inside the position
//                    band, and the visible-character count the parser
//                    measured on it is under the thin floor.
//   answerable_page  "Page has search value, low answerability" — the same
//                    page ranks for a tracked question's search, and the
//                    AI answer for that question does not name the
//                    customer. The shortfall is its own position.
//   refresh_page     "Ranking page stale vs rivals'" — **not derived
//                    here.** Staleness is a comparison of last-changed
//                    dates, and nothing the measurement engine stores is
//                    one: `OnPageFacts` counts headings, answers, evidence
//                    tokens and characters, and reads no `Last-Modified`,
//                    no `dateModified` and no rival's. `Shortfall`'s
//                    `stale` arm exists and is storable — the type surface
//                    is closed and complete — but no candidate carries it
//                    until a last-changed measurement does. Composing one
//                    from what we have would be exactly the invented value
//                    §7's "measured evidence" rule forbids.
//
// **Cold start yields nothing here, by construction.** The Improve family
// needs a page of the customer's that ranks; a domain that ranks for
// nothing has none, and this file produces none rather than inventing a
// page to improve. That is §6.6's cold-start law holding without a branch:
// "all Write-family at first (nothing to Improve yet) ... Improve types
// appear naturally as pages start ranking."
//
// **One measured page.** The scan reads the customer's home document and
// no other (there is no crawler — §17). So a candidate is produced only
// where the ranking url is the very url `onPage` was measured on: the
// shortfall must be a measurement *of that page*, not of a different one.
import { EFFORT_BY_TYPE, IMPROVE_POSITION_BAND, THIN_PAGE_VISIBLE_CHARS } from "@/lib/config/constants";
import { isOwnDomain, registrableDomain } from "@/lib/market/rivals/domains";
import { measured } from "@/lib/measure/measured";
import type { StoredReport } from "@/lib/scan/report";
import { assess } from "../winnability/band";
import { rankedCountsFor, type RankedCounts } from "../winnability/counts";
import { FAMILY_OF, noRejections, type Evidence, type OpportunityType, type Shortfall } from "../types";
import { emptyDerivation, type Candidate, type DerivationResult } from "./candidate";

interface ImproveInput {
  siteId: string;
  scanId: string;
  report: StoredReport;
  ownRanked: number;
  rankedCounts: RankedCounts;
}

/** Two urls name the same page where they differ only in scheme, a `www.`
 *  label, a trailing slash or a fragment. Deliberately narrow: a query
 *  string is part of a page's identity and is not stripped. */
function sameUrl(a: string, b: string): boolean {
  const strip = (url: string): string =>
    url
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/#.*$/, "")
      .replace(/\/+$/, "");
  return strip(a) === strip(b);
}

export function improveCandidates(a: ImproveInput): DerivationResult {
  const { report } = a;
  if (report.questions.kind === "unmeasured") return emptyDerivation();
  if (report.onPage.kind === "unmeasured") return emptyDerivation();

  const at = report.verdict.measuredAt;
  const facts = report.onPage.value;
  const ownDomain = registrableDomain(report.domain) ?? report.domain;
  const answerRows = report.aiAnswers?.rows ?? [];

  const result: DerivationResult = { candidates: [], assessed: 0, rejected: noRejections() };
  // One page, one candidate: the measured page cannot be both expanded and
  // made answerable in two separate pages, and two rows against the same
  // `target_ref` differ only by type — which the partial unique index
  // would let through and §8's near-duplicate gate would then refuse.
  let claimed = false;

  report.questions.value.forEach((question, index) => {
    if (claimed) return;
    const serpAt = report.serps[index];
    if (serpAt === undefined || serpAt.kind === "unmeasured") return;
    const serp = serpAt.value;

    const ownRow = serp.organic.find((row) =>
      isOwnDomain(registrableDomain(row.domain) ?? row.domain, ownDomain)
    );
    if (ownRow === undefined) return;
    if (ownRow.position < IMPROVE_POSITION_BAND.min) return;
    if (ownRow.position > IMPROVE_POSITION_BAND.max) return;
    if (!sameUrl(ownRow.url, facts.url)) return;

    result.assessed += 1;

    const verdict = assess({
      top10RankedCounts: rankedCountsFor(
        serp.organic.map((row) => registrableDomain(row.domain) ?? row.domain),
        a.rankedCounts,
        at
      ),
      ownRanked: a.ownRanked,
    });
    if (!verdict.qualified) {
      if (verdict.because === "not_yet") result.rejected.not_yet += 1;
      else result.rejected.unmeasured_top10 += 1;
      return;
    }

    const query = question.search.keyword;
    const volume = measured(question.search.volume, at);
    const cell = answerRows[index]?.cell;
    const ignoredByTheAnswer =
      cell !== undefined && cell.kind === "answered" && !cell.namesCustomer;

    let type: OpportunityType;
    let shortfall: Shortfall;
    if (facts.visibleChars < THIN_PAGE_VISIBLE_CHARS) {
      type = "expand_page";
      shortfall = { kind: "thin", words: measured(facts.visibleChars, at) };
    } else if (ignoredByTheAnswer) {
      type = "answerable_page";
      shortfall = { kind: "position", position: measured(ownRow.position, at) };
    } else {
      return;
    }

    const evidence: Evidence = {
      family: "improve",
      query,
      volume,
      pageUrl: ownRow.url,
      shortfall,
    };
    result.candidates.push({
      siteId: a.siteId,
      scanId: a.scanId,
      type,
      family: FAMILY_OF[type],
      targetQuery: query,
      targetRef: ownRow.url,
      title: null,
      volume,
      evidence,
      acceptance:
        type === "answerable_page"
          ? { form: "named_on", question: question.text }
          : { form: "top20", query },
      fitBand: verdict.band,
      effort: EFFORT_BY_TYPE[type],
    } satisfies Candidate);
    claimed = true;
  });

  return result;
}
