// The research claims a page may cite: which are admitted, and in what order.
import type { z } from "zod";
import { RESEARCH } from "@/lib/config/constants";
import type { CLAIMS_SCHEMA, MarketFact, ReadPage, Wanted } from "./research";

/** Quotation marks and whitespace are not a different claim. */
const squash = (text: string): string =>
  text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();

const YEAR_RE = /\b(?:19|20)\d{2}\b/g;

/** The year a statistic's data is from: the one the model read, else the
 *  latest year the quotation itself names. `null` for a claim with no figure
 *  besides a year — a date is not a statistic. */
export function statisticYear(quote: string, stated: number | null): number | null {
  if (!/\d/.test(quote.replace(YEAR_RE, ""))) return null;
  if (stated !== null) return stated;
  const years = [...quote.matchAll(YEAR_RE)].map((match) => Number(match[0]));
  return years.length === 0 ? null : Math.max(...years);
}

const RIVAL_KIND = { price: "rival_pricing", product: "rival_features" } as const;

/** The claims the model returned that are on their page word for word and
 *  not too old to use, at most `RESEARCH.claimsPerPage` a page. A claim off
 *  a rival's own page is kept as what it states — its price, or what the
 *  product does — and is not kept where it states neither (D56). */
export function admittedClaims(
  claims: readonly z.infer<typeof CLAIMS_SCHEMA>["claims"][number][],
  pages: readonly (ReadPage & Wanted)[],
  today: Date,
  rivals: readonly string[] = []
): MarketFact[] {
  const floor = today.getUTCFullYear() - RESEARCH.statisticMaxAgeYears;
  const out: MarketFact[] = [];
  const perPage = new Map<string, number>();
  for (const claim of claims) {
    const page = pages[claim.page - 1];
    const passage = squash(claim.quote);
    if (page === undefined || passage.length < 20 || passage.length > 400) continue;
    if (!squash(page.text).includes(passage)) continue;
    const year = statisticYear(passage, claim.year);
    if (year !== null && year < floor) continue;
    if (out.some((fact) => fact.passage === passage)) continue;
    const kind = page.product === undefined ? page.kind : claim.about === "other" ? undefined : RIVAL_KIND[claim.about];
    if (kind === undefined) continue;
    // Issue 1485: a plan is the page's own words, or the claim is not kept —
    // a plan the page does not name is one nobody can check.
    const plan = (claim.plan ?? null) === null ? null : squash(claim.plan!);
    if (page.product !== undefined && plan !== null && (plan === "" || !squash(page.text).toLowerCase().includes(plan.toLowerCase()))) continue;
    const about = page.product === undefined ? aboutRival(passage, claim.rival ?? null, rivals) : undefined;
    const held = perPage.get(page.url) ?? 0;
    if (held >= RESEARCH.claimsPerPage) continue;
    perPage.set(page.url, held + 1);
    out.push({
      url: page.url,
      title: page.title,
      readAt: new Date(page.readAt),
      passage,
      kind,
      ...(page.product === undefined ? {} : { product: page.product, plan }),
      ...(about === undefined ? {} : { about }),
      ...(page.publishedAt === undefined ? {} : { publishedAt: page.publishedAt }),
      ...(page.source === undefined ? {} : { source: page.source }),
    });
  }
  return out;
}

/** The rival a claim read off someone else's page is about: the one the
 *  call named, where it is one of `rivals`, else one the passage names by
 *  its domain or its domain's label. */
function aboutRival(passage: string, named: string | null, rivals: readonly string[]): string | undefined {
  const domain = named?.trim().toLowerCase().replace(/^www\./, "");
  if (domain !== undefined && rivals.includes(domain)) return domain;
  const text = passage.toLowerCase();
  return rivals.find((rival) => {
    const label = rival.split(".")[0] ?? "";
    return text.includes(rival) || (label.length > 2 && new RegExp(`(?<![a-z0-9])${label}(?![a-z0-9])`).test(text));
  });
}

/**
 * Issue 1485: **a rival's own page outranks a third party's** for a claim
 * about that rival. Where a rival's own pages yielded a claim, what another
 * page says about it — a reviewer's "$99", a listicle's plan names — is not
 * kept. Where its own pages yielded nothing, a third party's claim stays,
 * cited to that third party.
 */
export function ownPagesFirst(facts: readonly MarketFact[]): MarketFact[] {
  const own = new Set(facts.flatMap((fact) => (fact.product === undefined ? [] : [fact.product])));
  return facts.filter((fact) => fact.product !== undefined || fact.about === undefined || !own.has(fact.about));
}

/** A claim's date: the year it states, else the year its page says it was published. Undated is `null`, never old. */
function yearOf(claim: { passage: string; publishedAt?: string }): number | null {
  const published = claim.publishedAt === undefined ? NaN : new Date(claim.publishedAt).getUTCFullYear();
  return statisticYear(claim.passage, null) ?? (Number.isNaN(published) ? null : published);
}

/** Newest first (owner, 2026-11-18): undated claims after every dated one, and claims of one year keep their order. */
export function byNewest<T extends { passage: string; publishedAt?: string }>(claims: readonly T[]): T[] {
  const years = new Map(claims.map((claim) => [claim, yearOf(claim)] as const));
  return [...claims].sort((a, b) => (years.get(b) ?? -Infinity) - (years.get(a) ?? -Infinity) || 0);
}
