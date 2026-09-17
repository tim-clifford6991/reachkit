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
// **The site's own pages, not only the home page** (SPEC §7, 2026-09-16).
// A page is an update candidate for a question where the site ranks it
// inside the position band for that question's search — read off the
// question's own bought top ten, or off the site's own ranked rows
// (`report.ownRankedRows`, the answer `ownRanked` counts, bought once) for
// the same search or one of its parent topic (`clusterKey`, the key
// Improve shares with the cluster step). A site already in the top three
// for the search has nothing to improve for it. Where several of its pages
// rank, the one the crawl read as being about the question (its inventory
// title or h1 carries the topic's words) goes first, then the best
// position. Nothing is bought here.
//
// The shortfall is still a measurement of that page: `expand_page` only
// for the home document, the one page whose length `onPage` measured;
// `answerable_page` for any ranked page, with its own position. A page
// with neither shortfall on record is not a candidate.
import { EFFORT_BY_TYPE, IMPROVE_POSITION_BAND, THIN_PAGE_VISIBLE_CHARS } from "@/lib/config/constants";
import { isOwnDomain, registrableDomain } from "@/lib/market/rivals/domains";
import { measured } from "@/lib/measure/measured";
import type { StoredReport } from "@/lib/scan/report";
import type { InventoryRow } from "@/lib/site-profile/types";
import { demandBand, rightSizedBand } from "../winnability/band";
import { rankedCountsFor, type RankedCounts } from "../winnability/counts";
import { FAMILY_OF, noRejections, type Evidence, type Shortfall } from "../types";
import { brandTokensOf, canonicalUrl, clusterKey } from "../cluster";
import { emptyDerivation, type Candidate, type DerivationResult } from "./candidate";
import { targetFactsOf } from "./target";

interface ImproveInput {
  siteId: string;
  scanId: string;
  report: StoredReport;
  ownRanked: number;
  rankedCounts: RankedCounts;
  /** The pages the crawl read. Absent reads as none. */
  inventory?: readonly InventoryRow[];
}

/** One of the site's own pages ranking for a question's search. */
interface OwnedRanking {
  url: string;
  position: number;
  /** Ranked for the question's very search, not a sibling in its topic. */
  exact: boolean;
  /** The crawl read this page, and its title or h1 carries the topic. */
  topical: boolean;
}

