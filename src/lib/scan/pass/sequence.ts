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

/**
 * The six stages in `STAGES` order, each inside its own budget, with both
 * of the pass's ceilings re-checked between every one.
 *
 * Stages two and four report reads that arrive with stage one's own call:
 * `measureDomain` is one call and produces the access rules and the
 * customer's own ranked rows alongside the site's own documents. `STAGES`
 * order is preserved exactly; what differs is when a completed stage is
 * reported, not what it reports. The alternative is splitting
 * `measureDomain` into a read half and a presence half, which changes that
 * module's declared signature — which is why it is not taken here.
 *
 * **Each stage is bounded by its own budget, not only by the pass's**
 * (issue #539). Before this, one overall ceiling was the only bound, so
 * whichever stage was slow consumed all of it and every later stage read
 * `not_attempted` — which is why no production free scan had ever reached
 * `complete`. A stage that spends its own budget now ends *there*: it emits
 * no exit event (`stages.ts`: "a stage the ceilings cut off emits no
 * `done: true`"), its sections keep the `not_attempted` arm they were
 * initialised with, and the pass goes on to the next stage and keeps
 * buying. The pass's own ceilings are unchanged and still end it.
 *
 * **The site's crawl may run beside the market** (issue 1419), and the pass
 * waits for it before it ends, so the report is composed with its site
 * issues in it.
 */
export async function runStages(a: StageArgs): Promise<void> {
  const crawl: SiteCrawl = { reading: Promise.resolve() };
  try {
    await stagesOf(a, crawl);
  } finally {
    await crawl.reading;
  }
}

/**
 * Issue 1551: the score's Content over the site's measured pages — the
 * pages ReachKit has live for it, newest first, then the pages its crawl
 * read — up to the tier's allowance (`withMeasuredPages`). A free scan has
 * no site and an allowance of none, so it reads nothing here. A list of our
 * pages that cannot be read leaves the crawl's pages to stand alone.
 */
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

