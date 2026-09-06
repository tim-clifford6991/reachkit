// BUILD §9 — the condition of the site a published page sits in: named,
// dated, recorded on the check that learned it, and read back for later
// pages.
//
// **"Only from an answer the site gave" is the whole of this module, and
// the wrong version is the one a competent engineer writes first — ADR-085
// Decision 6.** REQ-062 criterion 6 used to cover reachability; the
// 2026-09-01 fold moved that case into criterion 4's third outcome and
// added the sentence that a condition is recorded *only from an answer*. So
// any suppression keyed on "the site could not be reached" is wrong twice
// over: the case has moved, and criterion 6 may not fire on a non-answer at
// all.
//
// The failure mode is worth stating because it is silent and durable. A
// sitemap fetch that times out looks, to a naive implementation, exactly
// like a site that publishes no sitemap — and recording
// `publishes_no_sitemap` from it does two things at once: it tells the
// customer something about their site ReachKit never observed, and, because
// the condition is read back for every later page on that destination, it
// stops the sitemap check ever being reported again for that site. Every
// screen stays correct while the check quietly dies. The non-answer
// fixtures in `tests/publish/verify/site.test.ts` are what stop that.
//
// Where the answer did not come, the cost falls on one page and stops
// there: that one check is `unmeasured` for this page alone, with its
// reason; no condition is written; nothing about the site is stated as the
// customer's to act on; and no later page's check is suppressed.
// `unmeasured`, never `false` — nothing anywhere defaults a
// `Measured<boolean>` to `false`.
//
// **`null` is not a clean bill of health.** It means no check has ever had
// an answer to record a condition from. The type is `SiteCondition | null`
// precisely so there is no third value a surface could read as "we looked
// and the site is fine" — ReachKit's only look at this site is whatever the
// last page's check happened to fetch, and REQ-062 bounds the condition to
// exactly that freshness. Nothing here goes back to look: this module makes
// **no outbound request of any kind**, which a source assertion holds.
//
// Stored inside `publications.verify`, not on `destinations`: a fact this
// node observes does not belong in a row the destination health check owns,
// and a second column would be a second place to keep it in step.
//
// The archived plan is WO-262.
import { publishDb } from "../db";
import type { DestinationKind, SiteCondition } from "../types";
import { readStoredCheck } from "./stored";

/** Declared in `src/lib/publish/types.ts` and re-exported here, for the
 *  same reason the verification shapes are: the page record and the
 *  published mail both name it. */
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

/**
 * The recordability predicate this module owns: which condition, if any,
 * the readings of one check entitle ReachKit to record.
 *
 * Pure. `null` is the answer for every non-answer, and for a site that
 * answered and is in neither condition — the two are told apart by the
 * readings, never by this return value, which is why nothing downstream may
 * read `null` as "the site is fine".
 *
 * Where both conditions hold, `robots_blocks_site` is the one recorded: it
 * is the broader stop — a site whose robots blocks the permitted readers
 * across the whole site is not a site whose sitemap is the customer's next
 * problem — and the sitemap check's own `unmeasured` reason still carries
 * what that check found for this page.
 */
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

/**
 * The site's condition as of the last check that got an answer from it.
 *
 * One read over the destination's own publications, newest check first,
 * answered from the condition each check recorded beside its outcome —
 * never a second column, and never a fresh probe. Going back to a site to
 * see whether a recorded condition has been put right is REQ-062's non-goal
 * in terms, and a later page's own check already fetches what this read
 * reports.
 *
 * The row count is bounded by §9's publishing ceilings — at most eight
 * pages a week per site — so this is a small range scan over
 * `idx_publications_site_published`'s own population and not a table sweep.
 *
 * `null` where no check on this destination has ever had an answer to
 * record a condition from. That is **not** "the site is fine".
 */
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
