// SPEC §9 (#690) — a `fix_page`'s readiness, and its retirement.
//
// **Readiness** (owner ruling 2026-09-14): a fix is a metadata-only update
// of the page, so it is ready only where the site's destination can make
// that update — a WordPress destination, on the page's own host, at a page
// with a slug to find it by, for fixes WordPress has a field for (a post's
// title, and its SEO plugin's description). Anything else is created and
// left not ready with `destination_cannot_address`, so the day picker never
// reaches it.
//
// **Retirement**: "Fixing one drops it next Monday." A week's scan that
// checked the page and found every named check passing marks the row
// `done` — whoever fixed it.
import type { StoredReport } from "@/lib/scan/report";
import { pageFixesCleared } from "./verdicts/evaluate";
import { opportunityStore, readOpportunity } from "./store";
import type { Opportunity, PageFix, UnreadyReason } from "./types";

/** Where a fix could be delivered. */
export type FixDelivery = { kind: "wordpress"; host: string } | { kind: "none" };

/** The fixes a WordPress update carries: the post's title and its SEO
 *  plugin's description. WordPress offers no field for a page's JSON-LD. */
const WORDPRESS_FIXES: ReadonlySet<PageFix> = new Set<PageFix>(["page_titles", "meta_descriptions"]);

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function hasSlug(url: string): boolean {
  try {
    return new URL(url).pathname.split("/").some((segment) => segment !== "");
  } catch {
    return false;
  }
}

/** Pure. `null` where the fix is ready, otherwise why it is not. */
export function fixPageReadiness(
  fix: { pageUrl: string; issues: readonly PageFix[] },
  delivery: FixDelivery
): UnreadyReason | null {
  if (delivery.kind !== "wordpress") return "destination_cannot_address";
  const host = hostOf(fix.pageUrl);
  if (host === null || host !== delivery.host.toLowerCase().replace(/^www\./, "")) {
    return "destination_cannot_address";
  }
  if (!hasSlug(fix.pageUrl)) return "destination_cannot_address";
  if (fix.issues.length === 0 || fix.issues.some((issue) => !WORDPRESS_FIXES.has(issue))) {
    return "destination_cannot_address";
  }
  return null;
}

/** The site's live WordPress destination's host, or `none`. The host is read
 *  off the sealed config and nothing else leaves it. A read that fails is
 *  `none`: a fix is never made ready on a guess. */
export async function fixDeliveryFor(siteId: string): Promise<FixDelivery> {
  try {
    const { liveDestinations } = await import("@/lib/publish/destinations/store");
    const { withConfig } = await import("@/lib/publish/destinations/config");
    const wordpress = (await liveDestinations(siteId)).find((d) => d.kind === "wordpress");
    if (wordpress === undefined) return { kind: "none" };
    const host = await withConfig<{ baseUrl?: unknown }, string | null>(wordpress.id, async (cfg) =>
      typeof cfg.baseUrl === "string" ? hostOf(cfg.baseUrl) : null
    );
    return host === null ? { kind: "none" } : { kind: "wordpress", host };
  } catch {
    return { kind: "none" };
  }
}

function fixOf(o: Opportunity): { pageUrl: string; issues: readonly PageFix[] } | null {
  return o.evidence.family === "fix" && "issues" in o.evidence
    ? { pageUrl: o.evidence.pageUrl, issues: o.evidence.issues }
    : null;
}

/**
 * Retires the open fixes a report shows cleared, and records readiness on
 * the rest. Reads the destination only where there is an open fix to assess.
 */
export async function assessFixPages(
  siteId: string,
  a: { report: StoredReport | null; delivery?: FixDelivery }
): Promise<{ done: number; ready: number }> {
  const store = opportunityStore();
  const rows = await store.openFixPages(siteId);
  if (rows.length === 0) return { done: 0, ready: 0 };

  const delivery = a.delivery ?? (await fixDeliveryFor(siteId));
  let done = 0;
  let ready = 0;
  for (const row of rows) {
    const opportunity = readOpportunity(row);
    const fix = fixOf(opportunity);
    if (fix === null) continue;

    if (a.report !== null) {
      const cleared = pageFixesCleared(
        a.report.siteIssues,
        fix.issues,
        fix.pageUrl,
        a.report.verdict.measuredAt
      );
      if (cleared !== null && cleared.kind !== "unmeasured" && cleared.value) {
        await store.markDone(opportunity.id);
        done += 1;
        continue;
      }
    }

    const reason = fixPageReadiness(fix, delivery);
    if (reason === null) ready += 1;
    if (opportunity.ready !== (reason === null) || opportunity.unreadyReason !== reason) {
      await store.setReadiness(opportunity.id, reason);
    }
  }
  return { done, ready };
}
