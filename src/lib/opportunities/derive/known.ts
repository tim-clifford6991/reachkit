// SPEC §7 (2026-09-20, #928) — "A planned page that overlaps one of them
// becomes an **update** of that page where the destination can publish to
// it; otherwise the topic is skipped and the existing page is linked from
// related pages."
//
// The net-new rule, as a function over candidates. Pure: the matches are
// handed in (the database narrows, `known-content/match.ts` scores) and the
// destination's answer is a predicate, so the whole of this decision is
// assertable with no database, no network and no vendor.
//
// **Three outcomes, and the third is the ordinary one.**
//
//   · *Covered, and the destination can publish to that page* — the
//     candidate becomes a `refresh_page` update of it. `refresh_page` and
//     not a new type: its job, as the drafting prompt already states it, is
//     "bring the page up to date with what is true now, keeping what still
//     holds and replacing what no longer does" — which is what a planned
//     page on a topic the site already covers is for. Its shortfall is the
//     new `covered` arm, which records the page and the score that matched
//     them, so nothing is invented: a `thin` or `position` shortfall would
//     be a measurement of that page that nobody took.
//   · *Covered, and it cannot* — the candidate stays as it was. Readiness
//     stores `already_covered` against it (`readiness.ts`), so it never
//     fills a day, and the page that covers it becomes a link target.
//   · *Not covered* — untouched. Most pages are net new, and this function
//     is a pass over a list for them.
//
// **A Fix and an Improve are never converted.** A Fix targets no search, and
// an Improve is already an update of an existing page — converting one
// against a *different* page would move a row's target under it.
import { EFFORT_BY_TYPE, REFRESH_MIN_AGE_DAYS } from "@/lib/config/constants";
import { measured } from "@/lib/measure/measured";
import type { KnownMatch } from "@/lib/known-content/types";
import { FAMILY_OF, type Evidence } from "../types";
import type { Candidate } from "./candidate";

export interface KnownContentGate {
  /** The closest page the site already has, where it covers this
   *  candidate's topic — `null` where the topic is net new. */
  covered: (candidate: Candidate) => KnownMatch | null;
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
function asUpdate(candidate: Candidate, match: KnownMatch, at: Date): Candidate {
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

/** SPEC §6 (2026-10-02, #1181): a page younger than `REFRESH_MIN_AGE_DAYS`
 *  is not refreshed. A page of ours with no published date is still being
 *  written, so it is young; a crawled page with none has an age we never
 *  read, and is not held back by it. */
function tooYoungToRefresh(page: KnownMatch["page"], at: Date): boolean {
  if (page.publishedAt === null) return page.source === "reachkit";
  return at.getTime() - page.publishedAt.getTime() < REFRESH_MIN_AGE_DAYS * 86_400_000;
}

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
    // and readiness stores it `already_covered`, as for a page we cannot
    // update.
    if (tooYoungToRefresh(match.page, gate.at)) return candidate;
    return gate.canUpdate(match.page.url) ? asUpdate(candidate, match, gate.at) : candidate;
  });
}
