// SPEC §6 — "A day is filled only by an opportunity that passes readiness.
// Never pad the calendar."
//
// `opportunityReady()` is the one predicate, and its answer is stored on the
// row (`ready`, `unready_reason`), so supply and next-work read the column and
// never re-derive it. Owner, 2026-09-15:
//
//   - a grounding fact is at least one passage from the site's own measured
//     page text; with none, every Write/Earn/Improve row is
//     `no_grounding_fact` and supply is 0;
//   - a `keyword_page` is ready only when volume ≥ `KEYWORD_PAGE_MIN_VOLUME`,
//     the band is `winnable`, the intent is commercial or transactional, and
//     no owned URL ranks for it (else it is Improve's) — otherwise
//     `keyword_gate`;
//   - a `format_page` is ready only when its query contains comparison / vs /
//     alternative / integration / template — otherwise `format_not_allowed`.
//
// And SPEC §6's Monday verdicts (issue 477): a Write in a cluster judged not
// working is `cluster_suppressed`, anything targeting a retired URL is
// `url_retired` (`suppression.ts`).
//
// The Fix family keeps its own predicate (`fixPageReadiness`): its readiness
// is a question about the destination, not about the market.
import { FORMAT_PAGE_ALLOWED, KEYWORD_PAGE_MIN_VOLUME } from "@/lib/config/constants";
import { classifyIntent } from "@/lib/market/questions/select";
import type { Profile } from "@/lib/market/questions/profile";
import { isOwnDomain, registrableDomain } from "@/lib/market/rivals/domains";
import type { StoredReport } from "@/lib/scan/report";
import { opportunityStore, readOpportunity } from "./store";
import { suppressionOf, verdictReason, type Suppression } from "./suppression";
import type { Opportunity, UnreadyReason } from "./types";

export interface ReadinessContext {
  /** The site's own measured pages yield at least one passage. */
  grounded: boolean;
  /** What this site's Monday verdicts hold back. */
  suppression: Suppression;
  /** The profile §6.7's classifier reads. `null` classifies nothing, so no
   *  keyword page passes its intent gate. */
  profile: Profile | null;
  /** Whether an owned URL ranks for this search, as the newest report
   *  measured it. */
  ownRanks: (query: string) => boolean;
}

/** SPEC §6's commercial and transactional searches, in §6.7's classifier's
 *  own arms: a decision search (best / vs / alternative / top) and a
 *  solution search ({category} software / tool / app / platform). */
const COMMERCIAL_INTENTS: ReadonlySet<string> = new Set(["decision", "solution"]);

/** The format words, as whole words, plural or not — the pin's four and
 *  the owner's "vs". */
const FORMAT_WORDS = new RegExp(`\\b(?:${[...FORMAT_PAGE_ALLOWED, "vs", "versus"].join("|")})s?\\b`, "i");

function volumeOf(o: Opportunity): number {
  return o.volume === null || o.volume.kind === "unmeasured" ? 0 : o.volume.value;
}

/**
 * Why this row may not fill a day, or `null` where it may. Pure, and the
 * same for every family: a family's own gate is one more branch after the
 * shared ones.
 */
export function opportunityReady(o: Opportunity, ctx: ReadinessContext): UnreadyReason | null {
  const verdict = verdictReason(o, ctx.suppression);
  if (verdict !== null) return verdict;
  if (!ctx.grounded) return "no_grounding_fact";

  const query = o.targetQuery ?? "";
  if (o.type === "keyword_page") {
    const intent = ctx.profile === null ? null : classifyIntent(query, ctx.profile);
    const passes =
      volumeOf(o) >= KEYWORD_PAGE_MIN_VOLUME &&
      o.fitBand === "winnable" &&
      intent !== null &&
      COMMERCIAL_INTENTS.has(intent) &&
      !ctx.ownRanks(query);
    if (!passes) return "keyword_gate";
  }
  if (o.type === "format_page" && !FORMAT_WORDS.test(query)) return "format_not_allowed";
  return null;
}

/** An owned URL ranks for a search where the report's own SERP for it holds
 *  an organic row on the customer's domain. A search the report did not
 *  measure has no such row. */
export function ownRanksFrom(report: StoredReport | null): (query: string) => boolean {
  if (report === null || report.questions.kind === "unmeasured") return () => false;
  const own = registrableDomain(report.domain) ?? report.domain;
  const ranked = new Set<string>();
  report.questions.value.forEach((question, index) => {
    const serp = report.serps[index];
    if (serp === undefined || serp.kind === "unmeasured") return;
    if (serp.value.organic.some((row) => isOwnDomain(registrableDomain(row.domain) ?? row.domain, own))) {
      ranked.add(question.search.keyword.trim().toLowerCase());
    }
  });
  return (query) => ranked.has(query.trim().toLowerCase());
}

/**
 * Records readiness on every open Write, Improve and Earn row of one site.
 *
 * Reads, once each: the open rows, the site's `not_working` verdicts, its
 * current report (for the profile and what it ranks for) and whether its own
 * pages ground a fact. Writes only the rows whose answer changed.
 */
export async function assessReadiness(
  siteId: string,
  a: { at: Date }
): Promise<{ ready: number; unready: number }> {
  const store = opportunityStore();
  const rows = await store.openRankable(siteId);
  if (rows.length === 0) return { ready: 0, unready: 0 };

  const [verdicts, report, profile, grounded] = await Promise.all([
    store.notWorkingVerdicts(siteId),
    store.currentReport(siteId),
    store.profileForSite(siteId),
    store.hasGroundingFact(siteId),
  ]);
  const ctx: ReadinessContext = {
    grounded,
    suppression: suppressionOf(verdicts, a.at),
    profile,
    ownRanks: ownRanksFrom(report),
  };

  let ready = 0;
  for (const row of rows) {
    const opportunity = readOpportunity(row);
    const reason = opportunityReady(opportunity, ctx);
    if (reason === null) ready += 1;
    if (opportunity.ready !== (reason === null) || opportunity.unreadyReason !== reason) {
      await store.setReadiness(opportunity.id, reason);
    }
  }
  return { ready, unready: rows.length - ready };
}