/** The crawl of the customer's own site, while it runs (issue 1419). */
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
  // **A pass whose deadline fired writes nothing more** (issue 607). The
  // report is composed from `sections` the moment the deadline wins, and
  // nothing in flight can be cancelled — so every write below an `await`
  // in this function reads `bounds.abandoned()` first.
  if (bounds.abandoned()) return;
  // Stage one's budget ends the pass, not just the stage: nothing after it
  // measures anything without the site's own documents. It ends by the
  // column that ran out — never `complete`, never §479's refusal, which
  // would blame the customer's domain for a budget of our own (#539).
  if (read.spent) {
    bounds.stageExhausted(read.reason);
    return;
  }
  const measurement = read.value;
  if (!failed(measurement)) sections.measurement = measurement;
  await exit("reading_your_site");
  const siteLocale = failed(measurement) || measurement.homeRefusal !== null ? null : readSiteLocale(measurement);
  if (siteLocale !== null && a.siteId !== undefined && a.locale === undefined) {
    // The reading is the site's from here on (D66). A write that fails
    // costs nothing this pass, which already holds it: the next pass reads
    // the site again.
    await writeSiteLocale(a.siteId, siteLocale).catch((error: unknown) =>
      console.log(
        JSON.stringify({ event: "site_locale_unwritten", because: error instanceof Error ? error.message : String(error) })
      )
    );
  }

  // A site whose own home document could not be read — refused by the
  // fetcher, or a read that raised — is not measured by anything after it,
  // and the pass does not pretend otherwise: it stops here, and the ending
  // is `site_unreadable` with the refusal, never `complete` (issue #479).
  if (failed(measurement) || measurement.homeRefusal !== null) {
    bounds.siteUnreadable(failed(measurement) ? null : measurement.homeRefusal);
    return;
  }

  // D67 for the free pass (owner ruling 2026-10-15, issue 1441): a home page
  // that states the town it serves is measured there, as a paid pass
  // measures the place it settled. Looked up beside the crawl and the
  // access rules, and in force before the market is read.
  const placing = a.parameters.measuresStatedPlace && a.concludesMarket !== true ? statedPlaceOfPass(measurement) : Promise.resolve(null);

  // SPEC.md §2: "The scan builds the site profile" — up to 100 pages from
  // the sitemap and internal links, one run per scan, inside the existing
  // caps (§12 ruling 8, 2026-09-12). It belongs to this stage because this
  // is the stage that reads the customer's own site, and it runs at every
  // tier for the same reason every other stage does: the weekly pass is
  // this pipeline, so §5's "the weekly pass refreshes the profile" is this
  // call under the weekly cap rather than a second scheduler.
  //
  // **What this call does at which tier.** Every tier crawls, classifies
  // and stores the inventory, the page count and the site name — the site
  // name off the home document itself, with no model call. The voice
  // summary, the products and the claims are the profile's inference half
  // and derive at the paid tiers only: `tests/llm/budget.test.ts` pins the
  // free pass at two nano calls, which is 30 s of the 60 the platform
  // allows this invocation, and a third would not fit. The deep pass runs
  // in the background once setup is submitted and seeds the founder's
  // voice from it (issue 839); the weekly pass refreshes it after that.
  //
  // **Its failure is not this stage's verdict.** `attempt` exists to turn a
  // raised stage into `stage_undeterminable` — a statement about what the
  // *measurement* could not determine, which the report then carries. The
  // profile contributes nothing to the report, so a profile that could not
  // be built says nothing about the measurement and must not wear that
  // word: `tests/scan/free/vendor-failure.test.ts` reads exactly this, and
  // a pass whose ranked-keywords call failed at the vendor would otherwise
  // report a second, unrelated undeterminable stage. Its own event says
  // what actually happened, and the pass continues either way.
  //
  // **Beside the market, where the market does not read it** (issue 1419).
  // A free pass reads its market from the home document alone, and waiting
  // for up to 100 pages first cost its Google reads a median of 8.7 s of the
  // queue (the stored free scans of 2026-10-08 to 2026-10-14): the one
  // read stripe.com asked gave up at the deadline. A pass that concludes
  // its market reads the crawled pages for it, so it still waits here.
  const readTheSite = async (): Promise<void> => {
    try {
      const { buildSiteProfileWithCrawl } = await import("@/lib/site-profile");
      const { readingOf } = await import("@/lib/site-issues");
      const { profile, crawl } = await buildSiteProfileWithCrawl(cost, {
        domain,
        // `CanonicalDomain` is the branded string itself, and the home
        // address the measurement read is `https://<domain>/` — the same
        // one `measureDomain` builds, whose own helper is private to that
        // module. The crawl re-reads nothing: this address is row one of
        // the inventory and is already in the `fetches` cache.
        homeUrl: `https://${domain}/`,
        // Issue 1379: where bot protection answered the plain read and the
        // vendor's browser returned the site, that document is the home
        // page — the crawl's own read of it would be the protection's.
        homeHtml: measurement.renderedHome ?? null,
        sitemaps: measurement.robots.kind === "unmeasured" ? [] : measurement.robots.value.sitemaps,
        tier: a.tier,
        locale: measurement.locale,
      });
      const content = await measuredContent(a, measurement, crawl.pages.map((page) => page.url));
      // SPEC §9: the technical-issue checks run over exactly this crawl —
      // the one run, nothing fetched beyond its set (2026-09-12).
      if (!bounds.abandoned() && !sections.sealed) {
        if (sections.measurement !== null) {
          sections.measurement = { ...sections.measurement, drivers: { ...sections.measurement.drivers, answerability: content } };
        }
        if (profile !== null) sections.siteName = promptSiteName(profile.siteName, domain);
        sections.siteCrawl = readingOf(crawl);
        sections.pagesRead = crawl.pages.map((page) => ({
          url: page.url,
          title: page.title,
          h1: page.h1,
          text: page.text,
        }));
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
  // **A retry reads the market it already has** (SPEC §2, issue 715). The
  // stage is entered and exited so the screen's stage list still reads
  // straight through, and it buys nothing: `resumeMarket` puts the stored
  // report's profile, suggestions, twelve searches and wording back into
  // `sections`, which is the one part of a free pass the ledger cannot
  // return for free (`llm()` caches at `freshnessDays: 0`). Re-deriving it
  // would cost the two nano calls again and could come back with different
  // questions — a different report at the same address, not a retried part.
  const marketFromCents = cost.spentCents();
  let market: StageOutcome<void> = SKIPPED_STAGE;
  if (retry === undefined) {
    // The market spends from the purse it shares with the twelve, and the
    // twelve get what it left (issue 835): an extra seed is only ever
    // bought with the SERPs of questions the pass does not have.
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

  // No stage-abandonment guard is threaded here, and none is owed:
  // `sizesRivals` is false on the free path and the budget applies on no
  // other, so on every pass this stage can be abandoned on, it returns
  // before it awaits anything at all. Its one write still reads the pass's
  // own `abandoned()`, which costs nothing.
  if (bounds.stopNow() !== null) return;
  await enter("checking_your_presence");
  const presence = await inBudget("checking_your_presence", (b) => sizeTrackedRivals({ ...a, bounds: b }));
  if (bounds.abandoned()) return;
  if (!presence.spent) await exit("checking_your_presence");

  if (bounds.stopNow() !== null) return;
  await enter("asking_the_twelve");
  // **A retry of a part this stage does not produce does not ask again**
  // (issue 715). The stored SERPs go back into `sections` instead, so the
  // two cards counted over them are rebuilt from the same answers the
  // report already showed — never re-derived from an empty battery, which
  // would replace a measured card with an unmeasured one for the sake of a
  // part that is neither. Where the part *is* this stage's, it runs: the
  // questions already bought come back from `fetches` free of charge and
  // only the ones the ceiling cut off are paid for.
  let twelve: StageOutcome<void> = SKIPPED_STAGE;
  let asking: Promise<void> = Promise.resolve();
  if (retry !== undefined && RETRY_STAGE[retry.part] !== "asking_the_twelve") {
    resumeSerps(sections, retry.report);
  } else {
    twelve = await inBudget(
      "asking_the_twelve",
      async (b, abandoned) => {
        // **Beside the twelve, not after them** (#1160). The page questions
        // (#919) run inside this same budget row — the same clock, the same
        // `WEEKLY` cap and the same `stopNow()` before every call — and the
        // twelve are handed to the queue first. They used to ask *after*
        // the twelve, and on the standard queue that is a second full wait
        // of two to three minutes: the weekly passes of 2026-09-21 and
        // 2026-09-28 met their ceiling inside it and never reached scoring,
        // so rivals were never sized. A standard-queue ask costs its wait
        // whether one question is in the queue or twenty-four, so asking
        // both sets together costs the pass no time.
        // The market's buyer prompts join them (#1195), so the rivals are
        // concluded from answers in the market this pass measures.
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
  // D63 (issue 1298): a stage that spent its clock stops waiting, and the
  // asks it left go on. The pass waits for them here — the reads still
  // queued and the one more ask of a read that failed — so what was bought
  // is scored. No new first ask starts, and every queued read gives up by
  // itself `askReserveS` before the pass's ceiling (issue 1352), so the
  // pass still ends `complete`.
  if (twelve.spent && stillCollecting(bounds, a.parameters)) await asking;
  if (bounds.abandoned()) return;
  if (!twelve.spent) await exit("asking_the_twelve");

  // Scoring itself buys nothing and is synchronous — it counts over SERPs
  // already paid for (§6.6's "zero extra cost"). Its budget row is the CPU
  // the count is allowed, and there is no await inside `score` for a race
  // to preempt, so it is not wrapped: a synchronous call cannot be cut off.
  //
  // The one purchase in this stage is `sizeSerpRivals` (issue 901), and it
  // is here because this is the first moment the twelve's own top tens
  // exist: the stage that asks them is the stage before. It runs at the
  // tiers whose `sizesRivals` says so and buys nothing at any other, so
  // the free path's 0¢ budget row for this stage still describes it.
  // **A ceiling met during the asks still counts what they bought**
  // (#1160). Scoring buys nothing and cannot be cut off. Skipping it left
  // a pass that had paid for eleven AI Mode answers with no AI-answers
  // section at all. Only the purchase in the stage (`sizeSerpRivals`) is
  // what the ceiling stops.
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
