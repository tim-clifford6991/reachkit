// SPEC §7 (D53, issue 1268) — a live page of ours becomes an update topic
// with a new target.
//
// A leaf: `npm run retarget` builds the row on a box with no database, so
// this imports nothing that reaches one.
import { EFFORT_BY_TYPE, TOPIC_FIT } from "@/lib/config/constants";
import { measured, unmeasured } from "@/lib/measure/measured";
import type { Candidate } from "./derive/candidate";
import { FAMILY_OF, type Opportunity } from "./types";

/**
 * SPEC §7 (D53, issue 1268): one of ReachKit's own live pages, rewritten in
 * place for a new search. An update of the page's own address — a new
 * version there, as a refresh is — whose search is `target` and not the one
 * the page was written for, so its acceptance test is the new search's and
 * no fit or source judged for the old one is carried. The target is the
 * operator's own choice, so it is stored at the top fit and no pass judges
 * it (issue 1285: a pass scored reachkit.app's own category 1, and the page
 * could never be written). It is written as the new search's own type
 * (`contentTypeOf`). `volume` is the new search's monthly searches where
 * they were measured. Pure.
 */
export function retargetCandidate(
  page: { url: string; row: Pick<Opportunity, "siteId" | "scanId" | "fitBand"> },
  a: { target: string; volume: number | null; at: Date }
): Candidate {
  const target = a.target.replace(/\s+/g, " ").trim();
  const volume = a.volume === null ? unmeasured<number>("not_attempted", a.at) : measured(a.volume, a.at);
  return {
    siteId: page.row.siteId,
    scanId: page.row.scanId,
    type: "refresh_page",
    family: FAMILY_OF.refresh_page,
    targetQuery: target,
    targetRef: page.url,
    // The writer titles the page for its new search.
    title: null,
    volume,
    evidence: { family: "improve", query: target, volume, pageUrl: page.url, shortfall: { kind: "retarget" } },
    acceptance: { form: "top20", query: target },
    fitBand: page.row.fitBand,
    businessFit: TOPIC_FIT.writeAt,
    source: null,
    effort: EFFORT_BY_TYPE.refresh_page,
  };
}
