// src/lib/market/rivals/derive.ts — BUILD §6.6, zero extra cost
//
// The market decides who the rivals are; the customer's own rankings never
// enter. §6.6's cold-start law is held here by construction rather than by
// a branch: this function reads twelve SERPs and an own-domain string, and
// there is no argument through which a customer's ranked count, presence
// or history could reach it. The output is identical whether the customer
// ranks for 10,000 searches or for none — the property the cold-start test
// pins directly.
//
// **This module buys nothing.** §6.6: "Zero extra cost — it counts over
// SERPs already bought." It resolves no import into `src/lib/vendors/`,
// `src/lib/costs/` or `src/lib/llm/` and takes no cost context, so there
// is no call here that could spend; `tests/market/rivals/derive.test.ts`
// asserts that over this file's source.
//
// Domain normalisation, the platform partition and the own-domain test are
// all `./domains`' — one implementation in the product, not two.
// ── The record for this file ─────────────────────────────────────────────
// Rulings of record for this module, moved out of `DECISIONS.md` on 2026-09-11
// (owner ruling: the record holds product rulings only; an implementation ruling
// belongs where the code is). Verbatim. The whole original record is
// `docs/archive/DECISIONS-full-2026-09-11.md`.
//
// DECISIONS 2026-09-06: Rival suggestion has two sources by path: a market inferred from a
//   report → that report's deriveRivals (0¢); a market the founder stated → competitors_domain
//   (its own empty answer for a domain without presence stands in for §6.6's presence clause);
//   no market → nothing sought. RivalSize is declared in src/lib/market/rivals and joins
//   StoredReport under #103. — #118
//
// DECISIONS 2026-09-06: The paid pass sizes the customer's tracked rivals inside the
//   checking_your_presence stage, gated by the `sizesRivals` tier parameter (never a branch),
//   monthly via the rivals cache window; `ownRanked` joins the blob and REPORT_VERSION is 3
//   (supersedes the version-2 line). Row caps (100 rival rows, 300 own rows) understate counts
//   and so tighten both winnability bars — the error runs toward fewer opportunities until
//   #117 lands a total. — #149

import { BATTERY, RIVAL_SCORE } from "@/lib/config/constants";
import type { MarketSerp } from "../views";
import { isOwnDomain, isPlatformDomain, registrableDomain } from "./domains";

/** §6.6's suggested-rival row. Nothing about a rival's *size* — ranked
 *  count, revenue, traffic, funding, headcount — has a field here, and
 *  §6.4's never-pull list forbids the measurement that would make such a
 *  claim true on the free path. */
export interface RivalCandidate {
  domain: string;
  top10Appearances: number;
  aiCitations: number;
  /** `top10Appearances + 2 × aiCitations` — the weights are `RIVAL_SCORE`'s
   *  (BUILD §6.1's price-book row), the arithmetic is this file's. */
  score: number;
}

interface Tally {
  domain: string;
  top10Appearances: number;
  aiCitations: number;
}

function scoreOf(t: Tally): number {
  return t.top10Appearances * RIVAL_SCORE.top10Weight + t.aiCitations * RIVAL_SCORE.aiCitationWeight;
}

/**
 * The four-key total order: `score` desc, then `aiCitations` desc, then
 * `top10Appearances` desc, then `domain` ascending. The last key is what
 * makes it *total* — without it two domains with identical counts would
 * come back in whatever order the input happened to put them in, and the
 * same twelve SERPs would produce two different cards.
 */
function byScoreThenDomain(a: RivalCandidate, b: RivalCandidate): number {
  return (
    b.score - a.score ||
    b.aiCitations - a.aiCitations ||
    b.top10Appearances - a.top10Appearances ||
    (a.domain < b.domain ? -1 : a.domain > b.domain ? 1 : 0)
  );
}

/**
 * §6.6's derivation, step for step: every organic top-ten domain and every
 * AI Overview reference domain across the supplied SERPs, the customer's
 * own domain stripped, the rest partitioned against `PLATFORM_DOMAINS`,
 * scored, and the top `BATTERY.COMPETITORS_MAX` returned.
 *
 * Counting is **once per SERP per domain** on both halves: a domain
 * holding positions 3 and 7 of one SERP appears in it once, not twice, and
 * an AI Overview citing it twice cites it once. The unit §6.6 counts is
 * "appears in this search", not "occupies a row".
 *
 * Fewer than five rivals, and none at all, are legal results — a market
 * whose every result is a platform or the customer's own returns
 * `rivals: []` with a populated `sources`, and never throws. What the card
 * does with that is `buildPresenceCard`'s `framing`.
 *
 * `sources` is the de-duplicated list of platform domains hit, in
 * first-seen order. It is stored in the report blob and not rendered in
 * MVP (§6.6: "a v1.1 Standing module").
 */
export function deriveRivals(a: {
  serps: readonly MarketSerp[];
  ownDomain: string;
}): { rivals: RivalCandidate[]; sources: string[] } {
  const tallies = new Map<string, Tally>();
  const sources: string[] = [];
  const seenSources = new Set<string>();
  let productDomains = 0;

  const tally = (domain: string): Tally => {
    const existing = tallies.get(domain);
    if (existing) return existing;
    const fresh: Tally = { domain, top10Appearances: 0, aiCitations: 0 };
    tallies.set(domain, fresh);
    productDomains += 1;
    return fresh;
  };

  /** The partition, applied identically to an organic host and to an AI
   *  reference host: not a domain at all, or the customer's own, and it
   *  counts nowhere; a platform, and it counts only into `sources`. */
  const classify = (host: string): string | null => {
    const domain = registrableDomain(host);
    if (domain === null) return null;
    if (isOwnDomain(domain, a.ownDomain)) return null;
    if (isPlatformDomain(domain)) {
      if (!seenSources.has(domain)) {
        seenSources.add(domain);
        sources.push(domain);
      }
      return null;
    }
    return domain;
  };

  for (const serp of a.serps) {
    const countedTop10 = new Set<string>();
    for (const row of serp.organic) {
      const domain = classify(row.domain);
      if (domain === null || countedTop10.has(domain)) continue;
      countedTop10.add(domain);
      tally(domain).top10Appearances += 1;
    }

    const countedCitations = new Set<string>();
    for (const host of serp.aiOverview.referenceDomains) {
      const domain = classify(host);
      if (domain === null || countedCitations.has(domain)) continue;
      countedCitations.add(domain);
      tally(domain).aiCitations += 1;
    }
  }

  const scored: RivalCandidate[] = [...tallies.values()].map((t) => ({
    domain: t.domain,
    top10Appearances: t.top10Appearances,
    aiCitations: t.aiCitations,
    score: scoreOf(t),
  }));
  scored.sort(byScoreThenDomain);
  const rivals = scored.slice(0, BATTERY.COMPETITORS_MAX);

  // Before the partition: every distinct domain the SERPs named that was
  // neither the customer's own nor unparseable. After it: the product
  // domains alone — the platform hits went to `sources`.
  logDerivation(productDomains + sources.length, productDomains, rivals.length);
  return { rivals, sources };
}

/** BP-026 `## NFR budget`: candidate count before and after the platform
 *  partition, and the rival count kept. Counts only — no domain reaches a
 *  log line from here. */
function logDerivation(before: number, after: number, kept: number): void {
  console.log(
    JSON.stringify({ event: "rival_derivation", candidatesBeforePartition: before, candidatesAfterPartition: after, rivalsKept: kept })
  );
}
