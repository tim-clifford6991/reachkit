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

/** The wire name of the category a press sends — a suggestion's button and
 *  the founder's own field both carry it. */
export const REMEASURE_CATEGORY_FIELD = "category";

export type RemeasureState =
  | { answer: "idle" }
  /** The pass is queued; the revalidated shell shows its steps. */
  | { answer: "started" }
  /** Nothing was started, and the line says why. */
  | { answer: "refused"; line: string };

export const REMEASURE_INITIAL: RemeasureState = { answer: "idle" };

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
  // A blob stored before the market carried its profile reads as none.
  const market = report === null || report.market.kind === "unmeasured" ? null : report.market.value;
  type Profile = Parameters<typeof broaderCategories>[0]["profile"];
  const profile = (market as { profile?: Profile } | null)?.profile ?? null;
  return { suggestions: broaderCategories({ category: confirmed ?? null, profile }) };
});
