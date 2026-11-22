// SPEC §7 *The content standard*: which rivals' own pages a page reads, and where each read page stands as a source.
// Judged from its address and its words, in code, at 0¢.
import { languagePack, SHAPES } from "@/lib/locale/language";
import type { Language } from "@/lib/locale/locales";
import { brandOf } from "@/lib/market/questions/select";
import { nameLetters, registrableDomain } from "@/lib/market/rivals/domains";
import type { MarketFact } from "./research";

export type SourceTier = "primary" | "original" | "publication" | "vendor" | "other";
/** Best first: the order a pack deals its claims in. */
export const TIERS: readonly SourceTier[] = ["primary", "original", "publication", "vendor", "other"];
/** No outside site is cited on more of a site's pages in one committed week. */
const WEEK_PAGES_PER_SITE = 3;

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export const sameSite = (host: string, domain: string): boolean => host === domain || host.endsWith(`.${domain}`);
const siteOf = (url: string): string => registrableDomain(url) ?? hostOf(url);

// What an address says about who wrote the page: a government's or an intergovernmental body's own host, or a host
// or first path segment that names documentation, help or support. Read off the address alone, for every business.
const AUTHORITY_HOST_RE =
  /(?:^|\.)(?:gov(?:\.[a-z]{2})?|gouv\.[a-z]{2}|gob\.[a-z]{2}|govt\.[a-z]{2}|gv\.at|admin\.ch|bund\.de|europa\.eu|gc\.ca|canada\.ca|nhs\.uk|int)$/;
const DOCS_LABEL_RE = /^(?:docs|developers?|support|help|learn|kb|documentation)$/;
const DOCS_SEGMENT_RE = /^(?:docs|documentation|help|support|developers?|kb|hc|knowledge-base|guidelines|guidance)$/;

/** Whether an address is a platform's or an authority's own documentation: a `primary` source. A rival's own help
 *  page is not one — a rival is read for what it sells, never as the authority on a task. */
export function primaryAddress(url: string, rivals: readonly string[] = []): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const host = hostOf(url);
  if (host === "" || rivals.some((rival) => sameSite(host, rival))) return false;
  if (AUTHORITY_HOST_RE.test(host) || DOCS_LABEL_RE.test(host.split(".")[0] ?? "")) return true;
  return DOCS_SEGMENT_RE.test(parsed.pathname.split("/").filter(Boolean)[0]?.toLowerCase() ?? "");
}

const said = (search: string): string => search.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** The products a search names, in their order: a run of up to four of its words that spells the product's stored
 *  name, its domain's own label or its whole domain ("peec ai"). */
export function namedIn(search: string, products: readonly { domain: string; name?: string | null }[]): string[] {
  const words = said(search).split(" ");
  const runs = new Set<string>();
  for (let from = 0; from < words.length; from++) {
    for (let to = from + 1; to <= Math.min(words.length, from + 4); to++) runs.add(nameLetters(words.slice(from, to).join(" ")));
  }
  return products
    .filter((product) => [brandOf(product.domain), nameLetters(product.domain), nameLetters(product.name ?? "")].some((spelled) => spelled.length >= 3 && runs.has(spelled)))
    .map((product) => product.domain);
}

/** A page that compares options: a listicle, or a target shaped "X vs Y" or "X alternatives" in any language. */
export const comparesOptions = (a: { target: string; options?: boolean }): boolean => a.options === true || SHAPES.comparison.test(said(a.target));

/** The rivals whose own pages a page reads: every one where it compares options, else those its searches name and any
 *  the site does not list as its own (a row's named competitor). A rival's page is read only where it is the subject. */
export function rivalsInScope(inForce: readonly string[], a: { searches: readonly string[]; options?: boolean; rivalNames?: readonly { domain: string; name: string | null }[] }): string[] {
  if (comparesOptions({ target: a.searches[0] ?? "", options: a.options })) return [...inForce];
  const products = inForce.map((domain) => ({ domain, name: a.rivalNames?.find((rival) => rival.domain === domain)?.name ?? null }));
  const named = new Set(a.searches.flatMap((search) => namedIn(search, products)));
  const listed = a.rivalNames === undefined ? null : new Set(a.rivalNames.map((rival) => rival.domain));
  return inForce.filter((domain) => named.has(domain) || (listed !== null && !listed.has(domain)));
}

