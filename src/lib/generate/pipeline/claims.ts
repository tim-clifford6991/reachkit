// The research claims a page may cite: which are admitted, and in what order.
import type { z } from "zod";
import { RESEARCH } from "@/lib/config/constants";
import { topicWords } from "@/lib/opportunities/intent";
import type { CLAIMS_SCHEMA } from "./claims-read";
import { datesOf, type ClaimDates } from "./dated";
import type { MarketFact, ReadPage, Wanted } from "./research";
import { TIERS, type SourceTier } from "./source-tier";

export type { ClaimDates } from "./dated";

/** Quotation marks and whitespace are not a different claim. */
export const squash = (text: string): string =>
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
      ...aged({ ...datesOf(page), passage, timeliness: timeliness(claim.about, page.kind, passage, year) }, claim.year),
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

const PRICE_RE = /[$€£¥]\s?\d|\d\s?(?:usd|eur|gbp)\b/i;
const TIMELY_PAGES: ReadonlySet<MarketFact["kind"]> = new Set(["primary", "recent", "rival_pricing", "rival_features"]);

/** Whether a claim can go out of date, in code so the claims call writes nothing more: a statistic, a price, what a
 *  product does, and anything a platform's own documentation, the news or a rival's own page says; else evergreen. */
function timeliness(about: string, kind: MarketFact["kind"], passage: string, year: number | null): "dated" | "evergreen" {
  return year !== null || about !== "other" || PRICE_RE.test(passage) || TIMELY_PAGES.has(kind) ? "dated" : "evergreen";
}

/** A claim's dates with its age date (SPEC §7): the data year it states, else its page's modified day where the
 *  published day is known too, else the published day. A modified day alone is no age: a render stamps one. A stated
 *  year its page's own day falls in is that day, the more exact of the two. */
export function aged(claim: ClaimDates & { passage: string }, stated: number | null = null): ClaimDates {
  const year = statisticYear(claim.passage, stated);
  const page = claim.publishedAt === undefined ? undefined : (claim.modifiedAt ?? claim.publishedAt);
  const ageAt = claim.ageAt ?? (year === null ? page : page?.startsWith(String(year)) ? page : String(year));
  return datesOf({ ...claim, ageAt });
}

/** Days from an age date to `now`; a year counts from its last day, so a year never ages a claim past what it states,
 *  or from its first where the question is whether it is surely newer. */
export function ageDays(ageAt: string | undefined, now: Date, oldest = false): number | null {
  if (ageAt === undefined) return null;
  const at = /^\d{4}$/.test(ageAt) ? Date.UTC(Number(ageAt), oldest ? 0 : 11, oldest ? 1 : 31) : Date.parse(ageAt);
  return Number.isNaN(at) ? null : Math.max(0, Math.floor((now.getTime() - at) / 86_400_000));
}

/** Freshness bands, newest first: three, six and twelve months, then older; undated after them all. */
const BANDS = [92, 183, 365, Infinity] as const;
const bandOf = (days: number | null): number => (days === null ? BANDS.length : BANDS.findIndex((most) => days <= most));

type Ranked = ClaimDates & { passage: string; url: string; tier?: SourceTier };
const tierAt = (claim: Ranked): number => TIERS.indexOf(claim.tier ?? "other");

/** A time-sensitive claim with no age date: never a title's figure, the answer box or a takeaway. */
export const undatedTimely = (claim: Ranked): boolean => claim.timeliness === "dated" && aged(claim).ageAt === undefined;

/** The newer dated, time-sensitive claim of the same or a better tier, on half its subject's words, that a
 *  time-sensitive claim over twelve months old gives way to (owner, 2026-11-22). None where it holds its place. */
export function displacedBy<T extends Ranked>(claim: T, claims: readonly T[], now: Date): T | undefined {
  const days = ageDays(aged(claim).ageAt, now);
  if (claim.timeliness !== "dated" || days === null || days <= 365) return undefined;
  const words = topicWords(claim.passage);
  return claims.find((other) => {
    const newer = ageDays(aged(other).ageAt, now, true);
    const shared = [...topicWords(other.passage)].filter((word) => words.has(word)).length;
    return other !== claim && other.timeliness === "dated" && newer !== null && newer < days && tierAt(other) <= tierAt(claim) && shared * 2 >= words.size;
  });
}

/** Newest credible first (owner, 2026-11-18 and 2026-11-22): each claim aged, an old time-sensitive one dropped only
 *  for a newer credible one on its subject, the rest by freshness band in their order. Nothing goes for its date alone. */
export function newestCredible<T extends Ranked>(claims: readonly T[], now: Date): T[] {
  const kept = claims.filter((claim) => displacedBy(claim, claims, now) === undefined).map((claim) => ({ ...claim, ...aged(claim) }));
  return kept.map((claim, at) => ({ claim, at, band: bandOf(ageDays(claim.ageAt, now)) })).sort((a, b) => a.band - b.band || a.at - b.at).map(({ claim }) => claim);
}

/** How old a draft's sources are (`meta.pack.ages`): claims per band, and the cited time-sensitive ones' median and oldest. */
export interface SourceAges {
  bands: { months3: number; months6: number; months12: number; older: number };
  undated: number;
  medianDays: number | null;
  oldest: { url: string; days: number } | null;
}

export function agesOf(claims: readonly Ranked[], now: Date): SourceAges {
  const days = claims.map((claim) => ageDays(aged(claim).ageAt, now));
  const count = (band: number) => days.filter((day) => bandOf(day) === band).length;
  const timely = claims.flatMap((claim, at) => (claim.timeliness === "dated" && days[at] !== null ? [{ url: claim.url, days: days[at]! }] : [])).sort((a, b) => a.days - b.days);
  const middle = timely.length === 0 ? null : (timely[Math.floor((timely.length - 1) / 2)]!.days + timely[Math.ceil((timely.length - 1) / 2)]!.days) / 2;
  return { bands: { months3: count(0), months6: count(1), months12: count(2), older: count(3) }, undated: count(BANDS.length), medianDays: middle, oldest: timely.at(-1) ?? null };
}

/** One claim from each page in turn, so no page is the whole pool. */
export function inTurn(facts: readonly MarketFact[], pages: readonly { url: string }[]): MarketFact[] {
  const queues = pages.map((page) => facts.filter((fact) => fact.url === page.url));
  const out: MarketFact[] = [];
  for (let round = 0; out.length < RESEARCH.briefFacts && queues.some((queue) => queue[round] !== undefined); round++) {
    for (const queue of queues) {
      const fact = queue[round];
      if (fact !== undefined && out.length < RESEARCH.briefFacts) out.push(fact);
    }
  }
  return out;
}
