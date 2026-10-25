// BUILD §9 — the condition of the site a published page sits in: named, dated, recorded on the check that learned it,
// and read back for later pages.
// Recorded only from an answer the site gave (ADR-085 decision 6, REQ-062 c6): a timed-out sitemap fetch is not "no
// sitemap", which would tell the customer something never observed and silence the sitemap check for every later page.
// A non-answer costs one page only: that check is `unmeasured` with its reason, never `false`, and no condition is written.
// `null` is not a clean bill of health, only "no answer yet". This module makes no outbound request of any kind.
// Stored inside `publications.verify`, not on `destinations`, whose row the health check owns.
import { publishDb } from "../db";
import type { DestinationKind, SiteCondition } from "../types";
import { readStoredCheck } from "./stored";

/** Declared in `types.ts`, as the page record and the published mail both name it. */
export type { SiteCondition, SiteConditionKind } from "../types";

/** What the site said about its sitemap, as this page's check found it.
 *
 *  - `listed` — a sitemap document answered and was read; `urls` is what it
 *    named.
 *  - `none` — the site answered, and the answer is that it publishes no
 *    sitemap: its robots document named none and every conventional
 *    address answered that there is nothing there.
 *  - `no_answer` — ReachKit could not reach what it went to read, or could
 *    not read what came back. **Not a condition of the site.** */
export type SitemapReading =
  | { kind: "listed"; urls: readonly string[] }
  | { kind: "none" }
  | { kind: "no_answer" };

/** What the site's own robots document said about the readers REQ-059's
 *  policy permits.
 *
 *  - `permits` — it answered, and the pinned readers are not disallowed at
 *    the origin root.
 *  - `blocks` — it answered, and at least one of them is disallowed across
 *    the whole site.
 *  - `no_answer` — the document did not answer or could not be read. **Not
 *    a condition of the site.** */
export type RobotsReading = { kind: "permits" } | { kind: "blocks" } | { kind: "no_answer" };

export interface SiteReadings {
  sitemap: SitemapReading;
  robots: RobotsReading;
  at: Date;
}

/** Which condition, if any, one check's readings entitle us to record. `null` covers non-answers and a site in neither
 *  condition alike, so it never means "the site is fine". With both, `robots_blocks_site` wins as the broader stop. */
export function conditionFrom(readings: SiteReadings): SiteCondition | null {
  if (readings.robots.kind === "blocks") {
    return { kind: "robots_blocks_site", foundAt: readings.at };
  }
  if (readings.sitemap.kind === "none") {
    return { kind: "publishes_no_sitemap", foundAt: readings.at };
  }
  return null;
}

interface ConditionRow {
  verify: unknown;
  verify_due_at: string | null;
}

/** The site's condition as of the last check that got an answer, read from what each check recorded, never a fresh
 *  probe (REQ-062's non-goal). §9's ceilings bound the rows, so this is a small range scan. `null` is not "fine". */
export async function siteConditionFor(a: {
  siteId: string;
  destination: DestinationKind;
}): Promise<SiteCondition | null> {
  const { data, error } = await publishDb()
    .from<ConditionRow>("publications")
    .select("verify, verify_due_at")
    .eq("site_id", a.siteId)
    .eq("destination", a.destination)
    .not("verify", "is", null)
    .order("verify_due_at", { ascending: false });
  if (error !== null) throw new Error(`siteConditionFor(${a.siteId}): ${error.message}`);

  let newest: SiteCondition | null = null;
  for (const row of data ?? []) {
    const recorded = readStoredCheck(row.verify);
    const condition = recorded?.siteCondition ?? null;
    if (condition === null) continue;
    if (newest === null || condition.foundAt.getTime() > newest.foundAt.getTime()) {
      newest = condition;
    }
  }
  return newest;
}
