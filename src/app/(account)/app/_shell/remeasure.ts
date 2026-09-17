// SPEC §6 (owner ruling 2026-09-17, issue 837) — the choice a thin market
// offers the founder: two or three broader categories from the site's own
// profile, and their own words, each of which measures the market again now.
//
// `readCategoryChoice` is the one request-cached read behind the choice, on
// whichever screen draws it — the side panel's notice, Overview and Calendar.
// The suggestions are `broaderCategories`' (pure, over the stored profile);
// nothing is bought to make one.
import { cache } from "react";
import type { CopyKey } from "@/lib/presentation/copy";
import { isReservedFixtureAccount, requireSetUpAccount } from "../_session/account";

/** The release notice whose arm carries the choice. */
export const MARKET_TOO_SMALL: CopyKey = "setup.release.market-too-small";

export interface CategoryChoiceModel {
  suggestions: readonly string[];
}

export const readCategoryChoice = cache(async function readCategoryChoice(): Promise<CategoryChoiceModel> {
  const account = await requireSetUpAccount();
  if (isReservedFixtureAccount(account)) return { suggestions: [] };

  // Imported at the call: each reaches `@/lib/db`.
  const [{ readCurrentReport }, { readSiteCategory }, { broaderCategories }] = await Promise.all([
    import("@/lib/scan/report"),
    import("@/lib/scan/site-category"),
    import("@/lib/market/questions/broader"),
  ]);
  const [report, confirmed] = await Promise.all([
    readCurrentReport(account.domain),
    readSiteCategory(account.siteId),
  ]);
  type Profile = NonNullable<Parameters<typeof broaderCategories>[0]["profile"]>;
  return { suggestions: broaderCategories({ category: confirmed ?? null, profile: storedProfile<Profile>(report) }) };
});

/** The profile a stored report carries, or `null`. Read defensively: a blob
 *  written before the market carried its profile — or before the report
 *  carried a market at all — is a report with no profile, never a reason
 *  for `/app` to fail to render. */
function storedProfile<P>(report: unknown): P | null {
  if (typeof report !== "object" || report === null) return null;
  const market = (report as { market?: unknown }).market;
  if (typeof market !== "object" || market === null) return null;
  const { kind, value } = market as { kind?: unknown; value?: unknown };
  if ((kind !== "measured" && kind !== "zero") || typeof value !== "object" || value === null) return null;
  const profile = (value as { profile?: unknown }).profile;
  if (typeof profile !== "object" || profile === null) return null;
  const { category, offeringType, vocabulary, brandTokens } = profile as Record<string, unknown>;
  const strings = (list: unknown): boolean => Array.isArray(list) && list.every((item) => typeof item === "string");
  return typeof category === "string" && typeof offeringType === "string" && strings(vocabulary) && strings(brandTokens)
    ? (profile as P)
    : null;
}
