// SPEC §7 *Known content*: a planned page that repeats one the site has becomes that page's `refresh_page` update where
// the destination can publish to it and the page is past the refresh floor; otherwise it stays as it was, and readiness
// makes it the update once it may be one or holds it `destination_cannot_address`. Pure: the matches are handed in and
// the destination's answer is a predicate. A Fix and an Improve are never converted: an Improve already updates a page.
import { EFFORT_BY_TYPE, REFRESH_MIN_AGE_DAYS } from "@/lib/config/constants";
import { measured } from "@/lib/measure/measured";
import type { KnownMatch } from "@/lib/known-content/types";
import type { OpportunityInsert } from "../store";
import { FAMILY_OF, type Evidence } from "../types";
import type { Candidate } from "./candidate";

export interface KnownContentGate {
  /** The closest page the site already has, where it covers this
   *  candidate's topic — `null` where the topic is net new. */
  covered: (candidate: Candidate) => KnownMatch | null;
  /** The same answer for a search the report did not ask, read when it is needed. */
  read?: (candidate: Candidate) => Promise<KnownMatch | null>;
  /** Whether the site's destination can publish an update of this page.
   *  The same predicate readiness applies (`canUpdateFrom`). */
  canUpdate: (url: string) => boolean;
  /** When this pass measured. The similarity recorded on the row is a
   *  measurement of this moment, like every other number on it. */
  at: Date;
}

/** Whether this candidate is one the rule speaks about: a page that would be
 *  written from nothing, on a topic. */
function plansANewPage(candidate: Candidate): boolean {
  return candidate.family === "write" || candidate.family === "earn";
}

/** The update of the covering page, from the candidate that would have
 *  repeated it. Everything the candidate measured about the search is kept
 *  — its volume, its band, its acceptance test — because the search has not
 *  changed; what changes is which page answers it. */
export function asUpdate(candidate: Candidate, match: KnownMatch, at: Date): Candidate {
  const url = match.page.url as string;
  const evidence: Evidence = {
    family: "improve",
    query: candidate.targetQuery ?? "",
    volume: candidate.volume ?? measured(0, at),
    pageUrl: url,
    shortfall: {
      kind: "covered",
      page: { url, title: match.page.title, source: match.page.source },
      similarity: measured(match.score, at),
    },
    ...("target" in candidate.evidence && candidate.evidence.target !== undefined
      ? { target: candidate.evidence.target }
      : {}),
  };
  return {
    ...candidate,
    type: "refresh_page",
    family: FAMILY_OF.refresh_page,
    targetRef: url,
    // The page exists and has its own title; ours would be a second one.
    title: null,
    effort: EFFORT_BY_TYPE.refresh_page,
    evidence,
  };
}

/** The columns that make a stored row the update `asUpdate` describes. */
export function updateColumns(u: Candidate): Pick<OpportunityInsert, "type" | "family" | "target_ref" | "proposed_slug" | "title" | "effort" | "evidence"> {
  return { type: u.type, family: u.family, target_ref: u.targetRef, proposed_slug: null, title: u.title, effort: u.effort, evidence: u.evidence };
}

/** SPEC §6 (2026-10-02, #1181): a page younger than `REFRESH_MIN_AGE_DAYS`
 *  is not refreshed. A page of ours with no published date is still being
 *  written, so it is young; a crawled page with none has an age we never
 *  read, and is not held back by it. */
export function tooYoungToRefresh(page: KnownMatch["page"], at: Date): boolean {
  return page.publishedAt === null ? page.source === "reachkit" : !pastRefreshFloor(page.publishedAt, at);
}

/** §6's floor, the one comparison against `REFRESH_MIN_AGE_DAYS`: a page exactly that old is past it. */
export const pastRefreshFloor = (publishedAt: Date, at: Date): boolean => at.getTime() - publishedAt.getTime() >= REFRESH_MIN_AGE_DAYS * 86_400_000;

/**
 * The candidates, with every repeat either turned into an update or left to
 * be stored as one the site already covers.
 *
 * Order and count are unchanged: nothing is dropped here. A topic that
 * cannot become an update is refused by readiness, which is where every
 * other "may this fill a day" answer is decided and stored (#884).
 */
export function applyKnownContent(candidates: readonly Candidate[], gate: KnownContentGate): Candidate[] {
  return candidates.map((candidate) => {
    if (!plansANewPage(candidate)) return candidate;
    const match = gate.covered(candidate);
    if (match === null || match.page.url === null) return candidate;
    // A young covering page is left alone: the candidate stays as it was,
    // and readiness stores it `destination_cannot_address`, as for a page we cannot
    // update.
    if (tooYoungToRefresh(match.page, gate.at)) return candidate;
    return gate.canUpdate(match.page.url) ? asUpdate(candidate, match, gate.at) : candidate;
  });
}
