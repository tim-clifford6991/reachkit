// SPEC §6 (2026-09-20, #908) measure (d) — the one read the *AI engines on
// your blog* card makes.
//
// The typed seam behind which this card's data sits, built exactly like
// `answers-provider.ts` beside it and for the same three reasons: the
// session's account decides whose counts these are; the reserved fixture
// account (`example.com`, IANA-reserved, so no customer can hold it) is
// answered from a fixture; and no module fetches for itself — the page
// calls this once and the card is a pure function of what it returns.
//
// `@/lib/publish/reads/facts` is imported **at the call**, never at the top: it
// resolves `@/lib/db`, which parses the deployment's own bindings at module
// load, and the reserved account's card reaches no database at all.
import { cache } from "react";
import { BLOG_READS_WINDOW_D } from "@/lib/config/constants";
import { isReservedFixtureAccount, requireSetUpAccount } from "../_session/account";
import { assembleBlogReads, windowStartDay, type BlogReadsModel, type VisitWeek } from "@/lib/publish/reads/model";
import { FIXTURE_BLOG_READS_FACTS } from "./blog-reads-fixture";

/** The instant the fixture's counts were taken — the Monday every other
 *  fixture on this screen measures on, so the sweeps are deterministic. */
const FIXTURE_AT = new Date(Date.UTC(2026, 7, 31, 6, 0, 0));

export const readBlogReads = cache(async function readBlogReads(): Promise<BlogReadsModel> {
  const account = await requireSetUpAccount();
  if (isReservedFixtureAccount(account)) {
    return assembleBlogReads(FIXTURE_BLOG_READS_FACTS, BLOG_READS_WINDOW_D, FIXTURE_AT);
  }

  const { readBlogReadFacts } = await import("@/lib/publish/reads/facts");
  const { now } = await import("@/lib/config/now");
  const at = now();
  return assembleBlogReads(
    await readBlogReadFacts({ siteId: account.siteId }, at, BLOG_READS_WINDOW_D),
    BLOG_READS_WINDOW_D,
    at
  );
});

/** The reserved account's visits from Google, week by week. */
const FIXTURE_GOOGLE_VISITS = [2, 4, 9];

/** Visits from Google search per week, oldest first, read from the hosted
 *  pages' own counts; `null` where no hosted page is live or the counts could not be read. */
export const readGoogleVisitWeeks = cache(async function readGoogleVisitWeeks(): Promise<readonly VisitWeek[] | null> {
  const account = await requireSetUpAccount();
  const reads = await readBlogReads();
  if (!reads.show) return null;
  if (isReservedFixtureAccount(account)) {
    return FIXTURE_GOOGLE_VISITS.map((visits, i) => ({
      start: windowStartDay(FIXTURE_AT, (FIXTURE_GOOGLE_VISITS.length - i) * 7),
      visits,
    }));
  }
  const [{ readSearchVisitsWeekly }, { now }] = await Promise.all([
    import("@/lib/publish/reads/store"),
    import("@/lib/config/now"),
  ]);
  return readSearchVisitsWeekly({ siteId: account.siteId, now: now() }).catch(() => null);
});

/** Visits from Google search this week; `null` where they cannot be counted. */
export const readGoogleVisits = cache(async function readGoogleVisits(): Promise<number | null> {
  const weeks = await readGoogleVisitWeeks();
  return weeks === null ? null : (weeks.at(-1)?.visits ?? 0);
});
