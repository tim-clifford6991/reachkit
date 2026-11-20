// src/lib/scan/pass/sequence.ts — the six stages in order, each caught at its own stage.
import { promptSiteName } from "@/lib/market/prompts/generate";
import { writeSiteLocale } from "@/lib/locale/site";
import { measureDomain, withMeasuredPages, type DomainMeasurement } from "@/lib/measure";
import { MARKET_PURSE_CENTS, twelveCentsAfter, withStageBudget, type StageOutcome } from "../budgets";
import type { Bounds } from "../ceilings";
import { RETRY_STAGE } from "../retry";
import { enterStage, exitStage, type StageName } from "../stages";
import { attempt, failed, resumeMarket, resumeSerps, SKIPPED_STAGE, type StageArgs, stillCollecting, summaryAt } from "./sections";
import { inPlace, readSiteLocale, statedPlaceOfPass } from "./place";
import { readMarket } from "./market";
import { sizeSerpRivals, sizeTrackedRivals } from "./rivals";
import { askTheTwelve } from "./serps";
import { askTheMarketPrompts, askThePageQuestions, askTheTrackedPrompts } from "./prompts";
import { score } from "./compose";

/** The six stages in `STAGES` order, each inside its own budget, both pass ceilings re-checked between. Stages two and four report reads
 *  that arrive with stage one's single `measureDomain` call; the order is kept, only when a stage is reported differs.
 *  A stage that spends its own budget ends there with no exit event and its sections `not_attempted`, and the pass goes on.
 *  The site's crawl may run beside the market; the pass waits for it so the report holds its site issues. */
export async function runStages(a: StageArgs): Promise<void> {
  const crawl: SiteCrawl = { reading: Promise.resolve() };
  try {
    await stagesOf(a, crawl);
  } finally {
    await crawl.reading;
  }
}

/** The score's Content over the site's measured pages (ReachKit's live pages newest first, then the crawl's), up to the tier's allowance.
 *  A free scan has none. An unreadable list of our pages leaves the crawl's to stand alone. */
async function measuredContent(a: StageArgs, m: DomainMeasurement, crawled: readonly string[]): Promise<DomainMeasurement["drivers"]["answerability"]> {
  let ours: readonly string[] = [];
  if (a.siteId !== undefined) {
    try {
      const { readLivePages } = await import("@/lib/known-content/ours");
      ours = await readLivePages(a.siteId);
    } catch (error) {
      console.log(JSON.stringify({ event: "live_pages_unread", because: error instanceof Error ? error.message : String(error) }));
    }
  }
  const read = await withMeasuredPages(a.cost, {
    measurement: m,
    domain: a.domain,
    tier: a.tier,
    at: a.startedAt,
    pages: [...ours, ...crawled],
    ...(a.sinceDays === undefined ? {} : { ownWindowDays: a.sinceDays }),
  });
  return read.drivers.answerability;
}

/** The crawl of the customer's own site, while it runs. */
interface SiteCrawl {
  reading: Promise<void>;
}