function normalised(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

function topicWords(text: string, brandTokens: readonly string[]): ReadonlySet<string> {
  return new Set((clusterKey(text, brandTokens) ?? "").split(" ").filter((word) => word !== ""));
}

/** Exact before topic, a page about the question before one that is not,
 *  then the better position, then the address — a total order. */
function compareOwned(a: OwnedRanking, b: OwnedRanking): number {
  if (a.exact !== b.exact) return a.exact ? -1 : 1;
  if (a.topical !== b.topical) return a.topical ? -1 : 1;
  if (a.position !== b.position) return a.position - b.position;
  return a.url < b.url ? -1 : a.url > b.url ? 1 : 0;
}

export function improveCandidates(a: ImproveInput): DerivationResult {
  const { report } = a;
  if (report.questions.kind === "unmeasured") return emptyDerivation();

  const at = report.verdict.measuredAt;
  const home = report.onPage.kind === "unmeasured" ? null : report.onPage.value;
  const ownDomain = registrableDomain(report.domain) ?? report.domain;
  const answerRows = report.aiAnswers?.rows ?? [];
  const brandTokens = brandTokensOf(report);
  const ranked = report.ownRankedRows;
  const inventory = new Map((a.inventory ?? []).map((row) => [canonicalUrl(row.url), row] as const));

  const topical = (url: string, topic: ReadonlySet<string>): boolean => {
    const page = inventory.get(canonicalUrl(url));
    if (page === undefined || topic.size === 0) return false;
    return [page.title, page.h1].some((text) => {
      const words = topicWords(text, brandTokens);
      return [...topic].every((word) => words.has(word));
    });
  };

  const result: DerivationResult = { candidates: [], assessed: 0, rejected: noRejections() };
  // One page, one candidate: a page cannot be both expanded and made
  // answerable in two separate pages, and two rows against the same
  // `target_ref` differ only by type — which the partial unique index
  // would let through and §8's near-duplicate gate would then refuse.
  const claimed = new Set<string>();

  report.questions.value.forEach((question, index) => {
    const serpAt = report.serps[index];
    if (serpAt === undefined || serpAt.kind === "unmeasured") return;
    const serp = serpAt.value;
    const query = question.search.keyword;
    const exactQuery = normalised(query);
    const topicKey = clusterKey(query, brandTokens);
    const topic = topicWords(query, brandTokens);

    const owned: OwnedRanking[] = [];
    for (const row of serp.organic) {
      if (!isOwnDomain(registrableDomain(row.domain) ?? row.domain, ownDomain)) continue;
      owned.push({ url: row.url, position: row.position, exact: true, topical: topical(row.url, topic) });
    }
    for (const row of ranked) {
      const exact = normalised(row.keyword) === exactQuery;
      if (!exact && (topicKey === null || clusterKey(row.keyword, brandTokens) !== topicKey)) continue;
      owned.push({ url: row.url, position: row.position, exact, topical: topical(row.url, topic) });
    }
    // Already in the top three for this very search: nothing to improve.
    if (owned.some((row) => row.exact && row.position < IMPROVE_POSITION_BAND.min)) return;

    const inBand = owned
      .filter((row) => row.position >= IMPROVE_POSITION_BAND.min && row.position <= IMPROVE_POSITION_BAND.max)
      .sort(compareOwned);
    if (inBand.length === 0) return;
    result.assessed += 1;

    const cell = answerRows[index]?.cell;
    const ignoredByTheAnswer = cell !== undefined && cell.kind === "answered" && !cell.namesCustomer;

    const chosen = inBand
      .filter((row) => !claimed.has(canonicalUrl(row.url)))
      .map((row): { row: OwnedRanking; type: "expand_page" | "answerable_page"; shortfall: Shortfall } | null => {
        if (home !== null && canonicalUrl(row.url) === canonicalUrl(home.url) && home.visibleChars < THIN_PAGE_VISIBLE_CHARS) {
          return { row, type: "expand_page", shortfall: { kind: "thin", words: measured(home.visibleChars, at) } };
        }
        if (ignoredByTheAnswer) {
          return { row, type: "answerable_page", shortfall: { kind: "position", position: measured(row.position, at) } };
        }
        return null;
      })
      .find((option) => option !== null);
    if (chosen === undefined || chosen === null) return;
    const { row, type, shortfall } = chosen;

    // The same sizing a Write for this search gets, so both sides of the
    // daily decision are right-sized alike (§7, 2026-09-16): a search
    // outsized for the site offers no update either (§6, 2026-09-16). The
    // competition bar gates `keyword_page` only (§6, 2026-09-15), and no
    // Improve type is one, so otherwise the band is recorded and never
    // drops a page.
    const sizing = {
      top10RankedCounts: rankedCountsFor(
        serp.organic.map((organic) => registrableDomain(organic.domain) ?? organic.domain),
        a.rankedCounts,
        at
      ),
      ownRanked: a.ownRanked,
      volume: question.search.volume,
    };
    if (demandBand(sizing) === "not-yet") {
      result.rejected.not_yet += 1;
      return;
    }
    const band = rightSizedBand(sizing);

    const volume = measured(question.search.volume, at);
    const evidence: Evidence = {
      family: "improve",
      query,
      volume,
      pageUrl: row.url,
      shortfall,
      // What this page is optimising for, copied at creation (issue 867).
      target: targetFactsOf({
        difficulty: question.search.difficulty,
        ownRanked: a.ownRanked,
        answerRow: answerRows[index],
        at,
      }),
    };
    result.candidates.push({
      siteId: a.siteId,
      scanId: a.scanId,
      type,
      family: FAMILY_OF[type],
      targetQuery: query,
      targetRef: row.url,
      title: null,
      volume,
      evidence,
      acceptance:
        type === "answerable_page"
          ? { form: "named_on", question: question.text }
          : { form: "top20", query },
      fitBand: band,
      effort: EFFORT_BY_TYPE[type],
    } satisfies Candidate);
    claimed.add(canonicalUrl(row.url));
  });

  return result;
}
