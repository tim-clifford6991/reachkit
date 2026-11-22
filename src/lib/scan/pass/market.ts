// src/lib/scan/pass/market.ts — reading the market: the profile, the searches and the twelve chosen.
import { BATTERY, MARKET_REMEASURE_H, PRICE_BOOK, SELECTION, TRACKED_PROMPTS } from "@/lib/config/constants";
import { dbAdmin } from "@/lib/db";
import { deriveMarketSet, joinMarketSets, type SuggestionRow } from "@/lib/market/questions/market-set";
import { phraseQuestions } from "@/lib/market/questions/phrase";
import { deriveProfile, type Profile } from "@/lib/market/questions/profile";
import { selectTwelve, type SelectedSearch } from "@/lib/market/questions/select";
import { isShort, seedLadder, selectWidened } from "@/lib/market/questions/widen";
import { offeringSeeds, offeringsOf, spreadAcrossOfferings } from "@/lib/market/questions/offerings";
import { marketSeeds, measuredMarketOf, unjudged } from "@/lib/market/questions/measured";
import type { Locale, Place } from "@/lib/locale/locales";
import { localSearch } from "@/lib/locale/place";
import { BOT_PROTECTION, type DomainMeasurement } from "@/lib/measure";
import { HOME_WORDLESS } from "@/lib/measure/blank-page";
import { unmeasured } from "@/lib/measure/measured";
import { readSiteCategory } from "../site-category";
import { STAGE_BUDGETS, affordsSeed, questionsAffordable } from "../budgets";
import type { Bounds } from "../ceilings";
import { searchFootprintOf, type ThinFootprint } from "../search-footprint";
import type { StoredReport } from "../report";
import { attempt, failed, localeOfPass, ownRankedValue, poolOf, type StageArgs, untyped } from "./sections";
import { holdsTown, inPlace, outOfPlace, townFromPage } from "./place";
import { sizeTrackedRivals } from "./rivals";

/** What the profile call reads (§6.7 step 1): the site's own home and pricing text, or `null` where there is none.
 *  A site bot protection kept the reader off, whose home page did not answer in time or says nothing of what it sells has no text of its own;
 *  only then is its listing in search (stage one's ranked rows, with titles and snippets) read instead. A listing too thin to name a market is not read, and the reason kept. */
export function marketReadingOf(
  a: StageArgs,
  measurement: DomainMeasurement
): { home: string; pricing?: string } | { search: string } | null {
  if (measurement.text.home !== null && measurement.homeWordless !== true) {
    return {
      home: measurement.text.home,
      ...(measurement.text.pricing === null ? {} : { pricing: measurement.text.pricing }),
    };
  }
  // And so is one whose home page did not answer in time.
  if (measurement.protection === undefined && measurement.homeTimedOut !== true && measurement.homeWordless !== true) return null;
  return listingReadingOf(a, measurement);
}

/** The site's listing in search as the profile call's reading, or `null`
 *  where it is too thin to name a market from (and why is kept). */
function listingReadingOf(a: StageArgs, measurement: DomainMeasurement): { search: string } | null {
  const footprint = searchFootprintOf({ domain: a.domain, rows: measurement.ownRankedRows });
  if (footprint.kind === "thin") {
    a.sections.marketThin = footprint.because;
    logMarketFromSearch({ read: false, because: footprint.because, searches: footprint.searches, descriptive: footprint.descriptive });
    return null;
  }
  logMarketFromSearch({ read: true, searches: footprint.searches, descriptive: footprint.descriptive, pages: footprint.pages });
  return { search: footprint.text };
}

/** Whether the stage still has time for a second profile call: at least half its own seconds left, so a fast failure leaves room and a timeout does not. */
function roomForAnotherProfile(bounds: Bounds): boolean {
  return bounds.stopNow() === null && bounds.remainingMs() >= (STAGE_BUDGETS.reading_your_market.seconds * 1000) / 2;
}

/** Counts only: never a search, a title or a snippet. */
function logMarketFromSearch(fields: { read: boolean; because?: ThinFootprint; searches?: number; descriptive?: number; pages?: number }): void {
  console.log(JSON.stringify({ event: "market_from_search", ...fields }));
}

/** Whether a stored report is one this build would measure further, so it is not served inside the re-scan window: bot protection kept the reader off
 *  and no market was read from search, or the site ranks, its market was not read and the pass is a day old. One whose listing was too thin is served as any other. */
