// BUILD §7 — the shape the three family derivations produce.
//
// A `Candidate` is an `Opportunity` minus the three fields the database
// assigns: its id, its status (always `open` at creation) and its creation
// time. Internal to this directory — it is not part of the engine's public
// surface, because nothing outside derivation may hold an opportunity that
// has not been persisted.
import type { Opportunity, RejectionCount } from "../types";
import { noRejections } from "../types";

/** The cluster and readiness fields are omitted too: the database defaults
 *  them, and the cluster step that fills them is not this file's. */
export type Candidate = Omit<
  Opportunity,
  "id" | "status" | "createdAt" | "clusterKey" | "absorbedQueries" | "ready" | "unreadyReason"
>;

export interface DerivationResult {
  candidates: Candidate[];
  /** How many targets were looked at, whether or not they became
   *  candidates. `assessed - candidates.length` is the number rejected,
   *  and every rejection lands in exactly one counter below. */
  assessed: number;
  rejected: RejectionCount;
}

export function emptyDerivation(): DerivationResult {
  return { candidates: [], assessed: 0, rejected: noRejections() };
}

/** A URL-safe slug from a search. Deterministic and ASCII-only: the same
 *  query always proposes the same slug, which is what lets the partial
 *  unique index recognise a weekly re-derivation of the same target. */
export function slugify(query: string): string {
  return query
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
