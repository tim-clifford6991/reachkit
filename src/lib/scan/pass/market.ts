// src/lib/scan/pass/market.ts — reading the market: the profile, the searches and the twelve chosen.
import { BATTERY, MARKET_REMEASURE_H, PRICE_BOOK, SELECTION } from "@/lib/config/constants";
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
import { unmeasured } from "@/lib/measure/measured";
import { STAGE_BUDGETS, affordsSeed, questionsAffordable } from "../budgets";
import type { Bounds } from "../ceilings";
import { searchFootprintOf, type ThinFootprint } from "../search-footprint";
import type { StoredReport } from "../report";
import { attempt, failed, localeOfPass, ownRankedValue, poolOf, type StageArgs, untyped } from "./sections";
import { holdsTown, inPlace, outOfPlace, townFromPage } from "./place";
import { sizeTrackedRivals } from "./rivals";

/**
 * What the profile call reads (§6.7 step 1): the site's own home and pricing
 * text, or `null` where there is none to read.
 *
 * **A site its bot protection kept the reader off** (SPEC §2, owner
 * 2026-10-10, issue 1387), or whose home page did not answer in time
 * (issue 1449), has no text of its own, and only then is its
 * listing in search read in its place: the ranked rows stage one already
 * bought, with the title and snippet Google shows for each page. A listing
 * too thin to name a market from is not read, and the reason is kept.
 */
