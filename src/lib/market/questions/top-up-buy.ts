// SPEC §7 *Pages left*: a short weekly pass buys right-sized searches under its own cap, `CAPS.TOPUP_C`, so the
// top-up never takes the weekly pass's room and the weekly pass never takes the top-up's.
import { CAPS, PRICE_BOOK, VENDOR } from "@/lib/config/constants";
import { withCostContext, type CostContext } from "@/lib/costs";
import type { Locale } from "@/lib/locale/locales";
import { keywordOverview, keywordSuggestions } from "@/lib/vendors/dataforseo";
import { suggestionsWindow, type SuggestionRow } from "./market-set";
import { measuredFields } from "./select";

/** Suggestion seeds the top-up may buy in one week; a seed the vendor cache holds is read at 0¢ and not counted. */
export const TOPUP_SEEDS = 3;

/** Runs `body` under the top-up's own cost context. */
export type TopUpSpend = <T>(body: (c: CostContext) => Promise<T>) => Promise<T>;

/** The weekly pass's top-up context: its own cap, its own ledger activity, and no roll-up onto the pass's row. */
export const topUpSpend = (scanId: string, policyVersion: number): TopUpSpend => (body) =>
  withCostContext({ scanId, cap: "TOPUP", policyVersion, rollUp: "none", activity: "topup" }, body);

export interface TopUpBought {
  suggestions: SuggestionRow[];
  /** Each search the overview read, by its lowercased wording. */
  volumes: Record<string, number>;
  /** The seeds bought this week, cache reads left out. */
  seeds: string[];
  cents: number;
  /** `topup_cap`: the top-up's own room ran short; `spend_ceiling`: the site's or the product's day refused; `failed`: it could not run. */
  degraded?: "topup_cap" | "spend_ceiling" | "failed";
}

/** Suggestions on up to `TOPUP_SEEDS` new seeds, then one overview of the searches still unpriced, stopping once `enough`. */
export async function buyTopUp(
  c: CostContext,
  a: { seeds: readonly string[]; ownRanked: number; locale: Locale; enough: (bought: TopUpBought) => boolean; unpriced: (bought: TopUpBought) => readonly string[] }
): Promise<TopUpBought> {
  const out: TopUpBought = { suggestions: [], volumes: {}, seeds: [], cents: 0 };
  const room = () => CAPS.TOPUP_C - c.spentCents();
  for (const seed of a.seeds) {
    if (out.seeds.length >= TOPUP_SEEDS || a.enough(out)) break;
    if (room() < PRICE_BOOK.SUGGESTIONS_COST_C) {
      out.degraded = "topup_cap";
      break;
    }
    const before = c.spentCents();
    const read = await keywordSuggestions(c, { seed, rows: VENDOR.suggestionsRows, volume: suggestionsWindow(a.ownRanked), locale: a.locale });
    if (c.degraded()) {
      out.degraded = "spend_ceiling";
      break;
    }
    if (c.spentCents() > before) out.seeds.push(seed);
    if (read.kind === "measured") for (const row of read.value) out.suggestions.push({ keyword: row.keyword, volume: row.searchVolume, ...measuredFields(row) });
  }
  const unpriced = out.degraded !== undefined || a.enough(out) ? [] : a.unpriced(out);
  // One keyword short of the room, so rounding never carries the reservation over the cap.
  const fits = Math.floor((room() - PRICE_BOOK.KEYWORD_OVERVIEW_REQUEST_C) / PRICE_BOOK.KEYWORD_OVERVIEW_KEYWORD_C) - 1;
  if (unpriced.length > 0 && fits < 1) out.degraded = "topup_cap";
  else if (unpriced.length > 0) {
    const read = await keywordOverview(c, { keywords: unpriced.slice(0, fits), locale: a.locale });
    if (c.degraded()) out.degraded = "spend_ceiling";
    if (read.kind === "measured") for (const row of read.value) out.volumes[row.keyword] = row.searchVolume;
  }
  out.cents = c.spentCents();
  return out;
}