/** Each claim with its tier, and `capped` where its site already fills the week; a rival's own page is never capped. */
export function tiered(facts: readonly MarketFact[], a: { rivals: readonly string[]; products: readonly string[]; language: Language; pages: readonly { url: string; text: string }[]; capped: ReadonlySet<string> }): MarketFact[] {
  const pack = languagePack(a.language);
  const method = new Set(a.pages.filter((page) => pack.studyMethod.test(page.text)).map((page) => page.url));
  // A site two or more other sites cite as their original is a publisher.
  const citers = new Map<string, Set<string>>();
  for (const fact of facts) if (fact.via !== undefined) citers.set(siteOf(fact.url), (citers.get(siteOf(fact.url)) ?? new Set()).add(siteOf(fact.via)));
  const tierOf = (fact: MarketFact): SourceTier => {
    const host = hostOf(fact.url);
    if (fact.product !== undefined || a.rivals.some((rival) => sameSite(host, rival))) return "vendor";
    if (fact.kind === "primary" || primaryAddress(fact.url) || pack.officialHosts.test(host)) return "primary";
    if (fact.via !== undefined || (method.has(fact.url) && fact.secondHand !== true)) return "original";
    if (fact.kind === "recent" || (citers.get(siteOf(fact.url))?.size ?? 0) >= 2) return "publication";
    return a.products.some((product) => sameSite(host, product)) ? "vendor" : "other";
  };
  return facts.map((fact) => ({ ...fact, tier: tierOf(fact), ...(fact.product === undefined && a.capped.has(siteOf(fact.url)) ? { capped: true as const } : {}) }));
}

/** Best tier first and a capped site's claims after every other, each tier in the order `within` gives it. */
export function byTier<T extends { tier?: SourceTier; capped?: true }>(facts: readonly T[], within: (facts: T[]) => T[] = (same) => same): T[] {
  const at = (fact: T): number => (fact.capped === true ? TIERS.length : TIERS.indexOf(fact.tier ?? "other"));
  return [...TIERS.keys(), TIERS.length].flatMap((rank) => within(facts.filter((fact) => at(fact) === rank)));
}

/** The outside sites already cited on `WEEK_PAGES_PER_SITE` of the site's other pages in the Monday-to-Sunday week of
 *  `day`, read from their stored `meta.marketFacts`. A rival's own page is not counted. None where the read fails. */
export async function cappedSites(siteId: string, own: string, day: string): Promise<Set<string>> {
  const monday = new Date(`${day}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const sunday = new Date(monday.getTime() + 6 * 86_400_000).toISOString().slice(0, 10);
  const week = (await import("../store").then(({ generateStore }) => generateStore().citedFrom?.(siteId, monday.toISOString().slice(0, 10))).catch(() => undefined)) ?? [];
  const pages = new Map<string, number>();
  for (const row of week.filter((row) => row.day <= sunday && row.day !== day)) {
    const facts = Array.isArray(row.facts) ? (row.facts as { url?: unknown; product?: unknown }[]) : [];
    const sites = new Set(facts.flatMap((fact) => (typeof fact?.url === "string" && fact.product === undefined ? [siteOf(fact.url)] : [])));
    for (const site of sites) if (!sameSite(site, own)) pages.set(site, (pages.get(site) ?? 0) + 1);
  }
  return new Set([...pages].filter(([, count]) => count >= WEEK_PAGES_PER_SITE).map(([site]) => site));
}

/** What a draft's research cites, by tier (`meta.research.mix`). */
export interface SourceMix {
  tiers: Record<SourceTier, number>;
  domains: number;
  /** Distinct sites at `publication` or better. */
  independent: number;
  rivalClaims: number;
  cappedSkipped: number;
}

/** The mix of `facts`, warned on (never stopped on) below the page's minimum of independent sites. */
export function mixOf(facts: readonly MarketFact[], a: { siteId: string; cappedSkipped: number; minimum: number }): SourceMix {
  const tiers = Object.fromEntries(TIERS.map((tier) => [tier, facts.filter((fact) => (fact.tier ?? "other") === tier).length])) as Record<SourceTier, number>;
  const independent = new Set(facts.filter((fact) => TIERS.indexOf(fact.tier ?? "other") <= TIERS.indexOf("publication")).map((fact) => siteOf(fact.url))).size;
  const mix = { tiers, domains: new Set(facts.map((fact) => siteOf(fact.url))).size, independent, rivalClaims: facts.filter((fact) => fact.product !== undefined).length, cappedSkipped: a.cappedSkipped };
  if (independent < a.minimum) console.warn(JSON.stringify({ event: "draft_sources_few", siteId: a.siteId, independent, minimum: a.minimum }));
  return mix;
}