function marketReadingOf(
  a: StageArgs,
  measurement: DomainMeasurement
): { home: string; pricing?: string } | { search: string } | null {
  if (measurement.text.home !== null) {
    return {
      home: measurement.text.home,
      ...(measurement.text.pricing === null ? {} : { pricing: measurement.text.pricing }),
    };
  }
  // Issue 1449: and so is one whose home page did not answer in time.
  if (measurement.protection === undefined && measurement.homeTimedOut !== true) return null;
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

/** Issue 1450: whether the stage still has the time for a second profile
 *  call — at least half its own seconds left. A first call that failed
 *  fast (a refused request) leaves it; one that ran out its budget does
 *  not, so the free pass's inference arithmetic is not stretched. */
function roomForAnotherProfile(bounds: Bounds): boolean {
  return bounds.stopNow() === null && bounds.remainingMs() >= (STAGE_BUDGETS.reading_your_market.seconds * 1000) / 2;
}

/** Counts only: never a search, a title or a snippet. */
function logMarketFromSearch(fields: { read: boolean; because?: ThinFootprint; searches?: number; descriptive?: number; pages?: number }): void {
  console.log(JSON.stringify({ event: "market_from_search", ...fields }));
}

/**
 * Whether a stored report is one this build would measure further (issue
 * 1387): bot protection kept the reader off the site, and the pass that
 * stored it never tried to read a market from search; or (issue 1450) the
 * site ranks, its market was not read, and that pass is a day old. Such a
 * report is not served inside the re-scan window. One whose listing was read and found too thin
 * carries that reason, and is served as any other.
 */
export function awaitsMarketFromSearch(report: StoredReport, now: Date): boolean {
  if (report.market.kind !== "unmeasured" || report.market.because !== undefined) return false;
  if (report.onPage.kind === "unmeasured" && report.onPage.because === BOT_PROTECTION) return true;
  // Issue 1450: a site that ranks, whose market a vendor or the model did
  // not answer for. This build reads one from its ranked rows instead —
  // but a pass that failed so is measured again at most once a day, so a
  // site that keeps failing costs at most one extra free pass a day.
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
  // Issue 1450: the site's pages were read and the model gave no profile of
  // them (trello.com's call came back `http_400`). A site that ranks has a
  // listing in search, and that is read in their place, as for a site its
  // bot protection kept the reader off — but only where the pass still has
  // the time for this call and the phrasing after it.
  if ((failed(profile) || profile.kind === "unmeasured") && "home" in reading && roomForAnotherProfile(bounds)) {
    const listing = listingReadingOf(a, measurement);
    if (listing !== null) {
      reading = listing;
      profile = await attempt("reading_your_market", () => deriveProfile(cost, { locale: localeOfPass(a), ...listing }));
      if (abandoned()) return;
    }
  }
  if (failed(profile)) return;
  if ("search" in reading) {
    // The model was told to name no category the listing does not support
    // (issue 1387). Where it named none, there is no market, and none is
    // guessed: the pass goes on as it did before the listing was read.
    if (profile.kind !== "unmeasured" && profile.value.category === "") {
      sections.marketThin = "market_not_named";
      logMarketFromSearch({ read: false, because: "market_not_named" });
      return;
    }
    if (profile.kind !== "unmeasured") sections.marketFrom = "search";
  }
  sections.profile = profile;
  if (profile.kind === "unmeasured") return;
  // Issue 1454: on a paying site the customer's corrections to who buys
  // and what the business does are what its searches are chosen by. The
  // report keeps the profile as read.
  const selecting = a.siteId !== undefined && a.concludesMarket === true ? await withFounderEdits(a.siteId, profile.value) : profile.value;
  if (abandoned()) return;
  // Issues 1454 and 1480: a town is the market of a business that sells
  // there, by the rule a paid pass holds its place to. One the profile
  // reads as selling across its country or beyond, or as software, is
  // measured there, whatever address its home page states (hubspot.com
  // states Cambridge, MA, and was asked one search of it). Nothing has been
  // bought in the town yet: the place is first read by the seeds below.
  const placedIn = sections.measurement?.locale.place;
  if (a.concludesMarket !== true && sections.placeFrom !== null && placedIn !== undefined && !holdsTown(placedIn, selecting, measurement, a.domain)) {
    outOfPlace(sections);
  }

  // SPEC §6 (owner D28, #1185): the market is ReachKit's to keep current.
  // Re-checked here, before anything is bought for it, so this pass seeds
  // and measures the market that stands after the check.
  let measuredUnder = a.category;
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
        at: a.startedAt,
        ...(measurement.stated === undefined ? {} : { stated: measurement.stated }),
      });
      if (abandoned()) return;
      if (concluded !== null) {
        // D67 (issue 1318): from here the pass measures where the business
        // serves — the place this conclusion settled, or none.
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

  // Issue 1441, rule 4: where the structured data named no town, the town
  // the profile call read off the page's own words, once the vendor's list
  // holds it.
  if (a.parameters.measuresStatedPlace && a.concludesMarket !== true && sections.measurement !== null && localeOfPass(a).place === undefined) {
    const fromPage = await townFromPage(selecting.town, sections.measurement);
    if (abandoned()) return;
    if (fromPage !== null && holdsTown(fromPage.place, selecting, measurement, a.domain)) inPlace(sections, fromPage);
  }

  // SPEC §6 thin markets (#778): the first seed is the one every pass buys.
  // The rest of the ladder is bought one seed at a time, only while short —
  // except the market's other names, which are bought with the first inside
  // the same three extra purchases (#1159): its searched terms where it
  // holds any (D65, issue 1303), else a concluded market's synonyms.
  const place = localeOfPass(a).place;
  const searched = marketSeeds(sections.market, place);
  // D67: a local business's market is bought for its place, so every seed
  // is the service plus the place.
  const ladder = seedLadder(selecting, measuredUnder, synonyms, searched);
  const seeds = place === undefined ? ladder : [...new Set(ladder.map((seed) => localSearch(seed, place)))];
  // Issue 1454: the other lines the business sells are bought with the
  // first while the purse holds each of them and the questions after.
  const lines = offeringSeeds(selecting).filter((_, i) =>
    affordsSeed({ remainingCents: bounds.remainingCents() - (i + 1) * PRICE_BOOK.SUGGESTIONS_COST_C, selected: BATTERY.QUESTIONS })
  );
  const withFirst = (searched.length > 0 ? searched : [...lines, ...synonyms]).map((seed) => (place === undefined ? seed : localSearch(seed, place)));
  const boughtWithFirst = (seed: string): boolean => withFirst.some((x) => x.trim().toLowerCase() === seed.toLowerCase());
  const leading = seeds.slice(1).findIndex((seed) => !boughtWithFirst(seed));
  const upfront = Math.min(leading === -1 ? seeds.length - 1 : leading, a.parameters.extraSeeds);
  // The site's own footprint, the same number derivation bands by, read
  // before any market is bought: every suggestions purchase asks only for
  // rows inside its window (issue 846), and selection never takes a search
  // outsized for it (SPEC §6 right-sizing, issue 830).
  const ownRanked = ownRankedValue(measurement.ownRanked);
  if (bounds.stopNow() !== null) return;
  const market = await attempt("reading_your_market", () =>
    deriveMarketSet(cost, { seeds: seeds.slice(0, 1 + upfront), ownRanked, locale: localeOfPass(a) })
  );
  if (abandoned()) return;
  // Issue 1450: suggestions that did not come back (hiverhq.com's timed
  // out) are not the end of the market. The site's own ranked rows, and
  // any rival's the pass reads below, are the pool selection already
  // widens into, and the ladder's further seeds are still bought while the
  // pass is short. Where none of them answered either, the questions are
  // chosen from the pool alone and the record keeps that the suggestions
  // were not read.
  const suggestionsRead = !failed(market) && market.kind !== "unmeasured";
  sections.marketRows = failed(market) ? unmeasured("undeterminable", a.startedAt) : market;
  if (!suggestionsRead && poolOf(sections).length === 0) return;
  const bought: readonly SuggestionRow[] = suggestionsRead ? market.value : [];

  // The market's other names are its words too (#1195): a search in them is
  // about this market, not off it. And the market in force says which of
  // its own searches are measured and which searches never are (D65).
  let measuredMarket = measuredMarketOf(sections.market, place);
  // Issue 1549: what this site's passes measured in the last weeks, so the
  // week's twelve read something new. A correction re-reads its own week.
  const recent = a.siteId === undefined || a.tier !== "weekly" || a.correction ? [] : await recentSearches(a.siteId, a.startedAt);
  const category = (): Pick<Parameters<typeof selectTwelve>[0], "category" | "synonyms" | "measured" | "place" | "recent"> => ({
    ...(measuredUnder === undefined ? {} : { category: measuredUnder }),
    ...(recent.length === 0 ? {} : { recent }),
    synonyms: [...synonyms, ...searched],
    ...(measuredMarket === undefined ? {} : { measured: measuredMarket }),
    // Issue 1441: a free pass with a town has no market to say where it
    // measures; the town is no part of what the business sells.
    ...(place === undefined ? {} : { place }),
  });
  // Issue 1454: a business that sells several lines has its searches
  // spread across them by their weight, chosen from twice as many.
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
  // D65: before a search is worded and asked, the ones the market holds no
  // judgement for are judged — the twelve and their runners-up in one call —
  // and the twelve are chosen again without the ones that are off it.
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
    // Widening never spends what the questions already held are asked
    // with (issues 835 and 1235).
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

/** Issue 1549: the searches this site's passes measured in the
 *  `SELECTION.freshWeeks` weeks before `at`, from their stored reports.
 *  None where they cannot be read: the twelve are then chosen as before. */
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

/** The profile with the customer's own corrections applied (issue 1454);
 *  the profile as read where their edits cannot be read. */
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

/** §6.7 step 4: the selected searches, worded — as many of them as the
 *  pass can pay to ask (issue 873). */
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

/**
 * The searches a free pass asks for a business with a town, each asked of
 * the town (owner ruling 2026-10-15, issue 1441): a "near me" search is
 * answered for wherever it is asked from, and one that names no place for
 * the whole country, so each becomes the service plus the town
 * (`localSearch`). Two that become one search are asked once, in the
 * selection's order; each keeps the volume the vendor listed it at.
 */
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

/**
 * **The questions the money left can actually ask** (issue 873).
 *
 * The free path's market ladder and its twelve spend one purse (issue 835),
 * so a pass that widened its market twice has less left for the SERPs. It
 * still selected twelve, phrased twelve and showed twelve — and the ones at
 * the end of the list were dropped unasked, which is a free report with
 * gaps in it where a visitor is deciding whether this product measures
 * anything. Fewer questions, each with an answer, is the trade this makes.
 *
 * It runs before the phrasing, so no model call words a question nobody
 * will see. The purse is read the same way `asking_the_twelve` will read
 * it — its own row, or whatever the market left of the shared purse
 * (`twelveCentsAfter`), whichever is smaller, and never more than the pass
 * itself has left.
 *
 * Nothing here is a floor of its own: too few questions to plan a page from
 * is `MARKET_QUESTION_FLOOR`'s reading (`market-floor.ts`), reached through
 * the same `zero` arm a market that was simply too small reaches.
 */
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
