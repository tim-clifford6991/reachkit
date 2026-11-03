// What a stored report keeps of a market read off a page that named nothing
// of the business: a field that names nothing is taken out of its profile,
// and a market read off a home page that held none of the site's words is
// withdrawn. Pure, read at 0¢ by the re-score (`rescore.ts`).
import { HOME_WORDLESS } from "@/lib/measure/blank-page";
import { BOT_PROTECTION, isProtectionName } from "@/lib/measure/challenge";
import { unmeasured } from "@/lib/measure/measured";
import { isPlaceholder, withoutPlaceholders } from "@/lib/measure/placeholder";
import type { Profile } from "@/lib/market/questions/profile-types";
import { readAsProtection } from "./challenged";
import type { ReportChange, RescoreReport, RescoreScan } from "./rescore";
import type { StoredReport } from "./report";

/** The stored profile with every field that names nothing taken out
 *  (issue 1479): a placeholder, or a protection page's words where the scan
 *  read one. `null` where no profile is stored. */
export function clearedProfileOf(r: RescoreReport): Record<string, unknown> | null {
  if (r.market.kind === "unmeasured") return null;
  const profile: unknown = r.market.value.profile;
  if (profile === null || typeof profile !== "object") return null;
  return withoutPlaceholders(profile as Profile, (text) => isPlaceholder(text) || isProtectionName(text, r.domain)) as unknown as Record<string, unknown>;
}

/**
 * A market read off a home page that held none of the site's words — a
 * protection's page, or a page of the site's that says nothing — is no
 * reading of its market. It is withdrawn with why, and so is the page
 * proposed from it, so the domain's next requested scan reads its market
 * from its listing (`awaitsMarketFromSearch`). One read from the listing
 * stands. `null` where nothing is withdrawn.
 */
export function withdrawnMarketOf(
  r: RescoreReport & Partial<Pick<StoredReport, "marketFrom" | "freePage">>,
  scan: Pick<RescoreScan, "home" | "rendered">,
  at: Date
): ReportChange[] | null {
  if (r.market.kind === "unmeasured" || r.marketFrom === "search") return null;
  const because = unreadBecause(r, scan);
  if (because === null) return null;
  const changes: ReportChange[] = [{ path: ["market"], value: unmeasured("undeterminable", at, because) }];
  if (r.freePage !== null) changes.push({ path: ["freePage"], value: null });
  return changes;
}

/** Why the home read the market came from held none of the site's words. */
function unreadBecause(r: RescoreReport, scan: Pick<RescoreScan, "home" | "rendered">): string | null {
  if (r.onPage.kind === "unmeasured") return r.onPage.because === BOT_PROTECTION ? BOT_PROTECTION : null;
  if (scan.home === null) return null;
  if (readAsProtection({ home: scan.home, rendered: scan.rendered })) return BOT_PROTECTION;
  return scan.home.facts.wordless === true && !readAsDrawn(scan.home, scan.rendered) ? HOME_WORDLESS : null;
}

/** Whether a rendered read since this home read drew the site, whose text the
 *  profile was then read from. */
function readAsDrawn(home: { created_at: string }, rendered: RescoreScan["rendered"]): boolean {
  const since = new Date(home.created_at).getTime();
  return rendered.some((row) => new Date(row.created_at).getTime() >= since && row.facts.drawn);
}
