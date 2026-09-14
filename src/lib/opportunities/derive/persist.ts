// BUILD §7 — writing a candidate down, once.
//
// De-duplication is the database's, not this file's: the partial unique
// index on `(site_id, type, target_query, target_ref) where status in
// ('open','queued')` is what makes a weekly top-up re-deriving the same
// target add nothing, and what lets a target whose earlier page is `done`
// or `dismissed` be proposed again. A unique violation is therefore an
// outcome and not an error — the store reports it, and it is counted.
//
// An application-side "does this already exist?" read would be a second
// statement of the same predicate, and would race against a concurrent
// derivation besides.
import type { OpportunityInsert } from "../store";
import { opportunityStore, readOpportunity } from "../store";
import type { Opportunity } from "../types";
import type { Candidate } from "./candidate";

export function insertFor(candidate: Candidate): OpportunityInsert {
  return {
    site_id: candidate.siteId,
    scan_id: candidate.scanId,
    type: candidate.type,
    family: candidate.family,
    target_query: candidate.targetQuery,
    target_ref: candidate.targetRef,
    // §10's own column, and the Write family's alone: it is the slug the
    // generation pipeline will publish under. An Improve target's page
    // already has a url and a Fix target has no page, so neither proposes
    // one — a check constraint holds that, so the column cannot quietly
    // acquire a second meaning.
    proposed_slug:
      candidate.family === "write" || candidate.family === "earn" ? candidate.targetRef : null,
    title: candidate.title,
    // §10's integer column: the number, denormalised for the surfaces and
    // sorts that read one. The measurement itself — arm, value and date —
    // rides in `evidence`, and is what `readOpportunity` reads back.
    volume: candidate.volume === null || candidate.volume.kind === "unmeasured" ? null : candidate.volume.value,
    evidence: candidate.evidence,
    acceptance: candidate.acceptance,
    fit_band: candidate.fitBand,
    effort: candidate.effort,
  };
}

export async function persist(a: {
  candidates: readonly Candidate[];
}): Promise<{ created: Opportunity[]; duplicates: number }> {
  const store = opportunityStore();
  const created: Opportunity[] = [];
  let duplicates = 0;

  for (const candidate of a.candidates) {
    const outcome = await store.insert(insertFor(candidate));
    if (outcome.outcome === "duplicate") duplicates += 1;
    else created.push(readOpportunity(outcome.row));
  }

  return { created, duplicates };
}
