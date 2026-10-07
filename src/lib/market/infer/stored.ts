// src/lib/market/infer/stored.ts — `sites.market`, read and written
// (#1185). The one module that touches the column: the passes and setup
// write conclusions through it, and the founder's saves set the overrides
// through it.
import { dbAdmin } from "@/lib/db";
import { registrableDomain } from "../rivals/domains";
import type { MarketChange, StoredMarketWithChange } from "./stability";
import { EMPTY_STORED_MARKET, type BrandDemand, type MarketConclusion, type MarketTerm, type RivalConclusion } from "./types";

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface MinimalQuery<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string): MinimalQuery<T>;
  update(values: Record<string, unknown>): MinimalQuery<T>;
  eq(column: string, value: string): MinimalQuery<T>;
  limit(n: number): MinimalQuery<T>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQuery<T>;
}

/** The generated `Database` type predates this column, as it does several
 *  others on `sites` (`market/changes/declared.ts`). */
function untyped(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

interface SiteMarketRow {
  domain: string;
  category: string | null;
  competitors: unknown;
  market: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function rivalsOf(value: unknown): RivalConclusion[] {
  if (!Array.isArray(value)) return [];
  const out: RivalConclusion[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const domain = registrableDomain(str(entry.domain) ?? "");
    if (domain === null) continue;
    const basis = entry.basis === "ai_answer" || entry.basis === "ranks" ? entry.basis : "same_job";
    out.push({
      domain,
      name: str(entry.name) ?? domain,
      basis,
      reason: str(entry.reason) ?? "",
      ...(Array.isArray(entry.searchNames) ? { searchNames: strings(entry.searchNames) } : {}),
      // D50: only where a pass has read it.
      ...(typeof entry.volume === "number" && entry.volume >= 0 ? { volume: entry.volume } : {}),
    });
  }
  return out;
}

function termsOf(value: unknown): MarketTerm[] {
  if (!Array.isArray(value)) return [];
  const out: MarketTerm[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const term = (str(entry.term) ?? "").trim();
    if (term === "") continue;
    const volume = typeof entry.volume === "number" && entry.volume > 0 ? entry.volume : 0;
    out.push({ term, volume, ...(entry.polluted === true ? { polluted: true as const } : {}) });
  }
  return out;
}

function demandOf(value: unknown): BrandDemand | null {
  if (!isRecord(value)) return null;
  const at = str(value.at);
  if (at === null) return null;
  const brands: Record<string, number> = {};
  if (isRecord(value.brands)) {
    for (const [keyword, volume] of Object.entries(value.brands)) {
      if (typeof volume === "number" && volume >= 0) brands[keyword] = volume;
    }
  }
  const searches: Record<string, number> = {};
  if (isRecord(value.searches)) {
    for (const [search, volume] of Object.entries(value.searches)) {
      if (typeof volume === "number" && volume >= 0) searches[search] = volume;
    }
  }
  return {
    at,
    own: typeof value.own === "number" && value.own > 0 ? value.own : 0,
    brands,
    ...(isRecord(value.searches) ? { searches } : {}),
  };
}

function conclusionOf(value: unknown): MarketConclusion | null {
  if (!isRecord(value)) return null;
  const category = str(value.category);
  if (category === null || category.trim() === "") return null;
  return {
    buyer: str(value.buyer) ?? "",
    job: str(value.job) ?? "",
    category,
    synonyms: strings(value.synonyms),
    differentiators: strings(value.differentiators),
    notOurMarket: strings(value.notOurMarket),
    categoryReason: str(value.categoryReason) ?? "",
    rivals: rivalsOf(value.rivals),
    // D49: only where a pass has read them, so "never read" stays distinct
    // from "read, and nothing is searched".
    ...(str(value.termsAt) === null
      ? {}
      : { terms: termsOf(value.terms), searchTerm: str(value.searchTerm), termsAt: str(value.termsAt)! }),
    // D50: likewise, "never read" is not "read, and nobody searches it".
    ...(demandOf(value.demand) === null ? {} : { demand: demandOf(value.demand)! }),
  };
}

function changeOf(value: unknown): MarketChange | null {
  if (!isRecord(value)) return null;
  const scanId = str(value.scanId);
  const at = str(value.at);
  if (scanId === null || at === null) return null;
  const c = isRecord(value.category) ? value.category : null;
  const to = c === null ? null : str(c.to);
  return {
    scanId,
    at,
    category: c === null || to === null ? null : { from: str(c.from), to, reason: str(c.reason) ?? "" },
    added: rivalsOf(value.added),
    dropped: strings(value.dropped),
  };
}

/** The stored value, read defensively: anything the column should not hold
 *  reads as "nothing concluded yet", never as a guess. */
export function parseStoredMarket(value: unknown): StoredMarketWithChange {
  if (!isRecord(value)) return { ...EMPTY_STORED_MARKET, lastChange: null };
  return {
    current: conclusionOf(value.current),
    adoptedAt: str(value.adoptedAt),
    pending: conclusionOf(value.pending),
    categoryOverridden: value.categoryOverridden === true,
    rivalsOverridden: value.rivalsOverridden === true,
    lastChange: changeOf(value.lastChange),
  };
}

export interface SiteMarket {
  domain: string;
  /** What passes measure today. */
  category: string | null;
  competitors: readonly string[];
  stored: StoredMarketWithChange;
}

export async function readSiteMarket(siteId: string): Promise<SiteMarket | null> {
  const { data, error } = await untyped()
    .from<SiteMarketRow>("sites")
    .select("domain, category, competitors, market")
    .eq("id", siteId)
    .limit(1);
  if (error !== null) throw new Error(`readSiteMarket: ${error.message}`);
  const row = data?.[0];
  if (row === undefined) return null;
  const competitors: string[] = [];
  for (const entry of strings(row.competitors)) {
    const domain = registrableDomain(entry);
    if (domain !== null && !competitors.includes(domain)) competitors.push(domain);
  }
  return { domain: row.domain, category: row.category, competitors, stored: parseStoredMarket(row.market) };
}

/** One write of the conclusion and, where they follow it, the two columns
 *  every pass measures. */
export async function writeSiteMarket(
  siteId: string,
  a: { stored: StoredMarketWithChange; category?: string; competitors?: readonly string[] }
): Promise<void> {
  const values: Record<string, unknown> = { market: a.stored };
  if (a.category !== undefined) values.category = a.category;
  if (a.competitors !== undefined) values.competitors = [...a.competitors];
  const { error } = await untyped().from<SiteMarketRow>("sites").update(values).eq("id", siteId);
  if (error !== null) throw new Error(`writeSiteMarket: ${error.message}`);
}

/** The founder set a field themselves (D28): from now on no conclusion
 *  replaces it. A category the founder clears hands the market back to
 *  ReachKit. Never throws: the founder's own answer is already saved, and a
 *  flag that could not be written must not refuse it. */
export async function markOverride(siteId: string, field: "category" | "rivals", overridden: boolean): Promise<void> {
  try {
    const site = await readSiteMarket(siteId);
    if (site === null) return;
    const stored: StoredMarketWithChange =
      field === "category"
        ? { ...site.stored, categoryOverridden: overridden }
        : { ...site.stored, rivalsOverridden: overridden };
    await writeSiteMarket(siteId, { stored });
  } catch (error) {
    console.log(
      JSON.stringify({
        event: "market_override_unmarked",
        siteId,
        field,
        because: error instanceof Error ? error.message : String(error),
      })
    );
  }
}