export function awaitsMarketFromSearch(report: StoredReport, now: Date): boolean {
  if (report.market.kind !== "unmeasured") return false;
  // A market the re-score withdrew, read off a page that was not the site's words.
  if (report.market.because === BOT_PROTECTION || report.market.because === HOME_WORDLESS) return true;
  if (report.market.because !== undefined) return false;
  if (report.onPage.kind === "unmeasured" && report.onPage.because === BOT_PROTECTION) return true;
  // A site that ranks whose market a vendor or the model did not answer for is read from its ranked rows now, but re-measured at most once a day,
  // so a site that keeps failing costs at most one extra free pass a day.
  const ageMs = now.getTime() - new Date(report.verdict.measuredAt).getTime();
  return report.market.reason === "undeterminable" && report.ownRankedRows.length > 0 && ageMs >= MARKET_REMEASURE_H * 3_600_000;
}

/** §6.7 steps 1–4: profile → measured market → the twelve → their wording.
 *  Each step's failure stops the chain at that step and leaves everything
 *  after it on the arm it was initialised with; nothing downstream is
 *  synthesised from a step that did not answer. */
export async function readMarket(a: StageArgs, abandoned: () => boolean): Promise<void> {
  const { bounds, cost, sections } = a;
  const measurement = sections.measurement;
  if (measurement === null) return;
  const pages = marketReadingOf(a, measurement);
  if (pages === null) return;
  let reading = pages;

  let profile = await attempt("reading_your_market", () => deriveProfile(cost, { locale: localeOfPass(a), ...pages }));
  if (abandoned()) return;
  // The pages were read but the model gave no profile or named no category: a site that ranks has a listing in search, read in their place
  // as for a bot-protected site, but only where the pass still has time for this call and the phrasing after it.
  if ((failed(profile) || profile.kind === "unmeasured" || profile.value.category === "") && "home" in reading && roomForAnotherProfile(bounds)) {
    const listing = listingReadingOf(a, measurement);
    if (listing !== null) {
      reading = listing;
      profile = await attempt("reading_your_market", () => deriveProfile(cost, { locale: localeOfPass(a), ...listing }));
      if (abandoned()) return;
    }
  }
  if (failed(profile)) return;
  // The model was told to name no category the pages or the listing do not
  // support. Where it named none, a paying site is measured under the
  // category it holds, read now since Details may have saved it after the
  // pass was claimed; a site holding none has no market, and none is guessed.
  let measuredUnder = a.category;
  if (profile.kind !== "unmeasured" && profile.value.category === "") {
    measuredUnder = a.concludesMarket === true && a.siteId !== undefined ? ((await readSiteCategory(a.siteId).catch(() => undefined)) ?? a.category) : undefined;
    if (abandoned()) return;
    if (measuredUnder === undefined) {
      sections.marketThin = "market_not_named";
      logMarketFromSearch({ read: false, because: "market_not_named" });
      return;
    }
    sections.concludedCategory = measuredUnder;
  }
  if ("search" in reading && profile.kind !== "unmeasured") sections.marketFrom = "search";
  sections.profile = profile;
  if (profile.kind === "unmeasured") return;
  // On a paying site the customer's corrections to who buys and what the business does choose its searches; the report keeps the profile as read.
  const selecting = a.siteId !== undefined && a.concludesMarket === true ? await withFounderEdits(a.siteId, profile.value) : profile.value;
  if (abandoned()) return;
  // A town is the market of a business that sells there, by the rule a paid pass holds its place to; one read as selling nationally or beyond,
  // or as software, is measured in its country whatever address its home page states. The seeds below first read the town.
  const placedIn = sections.measurement?.locale.place;
  if (a.concludesMarket !== true && sections.placeFrom !== null && placedIn !== undefined && !holdsTown(placedIn, selecting, measurement, a.domain)) {
    outOfPlace(sections);
  }

  // The market is ReachKit's to keep current: re-checked here, before anything is bought, so this pass seeds and measures the market that stands.
  let synonyms: readonly string[] = [];
  if (a.concludesMarket === true && a.siteId !== undefined && sections.pagesRead !== null) {
    try {
      const { concludeMarketForPass } = await import("../market-conclusion");
      const concluded = await concludeMarketForPass({
        siteId: a.siteId,
        domain: a.domain,
        scanId: a.scanId,
        cost,
        pages: sections.pagesRead,
        ...("search" in reading ? { listing: reading.search } : {}),
        at: a.startedAt,
        ...(measurement.stated === undefined ? {} : { stated: measurement.stated }),
      });
      if (abandoned()) return;
      if (concluded !== null) {
        // From here the pass measures where the business serves: the place this conclusion settled, or none.
        const country: Locale = { country: measurement.locale.country, language: measurement.locale.language };
        sections.measurement = { ...measurement, locale: concluded.place === null ? country : { ...country, place: concluded.place } };
        measuredUnder = concluded.category;
        synonyms = concluded.synonyms;
        sections.concludedCategory = concluded.category;
        sections.market = concluded.market;
        sections.founderBuyer = concluded.founderBuyer;
        if (!concluded.rivalsOverridden) {
          sections.poolRivals = new Set(concluded.market.rivals.map((r) => r.domain));
        }
      }
    } catch (error) {
      console.log(
        JSON.stringify({
          event: "market_conclusion_failed",
          because: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  // Where the structured data named no town, the town the profile call read off the page's own words, once the vendor's list holds it.
  if (a.parameters.measuresStatedPlace && a.concludesMarket !== true && sections.measurement !== null && localeOfPass(a).place === undefined) {
    const fromPage = await townFromPage(selecting.town, sections.measurement);
    if (abandoned()) return;
    if (fromPage !== null && holdsTown(fromPage.place, selecting, measurement, a.domain)) inPlace(sections, fromPage);
  }

  // Thin markets: the first seed is the one every pass buys; the rest of the ladder is bought one seed at a time, only while short,
  // except the market's other names (its searched terms, else a concluded market's synonyms), bought with the first inside the three extra purchases.
  const place = localeOfPass(a).place;
  const searched = marketSeeds(sections.market, place);
  // A local business's market is bought for its place, so every seed is the service plus the place.
  const ladder = seedLadder(selecting, measuredUnder, synonyms, searched);
  const seeds = place === undefined ? ladder : [...new Set(ladder.map((seed) => localSearch(seed, place)))];
  // The other lines the business sells are bought with the first while the purse holds each of them and the questions after.
  const lines = offeringSeeds(selecting).filter((_, i) =>
    affordsSeed({ remainingCents: bounds.remainingCents() - (i + 1) * PRICE_BOOK.SUGGESTIONS_COST_C, selected: BATTERY.QUESTIONS })
  );
  const withFirst = (searched.length > 0 ? searched : [...lines, ...synonyms]).map((seed) => (place === undefined ? seed : localSearch(seed, place)));
  const boughtWithFirst = (seed: string): boolean => withFirst.some((x) => x.trim().toLowerCase() === seed.toLowerCase());
  const leading = seeds.slice(1).findIndex((seed) => !boughtWithFirst(seed));
  const upfront = Math.min(leading === -1 ? seeds.length - 1 : leading, a.parameters.extraSeeds);
  // The site's own footprint, read before any market is bought: each suggestions purchase asks only for rows inside its window,
  // and selection never takes a search outsized for it (SPEC §6 right-sizing).
  const ownRanked = ownRankedValue(measurement.ownRanked);
  if (bounds.stopNow() !== null) return;
  const market = await attempt("reading_your_market", () =>
    deriveMarketSet(cost, { seeds: seeds.slice(0, 1 + upfront), ownRanked, locale: localeOfPass(a) })
  );
  if (abandoned()) return;
  // Suggestions that did not come back are not the end of the market: the site's ranked rows and any rival's are the pool selection widens into,
  // and further seeds are still bought while short. Where none answered, the questions come from the pool alone and the record says the suggestions were not read.
  const suggestionsRead = !failed(market) && market.kind !== "unmeasured";
  sections.marketRows = failed(market) ? unmeasured("undeterminable", a.startedAt) : market;
  if (!suggestionsRead && poolOf(sections).length === 0) return;
  const bought: readonly SuggestionRow[] = suggestionsRead ? market.value : [];

  // The market's other names are its words too, so a search in them is on-market; the market in force says which searches are measured and which never are.
  let measuredMarket = measuredMarketOf(sections.market, place);
  // What this site's passes measured in the last weeks, so the week's twelve read something new. A correction re-reads its own week.
  const recent = a.siteId === undefined || a.tier !== "weekly" || a.correction ? [] : await recentSearches(a.siteId, a.startedAt);
  const category = (): Pick<Parameters<typeof selectTwelve>[0], "category" | "synonyms" | "measured" | "place" | "recent"> => ({
    ...(measuredUnder === undefined ? {} : { category: measuredUnder }),
    ...(recent.length === 0 ? {} : { recent }),
    synonyms: [...synonyms, ...searched],
    ...(measuredMarket === undefined ? {} : { measured: measuredMarket }),
    // A free pass with a town has no market to say where it measures; the town is no part of what the business sells.
    ...(place === undefined ? {} : { place }),
  });
  // A business that sells several lines has its searches spread across them by weight, chosen from twice as many.
  const offerings = offeringsOf(selecting);
  const spread = (pick: (limit: number) => SelectedSearch[], limit: number = BATTERY.QUESTIONS): SelectedSearch[] =>
    offerings.length < 2 ? pick(limit) : spreadAcrossOfferings(pick(limit * 2), offerings, limit, selecting.language);
  const widen = (floors?: readonly number[], limit?: number): SelectedSearch[] => {
    const rows = sections.marketRows;
    return spread(
      (wanted) =>
        selectWidened({
          profile: selecting,
          suggestions: rows.kind === "unmeasured" ? [] : rows.value,
          pool: poolOf(sections),
          ownRanked,
          ...category(),
          ...(floors === undefined ? {} : { floors }),
          limit: wanted,
        }),
      limit
    );
  };
  // Before a search is worded and asked, those the market holds no judgement for are judged (the twelve and runners-up in one call)
  // and the twelve are chosen again without the off-market ones.
  const judgeThenPhrase = async (): Promise<void> => {
    const marketNow = sections.market;
    if (measuredMarket !== undefined && marketNow !== null && a.siteId !== undefined && bounds.stopNow() === null) {
      if (unjudged(sections.selected, measuredMarket).length > 0) {
        const { judgeSearchesForPass } = await import("../market-conclusion");
        const judged = await judgeSearchesForPass({
          siteId: a.siteId,
          cost,
          market: marketNow,
          searches: unjudged(widen(undefined, BATTERY.QUESTIONS * 2), measuredMarket),
        });
        if (abandoned()) return;
        if (judged !== null) {
          sections.market = judged;
          measuredMarket = measuredMarketOf(judged, place);
          sections.selected = widen();
        }
      }
    }
    if (a.parameters.trackedPrompts || a.asksTrackedPrompts === true) {
      const twelve = new Set(sections.selected.map((search) => search.keyword));
      sections.runnersUp = widen(undefined, TRACKED_PROMPTS.PANEL + SELECTION.maxRivalBrand).map((search) => search.keyword).filter((keyword) => !twelve.has(keyword));
    }
    return phrase(a, abandoned);
  };

  sections.selected = spread((limit) => selectTwelve({ profile: selecting, market: [...bought], ownRanked, ...category(), limit }));
  if (!isShort(sections.selected)) return judgeThenPhrase();

  // Short. Widen in SPEC §6's order, stopping as soon as twelve survive:
  // the ranked rows the pass already buys join the pool (the rivals' are
  // read now rather than in `checking_your_presence`, which then sizes
  // nothing), then further seeds at the first step, then the lower steps.
  if (a.parameters.sizesRivals && bounds.stopNow() === null) await sizeTrackedRivals(a);
  if (abandoned()) return;
  sections.selected = widen([SELECTION.volumeFloorPerMonth]);
  // What the pass would ask if it stopped here. The free path reads every
  // volume step, because that is what it falls back to below.
  const held = (): number =>
    a.parameters.ladderStopsAt === "questions" ? widen().length : sections.selected.length;
  const readEnough = (): boolean =>
    a.parameters.ladderStopsAt === "questions"
      ? held() >= SELECTION.freeLadderMinQuestions
      : !isShort(sections.selected);

  for (const seed of seeds.slice(1 + upfront, 1 + a.parameters.extraSeeds)) {
    if (readEnough() || bounds.stopNow() !== null) break;
    // Widening never spends what the questions already held are asked with.
    if (!affordsSeed({ remainingCents: bounds.remainingCents(), selected: held() })) break;
    const more = await attempt("reading_your_market", () => deriveMarketSet(cost, { seeds: [seed], ownRanked, locale: localeOfPass(a) }));
    if (abandoned()) return;
    if (failed(more)) break;
    sections.marketRows = joinMarketSets(sections.marketRows, more);
    sections.selected = widen([SELECTION.volumeFloorPerMonth]);
  }

  if (isShort(sections.selected)) sections.selected = widen();
  return judgeThenPhrase();
}

/** The searches this site's passes measured in the `SELECTION.freshWeeks` weeks before `at`, from stored reports; none where unreadable. */
async function recentSearches(siteId: string, at: Date): Promise<string[]> {
  try {
    const since = new Date(at.getTime() - SELECTION.freshWeeks * 7 * 86_400_000).toISOString();
    const { data, error } = await untyped(dbAdmin())
      .from<{ questions: unknown }>("scans")
      .select("questions:report->questions")
      .eq("site_id", siteId)
      .gte("created_at", since);
    if (error !== null) return [];
    return (data ?? []).flatMap((row) => {
      const questions = row.questions as { kind?: unknown; value?: unknown } | null;
      if (questions?.kind !== "measured" || !Array.isArray(questions.value)) return [];
      return questions.value.flatMap((question: { search?: { keyword?: unknown } }) =>
        typeof question?.search?.keyword === "string" ? [question.search.keyword] : []
      );
    });
  } catch {
    return [];
  }
}

/** The profile with the customer's own corrections applied; the profile as read where their edits cannot be read. */
async function withFounderEdits(siteId: string, profile: Profile): Promise<Profile> {
  try {
    const [{ readBusinessEdits }, { profileWithEdits }] = await Promise.all([
      import("@/lib/site-profile/business/edits"),
      import("@/lib/business/understanding"),
    ]);
    return profileWithEdits(profile, await readBusinessEdits(siteId));
  } catch {
    return profile;
  }
}

/** §6.7 step 4: the selected searches, worded, as many as the pass can pay to ask. */
async function phrase(a: StageArgs, abandoned: () => boolean): Promise<void> {
  const { bounds, cost, sections } = a;
  if (bounds.stopNow() !== null) return;
  const place = localeOfPass(a).place;
  if (a.parameters.measuresStatedPlace && place !== undefined) sections.selected = inTheTown(sections.selected, place);
  if (a.parameters.questionsFitThePurse) sections.selected = whatThePurseCanAsk(a);
  const questions = await attempt("reading_your_market", () =>
    phraseQuestions(cost, { selected: sections.selected, locale: localeOfPass(a) })
  );
  if (!failed(questions) && !abandoned()) sections.questions = questions;
}

/** The searches a free pass asks for a business with a town, each asked of the town: a "near me" search answers for wherever it is asked from,
 *  so each becomes the service plus the town (`localSearch`). Two that become one are asked once, in selection order, each keeping its listed volume. */
function inTheTown(selected: readonly SelectedSearch[], place: Place): SelectedSearch[] {
  const seen = new Set<string>();
  const out: SelectedSearch[] = [];
  for (const search of selected) {
    const keyword = localSearch(search.keyword, place);
    const key = keyword.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(keyword === search.keyword ? search : { ...search, keyword, rank: out.length + 1 });
  }
  return out.map((search, i) => (search.rank === i + 1 ? search : { ...search, rank: i + 1 }));
}

/** The questions the money left can ask: the market ladder and the twelve share one purse, and fewer questions each with an answer beat a report with gaps.
 *  Runs before phrasing, so no model call words an unasked question. The purse is read as `asking_the_twelve` reads it: its row or what the market left
 *  (`twelveCentsAfter`), whichever is smaller, never more than the pass has. Too few to plan from is `MARKET_QUESTION_FLOOR`'s reading, not a floor here. */
function whatThePurseCanAsk(a: StageArgs): SelectedSearch[] {
  const purse = Math.min(STAGE_BUDGETS.asking_the_twelve.cents, a.bounds.remainingCents());
  const afforded = questionsAffordable(purse);
  const selected = a.sections.selected;
  if (afforded >= selected.length) return selected;
  console.log(
    JSON.stringify({
      event: "questions_afforded",
      selected: selected.length,
      afforded,
      purseCents: Number(purse.toFixed(4)),
    })
  );
  return selected.slice(0, afforded);
}
