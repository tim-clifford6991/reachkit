// SPEC §6 — "Cluster by parent topic. One cluster-day, at most one Write per
// cluster. Improve of an owned URL outranks a new page."
//
// Owner, 2026-09-15: the parent topic is a mechanical `clusterKey()` of the
// query's content words — lower-cased, stop words, brand tokens and a
// trailing `s` removed, sorted and joined — and Improve uses the same key.
// Nothing is bought to cluster: the key is a function of the words.
//
// Pure. No model, no fetch, no clock. Every family keys the same way, so a
// family added later (an Earn row's readiness, say) clusters with no branch
// here.
import { stemKey } from "@/lib/market/questions/select";
import { registrableDomain } from "@/lib/market/rivals/domains";
import type { StoredReport } from "@/lib/scan/report";
import type { Candidate } from "./derive/candidate";
import { qualifiesForADay, type Family, type Opportunity, type OpportunityType, type Winnability } from "./types";

/**
 * The one canonical form of a page address: scheme, a `www.` label, a
 * fragment and trailing slashes dropped, lower-cased. A query string is part
 * of a page's identity and is kept. The Improve deriver compares its ranking
 * row with the measured page through this, and a retired URL is matched
 * through it.
 */
export function canonicalUrl(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/#.*$/, "")
    .replace(/\/+$/, "");
}

/** The brand tokens a cluster key drops: the customer's own (the profile's
 *  `brandTokens`) and each measured rival's name — its registrable domain's
 *  first label, the tokenisation the Write deriver already uses. */
export function brandTokensOf(report: StoredReport): readonly string[] {
  const own = report.market.kind === "unmeasured" ? [] : report.market.value.profile.brandTokens;
  const rivals =
    report.rivals.kind === "unmeasured"
      ? []
      : report.rivals.value.map((rival) => (registrableDomain(rival.domain) ?? rival.domain).split(".")[0] ?? "");
  return [...own, ...rivals].filter((token) => token.trim() !== "");
}

/**
 * The parent topic of a query, or `null` where it has none: no query (a Fix
 * targets no search), or nothing left once stop words and brands are gone —
 * a search for a brand alone has no topic to share.
 */
export function clusterKey(query: string | null, brandTokens: readonly string[]): string | null {
  if (query === null) return null;
  const brands = new Set(brandTokens.flatMap((token) => stemKey(token).split(" ")).filter((t) => t !== ""));
  const words = [...new Set(stemKey(query).split(" "))].filter((token) => token !== "" && !brands.has(token));
  return words.length === 0 ? null : words.sort().join(" ");
}

/** SPEC §6: Improve of an owned URL, then an Earn asset, then new writing. */
const FAMILY_ORDER: Readonly<Record<Family, number>> = Object.freeze({ improve: 0, earn: 1, write: 2, fix: 3 });

/** Owner, 2026-09-15: `answer_page` > `comparison_page` > `format_page` >
 *  `keyword_page`. Types outside the Write family share one place. */
const WRITE_TYPE_ORDER: Readonly<Partial<Record<OpportunityType, number>>> = Object.freeze({
  answer_page: 0,
  comparison_page: 1,
  format_page: 2,
  keyword_page: 3,
});

/** Negative where `a` goes first. Family, then Write type; nothing else —
 *  the score and age are the ranking's to add after this. */
export function comparePrecedence(
  a: { family: Family; type: OpportunityType },
  b: { family: Family; type: OpportunityType }
): number {
  const family = FAMILY_ORDER[a.family] - FAMILY_ORDER[b.family];
  if (family !== 0) return family;
  return (WRITE_TYPE_ORDER[a.type] ?? 0) - (WRITE_TYPE_ORDER[b.type] ?? 0);
}

/** A candidate as it is written: its cluster and the sibling searches it
 *  absorbed. */
export type ClusteredCandidate = Candidate & { clusterKey: string | null; absorbedQueries: readonly string[] };

export interface CollapsePlan {
  /** Existing open rows that lost their cluster to a better row. Applied
   *  first, so the one-open-row-per-cluster index never sees two. */
  dismiss: readonly string[];
  /** Existing rows that keep their place and take a cluster key or more
   *  absorbed searches. */
  update: readonly { id: string; clusterKey: string; absorbedQueries: readonly string[] }[];
  insert: readonly ClusteredCandidate[];
}

type Member =
  | { kind: "row"; row: Opportunity }
  | { kind: "candidate"; candidate: Candidate };