async function stagesOf(a: StageArgs, crawl: SiteCrawl): Promise<void> {
  const { scanId, bounds, cost, domain, sections, retry } = a;

  /** Entry, recorded on the scan's own log and reported to the optional
   *  durable hook, in that order and never one without the other. */
  const enter = async (stage: StageName): Promise<void> => {
    await enterStage(scanId, stage);
    await a.onStage?.(stage);
  };
  const exit = (stage: StageName): Promise<void> => exitStage(scanId, stage, summaryAt(stage, a));

  /** One stage's work, inside that stage's own budget. The `Bounds` handed
   *  down answers for the stage's ceilings as well as the pass's, so every
   *  multi-call step that already re-reads `stopNow()` between calls starts
   *  respecting its stage's budget with no line of its own changing. */
  const inBudget = <T>(
    stage: StageName,
    work: (b: Bounds, abandoned: () => boolean) => Promise<T>,
    cents?: number
  ): Promise<StageOutcome<T>> =>
    withStageBudget(
      { stage, bounds, cost, applies: a.parameters.stageBudgets, ...(cents === undefined ? {} : { cents }) },
      work
    );

  if (bounds.stopNow() !== null) return;
  await enter("reading_your_site");
  const read = await inBudget("reading_your_site", () =>
    attempt("reading_your_site", () =>
      measureDomain(cost, {
        domain,
        at: a.startedAt,
        tier: a.tier,
        ...(a.locale === undefined ? {} : { locale: a.locale }),
        ...(a.sinceDays === undefined ? {} : { ownWindowDays: a.sinceDays }),
        ...(a.siteId === undefined ? {} : { listingDecides: true }),
      })
    )
  );
  // A pass whose deadline fired writes nothing more: the report is composed the moment it wins and nothing in flight can be cancelled,
  // so every write below an `await` here reads `bounds.abandoned()` first.
  if (bounds.abandoned()) return;
  // Stage one's budget ends the pass: nothing after it measures without the site's documents. It ends by the column that ran out,
  // never `complete` and never `site_unreadable`, which would blame the customer's domain for our budget.
  if (read.spent) {
    bounds.stageExhausted(read.reason);
    return;
  }
  const measurement = read.value;
  if (!failed(measurement)) sections.measurement = measurement;
  await exit("reading_your_site");
  const siteLocale = failed(measurement) || measurement.homeRefusal !== null ? null : readSiteLocale(measurement);
  if (siteLocale !== null && a.siteId !== undefined && a.locale === undefined) {
    // The reading is the site's from here on; a failed write costs nothing this pass, and the next pass reads the site again.
    await writeSiteLocale(a.siteId, siteLocale).catch((error: unknown) =>
      console.log(
        JSON.stringify({ event: "site_locale_unwritten", because: error instanceof Error ? error.message : String(error) })
      )
    );
  }

  // A site whose home document could not be read is measured by nothing after it: the pass ends `site_unreadable` with the refusal.
  if (failed(measurement) || measurement.homeRefusal !== null) {
    bounds.siteUnreadable(failed(measurement) ? null : measurement.homeRefusal);
    return;
  }

  // A free pass's home page that states the town it serves is measured there; looked up beside the crawl and in force before the market is read.
  const placing = a.parameters.measuresStatedPlace && a.concludesMarket !== true ? statedPlaceOfPass(measurement) : Promise.resolve(null);

  // The site profile: up to 100 pages from the sitemap and links, one run per scan inside the existing caps, at every tier (the weekly pass refreshes it).
  // Every tier stores the inventory, page count and site name; the voice, products and claims are inference and derive at paid tiers only,
  // since the free pass's budget holds two nano calls.
  // Its failure is not this stage's verdict: the profile adds nothing to the report, so it must not report `stage_undeterminable`; its own event says what happened.
  // It runs beside the market where the market does not read it: a free pass reads its market from the home document alone,
  // and waiting for 100 pages cost its queued Google reads. A pass that concludes its market from the crawled pages still waits.
  const readTheSite = async (): Promise<void> => {
    try {
      const { buildSiteProfileWithCrawl } = await import("@/lib/site-profile");
      const { readingOf } = await import("@/lib/site-issues");
      const { profile, crawl } = await buildSiteProfileWithCrawl(cost, {
        domain,
        // The home address `measureDomain` read, row one of the inventory and already in the `fetches` cache, so the crawl re-reads nothing.
        homeUrl: `https://${domain}/`,
        // Where bot protection answered the plain read and the vendor's browser returned the site, that document is the home page.
        homeHtml: measurement.renderedHome ?? null,
        sitemaps: measurement.robots.kind === "unmeasured" ? [] : measurement.robots.value.sitemaps,
        tier: a.tier,
        ...(a.siteId === undefined ? {} : { siteId: a.siteId }),
        locale: measurement.locale,
      });
      const content = await measuredContent(a, measurement, crawl.pages.map((page) => page.url));
      // SPEC §9: the technical-issue checks run over exactly this crawl, nothing fetched beyond its set.
      if (!bounds.abandoned() && !sections.sealed) {
        if (sections.measurement !== null) {
          sections.measurement = { ...sections.measurement, drivers: { ...sections.measurement.drivers, answerability: content } };
        }
        if (profile !== null) sections.siteName = promptSiteName(profile.siteName, domain);
        sections.siteCrawl = readingOf(crawl);
        sections.pagesRead = crawl.pages.map(({ url, title, h1, text, unread }) => ({ url, title, h1, text, ...(unread === undefined ? {} : { unread }) }));
      }
    } catch (error) {
      console.log(
        JSON.stringify({
          event: "site_profile_undeterminable",
          because: error instanceof Error ? error.message : String(error),
        })
      );
    }
  };
  if (bounds.stopNow() === null) crawl.reading = readTheSite();
  if (a.concludesMarket === true) await crawl.reading;

  // Reports the access rules stage one already read: it buys nothing and
  // waits for nothing, so it has nothing to spend its budget on.
  if (bounds.stopNow() !== null) return;
  await enter("reading_access_rules");
  await exit("reading_access_rules");

  const placed = await placing;
  if (bounds.abandoned()) return;
  if (placed !== null) inPlace(sections, placed);

  if (bounds.stopNow() !== null) return;
  await enter("reading_your_market");
  // A retry reads the market it already has: the stage is entered and exited so the list reads through, and buys nothing.
  // `resumeMarket` restores the profile, suggestions, twelve and wording; re-deriving them would cost two nano calls and could change the questions.
  const marketFromCents = cost.spentCents();
  let market: StageOutcome<void> = SKIPPED_STAGE;
  if (retry === undefined) {
    // The market spends from the purse it shares with the twelve, and the twelve get what it left.
    market = await inBudget(
      "reading_your_market",
      (b, abandoned) => readMarket({ ...a, bounds: b }, abandoned),
      MARKET_PURSE_CENTS
    );
  } else {
    resumeMarket(sections, retry.report);
  }
  const twelveCents = twelveCentsAfter(cost.spentCents() - marketFromCents);
  // An abandoned pass reports no exit either: a stage the ceilings cut off
  // emits no `done: true` (`stages.ts`), and the ending is already out.
  if (bounds.abandoned()) return;
  if (!market.spent) await exit("reading_your_market");

  // No stage-abandonment guard is owed: `sizesRivals` is false on the free path and stage budgets apply on no other, so where this can be abandoned
  // it returns before awaiting anything. Its one write still reads the pass's `abandoned()`.
  if (bounds.stopNow() !== null) return;
  await enter("checking_your_presence");
  const presence = await inBudget("checking_your_presence", (b) => sizeTrackedRivals({ ...a, bounds: b }));
  if (bounds.abandoned()) return;
  if (!presence.spent) await exit("checking_your_presence");

  if (bounds.stopNow() !== null) return;
  await enter("asking_the_twelve");
  // A retry of a part this stage does not produce does not ask again: the stored SERPs go back into `sections`, so both cards are rebuilt
  // from the same answers. Where the part is this stage's it runs, and questions already bought come back from `fetches` free.
  let twelve: StageOutcome<void> = SKIPPED_STAGE;
  let asking: Promise<void> = Promise.resolve();
  if (retry !== undefined && RETRY_STAGE[retry.part] !== "asking_the_twelve") {
    resumeSerps(sections, retry.report);
  } else {
    twelve = await inBudget(
      "asking_the_twelve",
      async (b, abandoned) => {
        // Beside the twelve, not after them: page questions and the market's buyer prompts run inside this budget row (same clock, `WEEKLY` cap, `stopNow()`),
        // handed to the queue after the twelve. A standard-queue ask costs its wait however many are queued, so asking together costs no time.
        asking = askTheTwelve({ ...a, bounds: b }, abandoned, bounds);
        await Promise.all([
          asking,
          askThePageQuestions({ ...a, bounds: b }, abandoned),
          askTheMarketPrompts({ ...a, bounds: b }),
          askTheTrackedPrompts({ ...a, bounds: b }),
        ]);
      },
      twelveCents
    );
  }
  // A stage that spent its clock stops waiting, but the reads still queued and one re-ask go on; the pass waits for them here so what was bought is scored.
  // No new first ask starts, and each queued read gives up `askReserveS` before the ceiling, so the pass still ends `complete`.
  if (twelve.spent && stillCollecting(bounds, a.parameters)) await asking;
  if (bounds.abandoned()) return;
  if (!twelve.spent) await exit("asking_the_twelve");

  // Scoring buys nothing and is synchronous (§6.6's "zero extra cost"), so it is not raced. Its one purchase, `sizeSerpRivals`, is here because the twelve's
  // top tens first exist now; it runs only where `sizesRivals` says so. A ceiling met during the asks still scores what they bought; only the purchase is skipped.
  if (bounds.stopNow() !== null) {
    await crawl.reading;
    score(a);
    return;
  }
  await enter("scoring");
  await Promise.all([sizeSerpRivals(a), crawl.reading]);
  if (bounds.abandoned()) return;
  score(a);
  await exit("scoring");
}