function volumeOf(m: Member): number {
  const volume = m.kind === "row" ? m.row.volume : m.candidate.volume;
  return volume === null || volume.kind === "unmeasured" ? 0 : volume.value;
}

function shapeOf(m: Member): { family: Family; type: OpportunityType } {
  return m.kind === "row" ? m.row : m.candidate;
}

function queryOf(m: Member): string | null {
  return m.kind === "row" ? m.row.targetQuery : m.candidate.targetQuery;
}

/** A queued row always survives; then a right-sized member over an
 *  outsized one (issue 881); then precedence; then a row already held over
 *  a new candidate (a re-derivation moves nothing); then volume. */
/** The band a member carries, row or candidate. */
function bandOf(m: Member): Winnability | null {
  return m.kind === "row" ? m.row.fitBand : m.candidate.fitBand;
}

function compareMembers(a: Member, b: Member): number {
  const queued = Number(b.kind === "row" && b.row.status === "queued") - Number(a.kind === "row" && a.row.status === "queued");
  if (queued !== 0) return queued;
  // Issue 881: the stale-evidence half. A re-measure **adds** to a site's
  // rows and recalculates none of them, so the targets derived before
  // right-sizing shipped are still on file with the band they were given
  // then. Held-row-wins meant one of those outsized rows survived its
  // cluster and the pass's own right-sized candidate for the same topic was
  // never written — the old competing with the new, and winning. A member
  // that may fill a day outranks one that may not, whichever is the row.
  const sized = Number(qualifiesForADay(bandOf(b))) - Number(qualifiesForADay(bandOf(a)));
  if (sized !== 0) return sized;
  const precedence = comparePrecedence(shapeOf(a), shapeOf(b));
  if (precedence !== 0) return precedence;
  const held = Number(b.kind === "row") - Number(a.kind === "row");
  if (held !== 0) return held;
  return volumeOf(b) - volumeOf(a);
}

/**
 * One survivor per cluster, over the site's existing open and queued non-Fix
 * rows and this pass's candidates together.
 *
 * The survivor absorbs every other member's search. A losing open row is
 * dismissed; a losing candidate is not written; a queued row is never
 * dismissed — where a cluster already holds a queued row it survives, and a
 * second queued row in the same cluster keeps its place unclustered. Fix
 * candidates and rows with no topic pass through untouched.
 */
export function collapse(a: {
  existing: readonly Opportunity[];
  candidates: readonly Candidate[];
  brandTokens: readonly string[];
}): CollapsePlan {
  const groups = new Map<string, Member[]>();
  const insert: ClusteredCandidate[] = [];

  const add = (key: string | null, member: Member): boolean => {
    if (key === null) return false;
    const group = groups.get(key) ?? [];
    group.push(member);
    groups.set(key, group);
    return true;
  };

  for (const row of a.existing) {
    if (row.family === "fix" || (row.status !== "open" && row.status !== "queued")) continue;
    add(row.clusterKey ?? clusterKey(row.targetQuery, a.brandTokens), { kind: "row", row });
  }
  for (const candidate of a.candidates) {
    const key = candidate.family === "fix" ? null : clusterKey(candidate.targetQuery, a.brandTokens);
    if (!add(key, { kind: "candidate", candidate })) insert.push({ ...candidate, clusterKey: null, absorbedQueries: [] });
  }

  const dismiss: string[] = [];
  const update: { id: string; clusterKey: string; absorbedQueries: string[] }[] = [];
  for (const [key, members] of groups) {
    const [survivor, ...rest] = [...members].sort(compareMembers);
    if (survivor === undefined) continue;

    const own = queryOf(survivor)?.trim().toLowerCase() ?? null;
    const absorbed = new Set<string>(survivor.kind === "row" ? survivor.row.absorbedQueries : []);
    for (const member of rest) {
      if (member.kind === "row" && member.row.status === "queued") continue;
      if (member.kind === "row") dismiss.push(member.row.id);
      for (const query of [queryOf(member), ...(member.kind === "row" ? member.row.absorbedQueries : [])]) {
        if (query !== null && query.trim().toLowerCase() !== own) absorbed.add(query);
      }
    }
    const absorbedQueries = [...absorbed].sort();

    if (survivor.kind === "candidate") {
      insert.push({ ...survivor.candidate, clusterKey: key, absorbedQueries });
    } else if (survivor.row.clusterKey !== key || absorbedQueries.join("\n") !== [...survivor.row.absorbedQueries].sort().join("\n")) {
      update.push({ id: survivor.row.id, clusterKey: key, absorbedQueries });
    }
  }
  return { dismiss, update, insert };
}
