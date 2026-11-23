// SPEC §7 *Pace: new pages and refreshes*: which of ReachKit's own live pages are due a refresh, each cause read from
// what is stored. A page is ReachKit's own where a publication's row planned a new page; its refresh is a
// `refresh_page` at the same address for the same search, carrying that row's volume, band, fit and acceptance test,
// and is a new version that sets the page's updated date. Causes:
//   aged           the current version went live `PACE.REFRESH_AGE_DAYS` ago or more;
//   lost_position  the newest Monday verdict recorded a decline;
//   newer_fact     a business page a fact was read from no longer says it, or a later draft recorded a claim from a
//                  page this one cites that this one does not carry;
//   link           a newer live page is near and not linked, or a page this one links has moved: the one or two
//                  nearest older pages add one sentence linking it;
//   own_figures    a page that is not research states a measurement read off the site's own report;
//   structure      a page breaks one of the six rules a new page is held to; written from the live text with what
//                  code can repair repaired (`repairStructure`), never edited in place (ADR-080);
//   unseen         a hosted page with no Found step `UNSEEN_AFTER_DAYS` after going live gets one link in from its
//                  cluster's best-read page, at most one each `UNSEEN_LINK_EVERY_DAYS`, and D13's check again;
//   close          its own address ranks 4–30 for its search and `GAP_REFRESH.stalledReadings` readings hold no gain;
//                  it may add up to three sections the top results cover (`headingGaps`);
//   stale_prices   a listicle or comparison states a rival price read more than 30 days ago;
//   not_indexed    Google's coverage line kept it out of the index for `NOT_INDEXED_WEEKS` weekly readings in a row;
//   snippet        a hosted page Google showed `SNIPPET_REFRESH_IMPRESSIONS` times in 28 days with no click and no
//                  counted visit: its title and description are rewritten, nothing else.
// §6's floor (`REFRESH_MIN_AGE_DAYS`) stands for every cause. A page the customer edited, stopped a refresh of, or took
// down is theirs: no cause plans it. A climbing page is left alone by every cause its results drive; one still not
// moving 8 weeks after its refresh has its question retired. A page never seen in a stored SERP or ranked row is not
// retargeted for `unmet`. Nothing is bought and no model is asked; the partial unique index keeps one open or queued
// refresh a page.
import {
  CLOSE_PAGE_POSITION_BAND,
  CROSS_LINKS,
  EFFORT_BY_TYPE,
  GAP_REFRESH,
  INTENT_UNMET_WEEKS,
  NOT_INDEXED_WEEKS,
  PACE,
  REFRESH_MIN_AGE_DAYS,
  RIVAL_PRICE_MAX_AGE_D,
  SEARCH_READING_WINDOW_D,
  SNIPPET_REFRESH_IMPRESSIONS,
  UNSEEN_AFTER_DAYS,
  UNSEEN_LINK_EVERY_DAYS,
} from "@/lib/config/constants";
import { linkWords, sameWord } from "@/lib/generate/links/text";
import { withheldReportPassages } from "@/lib/generate/pipeline/report-scope";
import { withheldMeasurements } from "@/lib/generate/rules/brief";
import { ownMeasurementIn } from "@/lib/generate/rules/figures";
import { storedStructure, structureDefects, type StructureDefect } from "@/lib/generate/rules/structure";
import { takenDownByCustomer } from "@/lib/publish/take-down/standing";
import { measured } from "@/lib/measure/measured";
import { canonicalUrl, googleRead, readingOf, type PageReading } from "@/lib/measure/page-reading";
import type { Candidate } from "./derive/candidate";
import { persist } from "./derive/persist";
import { closestPrompt, measuredVolume } from "./intent";
import { assessReadiness } from "./readiness";
import { retargetCandidate } from "./retarget";
import { climbing } from "./verdicts/verdict";
import { COLUMNS, opportunityStore, readOpportunity, untyped, type OpportunityRow } from "./store";
import { FAMILY_OF, isOwnRefresh, isRetarget, type Evidence, type Opportunity, type RefreshCause } from "./types";

const DAY_MS = 86_400_000;

/** A fact a page recorded: the words, and the page they were read from. */
export interface RecordedPassage {
  url: string;
  passage: string;
}

/** One live page ReachKit wrote, as its current version stands. */
export interface OwnLivePage {
  /** The address a refresh is published to. */
  url: string;
  /** When the current version went live. */
  publishedAt: Date;
  /** The row the page was written for. */
  row: Opportunity;
  /** The newest Monday verdict on this version found it in a worse place. */
  declined: boolean;
  /** SPEC §6 (D60): this version has had `INTENT_UNMET_WEEKS` weekly verdicts and none found it working, neither in
   *  the top 20 for its search nor cited for its prompt. Absent reads as not so. */
  unmet?: boolean;
  facts: readonly RecordedPassage[];
  marketFacts: readonly RecordedPassage[];
  /** What a link back is chosen from: the title, the live body, whether the customer edited this version, and whether
   *  they stopped a refresh of this page. Absent reads as an untitled, empty, untouched page. */
  title?: string;
  markdown?: string;
  edited?: boolean;
  stopped?: boolean;
  /** This version is not a research page and states one of the site's own measurements its pack held. */
  ownFigures?: boolean;
  /** What this version breaks of the consistency rules, where the customer did not edit it. */
  structure?: readonly StructureDefect[];
  /** The customer took this page down and put it back. */
  takenDown?: boolean;
  /** Whether any stored SERP or ranked row held this page: `false` is `not_verified`; absent is not known, and plans nothing. */
  seen?: boolean;
  /** Whether its stored search reading reached Found. `false` only where Found is measured (a hosted page with a
   *  reading); absent is not measured, and plans nothing. */
  found?: boolean;
  /** A `link` refresh into this page was planned within `UNSEEN_LINK_EVERY_DAYS`. */
  linkedLately?: boolean;
  /** D13's check, run again on the live text, found a page written for another site as close as the near-duplicate
   *  bar. Read only for a page `unseenDue`. */
  closeElsewhere?: boolean;
  /** The place the page's stored search reading holds for it, where one was read. */
  readPlace?: number;
  /** On a listicle or comparison, when the oldest rival price this version was written from was read. */
  oldestPrice?: Date;
  /** The places this version's weekly verdicts measured, oldest first. Absent reads as none. */
  readings?: readonly number[];
  /** The first and best place its stored search reading holds, and the weeks Google kept it out of the index. */
  reading?: Pick<PageReading, "first" | "best"> & Partial<Pick<PageReading, "place" | "unindexedWeeks">>;
  /** A version of this page was already refreshed for not moving. */
  flatRefreshed?: boolean;
  /** On a hosted page, its current publication and Search Console's 28 days; `searchVisits` are its counted Google
   *  visits over the same days, absent where unread. */
  publicationId?: string;
  shown?: { impressions: number; clicks: number };
  searchVisits?: number;
  /** When this version itself went live, whatever date it carries. */
  liveSince?: Date;
}

export interface RefreshPools {
  /** The site's own pages as they were last read, newest reading last. */
  siteText: readonly { url: string; text: string; measuredAt: Date }[];
  /** Every market claim the site's drafts recorded. */
  market: readonly (RecordedPassage & { readAt: Date })[];
  /** The searches the current report measured, which an unmet page with no measured search is retargeted among (D60). */
  searches?: readonly { keyword: string; volume: number }[];
  /** The site's own ranked rows the current report holds; absent reads as none. */
  ranked?: readonly { keyword: string; url: string; position: number }[];
}

export interface RefreshInputs {
  pages: readonly OwnLivePage[];
  pools: RefreshPools;
}

function squashed(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Whether either pool holds a fact newer than this version of the page. */
function hasNewerFact(page: OwnLivePage, pools: RefreshPools): boolean {
  const since = page.publishedAt.getTime();
  const latest = new Map<string, { text: string; measuredAt: Date }>();
  for (const reading of pools.siteText) latest.set(reading.url, reading);
  const replaced = page.facts.some((fact) => {
    const reading = latest.get(fact.url);
    return (
      reading !== undefined &&
      reading.measuredAt.getTime() > since &&
      !squashed(reading.text).includes(squashed(fact.passage))
    );
  });
  if (replaced) return true;
  const cited = new Set(page.marketFacts.map((fact) => fact.url));
  const carried = new Set(page.marketFacts.map((fact) => squashed(fact.passage)));
  return pools.market.some(
    (fact) => fact.readAt.getTime() > since && cited.has(fact.url) && !carried.has(squashed(fact.passage))
  );
}

/** The best place the page's own address holds for its search in the stored ranked rows, or `null`. */
export function ownPlace(page: Pick<OwnLivePage, "url" | "row">, pools: Pick<RefreshPools, "ranked">): number | null {
  const search = squashed(page.row.targetQuery ?? "");
  if (search === "") return null;
  const address = canonicalUrl(page.url);
  const places = (pools.ranked ?? [])
    .filter((row) => squashed(row.keyword) === search && canonicalUrl(row.url) === address)
    .map((row) => row.position);
  return places.length === 0 ? null : Math.min(...places);
}

/** The page ranks 4–30 for its own search and has stopped gaining. */
function isClose(page: OwnLivePage, pools: RefreshPools): boolean {
  const place = ownPlace(page, pools);
  return place !== null && place >= CLOSE_PAGE_POSITION_BAND.min && place <= GAP_REFRESH.maxPlace && stalled(page.readings ?? []);
}

/** The last `GAP_REFRESH.stalledReadings` readings hold no place better than the first of them. */
export function stalled(readings: readonly number[]): boolean {
  const last = readings.slice(-GAP_REFRESH.stalledReadings);
  return last.length === GAP_REFRESH.stalledReadings && Math.min(...last.slice(1)) >= last[0]!;
}

/** Its results plan no refresh: it is climbing, or still not moving after its one refresh for that. */
function leftAlone(page: OwnLivePage, at: Date): boolean {
  return (page.reading !== undefined && climbing(page.reading, at)) || (page.flatRefreshed === true && page.unmet === true);
}

/** A refresh planned because the page was not moving. */
function isFlatRefresh(o: Pick<Opportunity, "evidence">): boolean {
  return o.evidence?.family === "improve" && o.evidence.shortfall?.kind === "due" && o.evidence.shortfall.cause === "unmet";
}

/** A rival price the page was written from is older than D59 lets a pack hold one. */
function pricesStale(page: Pick<OwnLivePage, "oldestPrice">, at: Date): boolean {
  return page.oldestPrice !== undefined && at.getTime() - page.oldestPrice.getTime() > RIVAL_PRICE_MAX_AGE_D * DAY_MS;
}

const shownUnclicked = (page: OwnLivePage): boolean =>
  page.publicationId !== undefined && (page.shown?.impressions ?? 0) >= SNIPPET_REFRESH_IMPRESSIONS && page.shown?.clicks === 0;

/** Google shows it and nobody comes: read only where both counts were read, and never on a page the customer owns. */
function snippetDue(page: OwnLivePage, at: Date): boolean {
  // A snippet version keeps its date, so the 28 days judged must all be this version's own title.
  const ownWindow = page.liveSince !== undefined && at.getTime() - page.liveSince.getTime() >= SEARCH_READING_WINDOW_D * DAY_MS;
  return ownWindow && shownUnclicked(page) && page.searchVisits === 0 && page.edited !== true && page.stopped !== true;
}

/** Why this page is due at `at`, or `null` where it is not. */
export function refreshCauseOf(page: OwnLivePage, pools: RefreshPools, at: Date): RefreshCause | null {
  const age = at.getTime() - page.publishedAt.getTime();
  if (age < REFRESH_MIN_AGE_DAYS * DAY_MS) return null;
  if (page.ownFigures === true) return "own_figures";
  if (unseenDue(page, at) && page.closeElsewhere === true) return "unseen";
  if ((page.reading?.unindexedWeeks ?? 0) >= NOT_INDEXED_WEEKS) return "not_indexed";
  const held = leftAlone(page, at);
  if (!held && page.unmet === true && page.seen !== false) return "unmet";
  if (!held && page.declined) return "lost_position";
  if (!held && isClose(page, pools)) return "close";
  if (!held && snippetDue(page, at)) return "snippet";
  if (hasNewerFact(page, pools)) return "newer_fact";
  if (pricesStale(page, at)) return "stale_prices";
  if (age >= PACE.REFRESH_AGE_DAYS * DAY_MS) return "aged";
  // Any refresh starts from the repaired text, so this cause is named only where no other is due.
  return (page.structure ?? []).length > 0 && page.edited !== true ? "structure" : null;
}

/** A live page of ours whose reading holds no Found step `UNSEEN_AFTER_DAYS` after its version went live. */
export function unseenDue(page: OwnLivePage, at: Date): boolean {
  return (
    page.found === false &&
    page.takenDown !== true &&
    page.row.targetQuery !== null &&
    at.getTime() - page.publishedAt.getTime() >= UNSEEN_AFTER_DAYS * DAY_MS
  );
}

/** For each page `unseenDue`, a `link` refresh of its cluster's best-placed found sibling the customer left alone,
 *  past the floor; none where a sibling links it, one was planned lately, or no sibling qualifies. One row a sibling. Pure. */
export function unseenLinkCandidates(pages: readonly OwnLivePage[], at: Date): Candidate[] {
  const planned = new Map<string, Candidate>();
  for (const page of pages) {
    if (!unseenDue(page, at) || page.linkedLately === true) continue;
    const cluster = page.row.clusterKey ?? null;
    if (cluster === null) continue;
    const siblings = pages.filter(
      (other) =>
        other.row.clusterKey === cluster &&
        other.takenDown !== true &&
        addressKey(other.url) !== addressKey(page.url)
    );
    if (siblings.some((other) => (other.markdown ?? "").toLowerCase().includes(addressKey(page.url)))) continue;
    const strongest = siblings
      .filter(
        (other) =>
          other.row.targetQuery !== null &&
          other.found !== false &&
          other.edited !== true &&
          other.stopped !== true &&
          at.getTime() - other.publishedAt.getTime() >= REFRESH_MIN_AGE_DAYS * DAY_MS
      )
      .sort(
        (x, y) =>
          (x.readPlace ?? Number.POSITIVE_INFINITY) - (y.readPlace ?? Number.POSITIVE_INFINITY) ||
          x.publishedAt.getTime() - y.publishedAt.getTime()
      )[0];
    if (strongest === undefined || planned.has(addressKey(strongest.url))) continue;
    const title = (page.title ?? "").trim() || (page.row.targetQuery ?? "");
    planned.set(addressKey(strongest.url), refreshOfPage(strongest, "link", at, { url: page.url, title }));
  }
  return [...planned.values()];
}

/** The address as two addresses are compared: host without `www.`, no trailing slash, case folded. */
export function addressKey(url: string): string {
  return url.trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/[#?].*$/, "").replace(/\/+$/, "");
}

/** The older live pages that gain a link to the page at `freshUrl`, nearest first, at most `CROSS_LINKS.BACK_PAGES_MAX`.
 *  Nearest weighs each shared title or search word by how few pages carry it, so the common subject counts most and
 *  "best" little; the same cluster comes first, and no shared word of four letters is not near. Pure. */
export function linkBackCandidates(pages: readonly OwnLivePage[], freshUrl: string, at: Date): Candidate[] {
  return linkBacksAmong(pages, freshUrl, at).filter((candidate) => !takenDownAt(pages, candidate.targetRef));
}

/** Whether the page at `url` is one its customer took down. */
function takenDownAt(pages: readonly OwnLivePage[], url: string | null): boolean {
  return url !== null && pages.some((page) => page.takenDown === true && addressKey(page.url) === addressKey(url));
}

function linkBacksAmong(pages: readonly OwnLivePage[], freshUrl: string, at: Date): Candidate[] {
  const fresh = pages.find((page) => addressKey(page.url) === addressKey(freshUrl));
  // A page going live for the first time: a refresh of an old page is not news its neighbours owe a link to.
  if (fresh === undefined || (fresh.row.family !== "write" && fresh.row.family !== "earn")) return [];
  const freshTitle = (fresh.title ?? "").trim() || (fresh.row.targetQuery ?? "");
  if (freshTitle === "") return [];
  const wordsOf = (page: OwnLivePage): string[] => [...new Set(linkWords(`${page.title ?? ""} ${page.row.targetQuery ?? ""}`))];
  const held = new Map(pages.map((page) => [page, wordsOf(page)]));
  const carriers = (word: string): number =>
    pages.filter((page) => (held.get(page) ?? []).some((other) => sameWord(other, word))).length;
  const wanted = wordsOf(fresh)
    .filter((word) => word.length >= 4)
    .map((word) => ({ word, weight: Math.log((pages.length + 1) / Math.max(1, carriers(word))) }));
  const near = (page: OwnLivePage): number => {
    const shared = wanted.filter((want) => (held.get(page) ?? []).some((word) => sameWord(word, want.word)));
    if (shared.length === 0) return 0;
    const cluster = fresh.row.clusterKey !== null && fresh.row.clusterKey !== undefined && fresh.row.clusterKey === page.row.clusterKey;
    return shared.reduce((sum, want) => sum + want.weight, 0) + (cluster ? 1_000 : 0);
  };

  return pages
    .filter(
      (page) =>
        page !== fresh &&
        page.row.targetQuery !== null &&
        page.publishedAt.getTime() < fresh.publishedAt.getTime() &&
        at.getTime() - page.publishedAt.getTime() >= REFRESH_MIN_AGE_DAYS * DAY_MS &&
        page.edited !== true &&
        page.stopped !== true &&
        !(page.markdown ?? "").toLowerCase().includes(addressKey(fresh.url))
    )
    .map((page) => ({ page, score: near(page) }))
    .filter((each) => each.score > 0)
    .sort((x, y) => y.score - x.score || y.page.publishedAt.getTime() - x.page.publishedAt.getTime())
    .slice(0, CROSS_LINKS.BACK_PAGES_MAX)
    .map(({ page }) => refreshOfPage(page, "link", at, { url: fresh.url, title: freshTitle }));
}

/** The refresh of one page, for one cause; a live page the topic recheck keeps is refreshed this way too. */
export function refreshOfPage(
  page: Pick<OwnLivePage, "url" | "publishedAt" | "row"> & Partial<Pick<OwnLivePage, "structure" | "shown">>,
  cause: RefreshCause,
  at: Date,
  link?: { url: string; title: string; replaces?: string },
  place: number | null = null
): Candidate {
  const { row } = page;
  const query = row.targetQuery ?? "";
  const evidence: Evidence = {
    family: "improve",
    query,
    volume: row.volume ?? measured(0, at),
    pageUrl: page.url,
    shortfall: {
      kind: "due",
      cause,
      since: measured(page.publishedAt, at),
      ...(link === undefined ? {} : { link }),
      ...(cause === "structure" ? { defects: [...(page.structure ?? [])] } : {}),
      ...(place === null ? {} : { place }),
      ...(cause === "snippet" && page.shown !== undefined ? { shown: page.shown.impressions } : {}),
    },
    ...("target" in row.evidence && row.evidence.target !== undefined ? { target: row.evidence.target } : {}),
  };
  return {
    siteId: row.siteId,
    scanId: row.scanId,
    type: "refresh_page",
    family: FAMILY_OF.refresh_page,
    targetQuery: query,
    targetRef: page.url,
    // The page exists and has its own title.
    title: null,
    volume: row.volume,
    evidence,
    acceptance: row.acceptance,
    fitBand: row.fitBand,
    businessFit: row.businessFit ?? null,
    source: row.source ?? null,
    effort: EFFORT_BY_TYPE.refresh_page,
  };
}

/** The refresh of each page that is due. Pure. */
export function refreshCandidates(pages: readonly OwnLivePage[], pools: RefreshPools, at: Date): Candidate[] {
  return pages.flatMap((page): Candidate[] => {
    const { row } = page;
    if (page.takenDown === true) return [];
    const cause = refreshCauseOf(page, pools, at);
    if (cause === null || row.targetQuery === null) return [];
    // D60: an unmet page whose search has no measured volume is rewritten for the closest measured one, if any.
    if (cause === "unmet" && measuredVolume(row.volume) === null) {
      const taken = new Set(pages.map((other) => squashed(other.row.targetQuery ?? "")));
      const open = (pools.searches ?? [])
        .filter((search) => search.volume > 0 && !taken.has(squashed(search.keyword)))
        .map((search) => ({ id: search.keyword, text: search.keyword, volume: search.volume }));
      const target = closestPrompt(row.targetQuery, open);
      if (target !== null) return [retargetCandidate(page, { target: target.text, volume: target.volume, at })];
    }
    return [refreshOfPage(page, cause, at, undefined, page.readPlace ?? ownPlace(page, pools))];
  });
}

// ── Reading what is stored ──────────────────────────────────────────────

interface PublicationRow {
  id: string;
  live_url: string | null;
  published_at: string | null;
  destination?: string;
  search_reading?: unknown;
  drafts: {
    title?: string | null;
    body_md?: string | null;
    meta: Record<string, unknown> | null;
    transitions?: unknown;
    opportunities: OpportunityRow | null;
  } | null;
}

function passagesOf(value: unknown): (RecordedPassage & { readAt: Date | null })[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const { url, passage, readAt } = (item ?? {}) as { url?: unknown; passage?: unknown; readAt?: unknown };
    if (typeof url !== "string" || typeof passage !== "string") return [];
    const read = typeof readAt === "string" ? new Date(readAt) : null;
    return [{ url, passage, readAt: read === null || Number.isNaN(read.getTime()) ? null : read }];
  });
}

/** Whether a version that is not a research page states a measurement of a report sentence its pack held. */
export function statesOwnFigures(meta: unknown, markdown: string): boolean {
  const own = withheldMeasurements({ facts: [], queries: [], reportPassages: withheldReportPassages(meta) });
  return ownMeasurementIn(markdown.replace(/\s+/g, " "), own) !== null;
}

/** The site's live pages that ReachKit wrote, each at its current version. */
export async function ownLivePages(siteId: string): Promise<OwnLivePage[]> {
  const client = untyped();
  const live = await client
    .from<PublicationRow>("publications")
    .select(`id, live_url, published_at, destination, search_reading, drafts(title, body_md, meta, transitions, opportunities(${COLUMNS}))`)
    .eq("site_id", siteId)
    .not("published_at", "is", null)
    .not("live_url", "is", null)
    .is("unpublished_at", null)
    .order("published_at", { ascending: true });
  if (live.error) throw new Error(`refresh: reading publications for ${siteId}: ${live.error.message}`);

  const verdicts = await client
    .from<{ publication_id: string; verdict: string; movement: { declined?: unknown } | null; measured: { kind?: unknown; value?: unknown } | null }>("page_verdicts")
    .select("publication_id, verdict, movement, measured")
    .eq("site_id", siteId)
    .order("week_start", { ascending: true });
  if (verdicts.error) throw new Error(`refresh: reading verdicts for ${siteId}: ${verdicts.error.message}`);
  // Oldest first, so the newest row of a publication is the one kept.
  const declined = new Map<string, boolean>();
  // D60: each version's judged weeks, and whether any found it working.
  const judged = new Map<string, { weeks: number; worked: boolean }>();
  const readings = new Map<string, number[]>();
  for (const row of verdicts.data ?? []) {
    declined.set(row.publication_id, row.movement?.declined === true);
    if (row.verdict === "not_judgeable") continue;
    if (row.measured?.kind === "measured" && typeof row.measured.value === "number") {
      readings.set(row.publication_id, [...(readings.get(row.publication_id) ?? []), row.measured.value]);
    }
    const held = judged.get(row.publication_id) ?? { weeks: 0, worked: false };
    judged.set(row.publication_id, { weeks: held.weeks + 1, worked: held.worked || row.verdict === "working" });
  }

  // The address each page answers at now (SPEC §7, 2026-09-18; issue 1182).
  const { storedAddressesNow } = await import("@/lib/publish/destinations/hosted/store");
  const now = await storedAddressesNow(siteId);
  // Every address a stored SERP or ranked row held; rows that could not be read state no index state and plan nothing.
  const { verdictStore } = await import("./verdicts/store");
  const { indexStateOf } = await import("./verdicts/seen");
  const store = verdictStore();
  const seenUrls = await store.seenUrls(siteId).catch(() => null);
  const pages = new Map<string, OwnLivePage>();
  const ours = new Set<string>();
  // What the page at an address was first written as; a refresh's own version records `update`.
  const writtenAs = new Map<string, string>();
  const flat = new Set<string>();
  for (const publication of live.data ?? []) {
    const opportunity = publication.drafts?.opportunities ?? null;
    if (publication.live_url === null || publication.published_at === null || opportunity === null) continue;
    if (typeof opportunity.family !== "string" || typeof opportunity.id !== "string") continue;
    const url = now(publication.live_url);
    // A retarget of one of ours moved it to an address of its own: the page there is still ours.
    if (opportunity.family === "write" || opportunity.family === "earn" || isRetarget(readOpportunity(opportunity))) ours.add(url);
    // A fix of a page's metadata is not a version of its content.
    if (opportunity.family === "fix") continue;
    const meta = publication.drafts?.meta ?? {};
    const type = typeof meta.contentType === "string" && meta.contentType !== "update" ? meta.contentType : (writtenAs.get(url) ?? null);
    if (type !== null) writtenAs.set(url, type);
    const oldestPrice = type === "listicle" ? oldestPriceOf(meta.marketFacts) : undefined;
    const reading = readingOf(publication.search_reading);
    const readPlace = reading?.place?.value;
    const found = foundIn(publication.search_reading, publication.destination);
    const shown = publication.destination === "hosted" ? googleRead(reading?.google) : null;
    if (isFlatRefresh(readOpportunity(opportunity))) flat.add(url);
    // A mended version is dated as the one it mended, so a repair in code does not make a page look newer than its words.
    const dated = typeof meta.datedAs === "string" ? new Date(meta.datedAs) : null;
    pages.set(url, {
      url,
      publishedAt: dated !== null && !Number.isNaN(dated.getTime()) ? dated : new Date(publication.published_at),
      liveSince: new Date(publication.published_at),
      row: readOpportunity(opportunity),
      declined: declined.get(publication.id) ?? false,
      unmet: unmetAfter(judged.get(publication.id)),
      facts: passagesOf(meta.facts),
      marketFacts: passagesOf(meta.marketFacts),
      title: (publication.drafts?.title ?? "").trim(),
      markdown: publication.drafts?.body_md ?? "",
      // `generate/edit.ts` stamps the first save a customer makes.
      edited: typeof meta.first_edited_at === "string",
      ownFigures: statesOwnFigures(meta, publication.drafts?.body_md ?? ""),
      takenDown: takenDownByCustomer(publication.drafts?.transitions),
      ...((state) => (state === null ? {} : { seen: state === "seen" }))(seenUrls === null ? null : indexStateOf([url, publication.live_url], seenUrls)),
      ...(found === undefined ? {} : { found }),
      ...(readPlace === undefined ? {} : { readPlace }),
      readings: readings.get(publication.id) ?? [],
      ...(reading === null ? {} : { reading }),
      flatRefreshed: flat.has(url),
      ...(shown === null ? {} : { publicationId: publication.id, shown: { impressions: shown.impressions, clicks: shown.clicks } }),
      structure: structureDefects(
        storedStructure({
          markdown: publication.drafts?.body_md ?? "",
          title: publication.drafts?.title ?? "",
          meta,
          publishedAt: new Date(publication.published_at),
        })
      ),
      ...(oldestPrice === undefined ? {} : { oldestPrice }),
    });
  }
  return [...pages.values()].filter((page) => ours.has(page.url));
}

/** Whether a stored search reading reached Found; `undefined` with no reading or on WordPress, which we cannot measure. */
export function foundIn(searchReading: unknown, destination: string | undefined): boolean | undefined {
  const reading = readingOf(searchReading);
  return reading === null || destination === "wordpress" ? undefined : reading.reached.found !== undefined;
}

/** When the oldest rival price among a version's recorded market facts was read, or `undefined`. */
export function oldestPriceOf(value: unknown): Date | undefined {
  if (!Array.isArray(value)) return undefined;
  let oldest: Date | undefined;
  for (const item of value) {
    const { kind, readAt } = (item ?? {}) as { kind?: unknown; readAt?: unknown };
    if (kind !== "rival_pricing" || typeof readAt !== "string") continue;
    const read = new Date(readAt);
    if (!Number.isNaN(read.getTime()) && (oldest === undefined || read < oldest)) oldest = read;
  }
  return oldest;
}

/** D60: `INTENT_UNMET_WEEKS` weekly verdicts, and none of them working. */
export function unmetAfter(judged: { weeks: number; worked: boolean } | undefined): boolean {
  return judged !== undefined && judged.weeks >= INTENT_UNMET_WEEKS && !judged.worked;
}

export async function readRefreshInputs(siteId: string): Promise<RefreshInputs> {
  const pages = await ownLivePages(siteId);
  return { pages, pools: pages.length === 0 ? { siteText: [], market: [] } : await readPools(siteId) };
}

async function readPools(siteId: string): Promise<RefreshPools> {
  const { readMeasuredText } = await import("@/lib/measure/text");
  const drafts = await untyped()
    .from<{ meta: Record<string, unknown> | null }>("drafts")
    .select("meta")
    .eq("site_id", siteId);
  if (drafts.error) throw new Error(`refresh: reading drafts for ${siteId}: ${drafts.error.message}`);
  const market = (drafts.data ?? []).flatMap((draft) =>
    passagesOf(draft.meta?.marketFacts).flatMap((fact) =>
      fact.readAt === null ? [] : [{ url: fact.url, passage: fact.passage, readAt: fact.readAt }]
    )
  );
  const report = await opportunityStore().currentReport(siteId);
  const searches =
    report === null || report.questions.kind === "unmeasured"
      ? []
      : report.questions.value.map((question) => ({ keyword: question.search.keyword, volume: question.search.volume }));
  // The ranked rows the pass already bought, which `close` reads.
  const ranked = (report?.ownRankedRows ?? []).map((row) => ({ keyword: row.keyword, url: row.url, position: row.position }));
  return { siteText: await readMeasuredText({ siteId }), market, searches, ranked };
}

/** Writes the refresh of every live page of ours that is due, after the Monday verdicts and before readiness; returns
 *  the rows added. It never throws: a week whose pages could not be read plans no refresh. */
export async function planRefreshes(a: { siteId: string; at: Date }): Promise<number> {
  try {
    const store = opportunityStore();
    const { pages, pools } = await store.refreshInputs(a.siteId);
    if (pages.length === 0) return 0;
    // A refresh whose version is live is finished; a queued one would hold the page's one open place forever.
    for (const { row } of pages) {
      if (row.status === "queued" && isOwnRefresh(row)) await store.markDone(row.id);
    }
    // D13's check, run again on the live text of each page no stored search result has held: a database read.
    const unseen = pages.filter((page) => unseenDue(page, a.at));
    const close = new Set<OwnLivePage>();
    if (unseen.length > 0) {
      const { closeElsewhere } = await import("@/lib/generate/pipeline/elsewhere");
      for (const page of unseen) {
        if ((await closeElsewhere({ siteId: a.siteId, markdown: page.markdown ?? "", now: a.at })) !== null) close.add(page);
      }
    }
    const visits = await searchVisits(a.siteId, pages, a.at);
    const stopped = unseen.length === 0 && visits.size === 0 ? new Set<string>() : await stoppedRefreshes(a.siteId);
    const checked = pages.map((page) => ({
      ...page,
      ...(close.has(page) ? { closeElsewhere: true } : {}),
      ...(visits.has(page) ? { ...visits.get(page), stopped: stopped.has(addressKey(page.url)) } : {}),
    }));
    const linked = unseen.length === 0 ? new Set<string>() : await linkedLately(a.siteId, a.at);
    const candidates = [
      ...refreshCandidates(checked, pools, a.at),
      ...unseenLinkCandidates(
        checked.map((page) => ({ ...page, stopped: stopped.has(addressKey(page.url)), linkedLately: linked.has(addressKey(page.url)) })),
        a.at
      ),
    ];
    const { created } = await persist({ candidates });
    // A close page's refresh is its one open row.
    if (candidates.some(isCloseRefresh)) {
      const open = (await store.openRankable(a.siteId)).map(readOpportunity);
      for (const id of absorbedBy(candidates, open)) await store.markDismissed(id);
    }
    return created.length;
  } catch (error) {
    console.error(JSON.stringify({ event: "refresh_plan_failed", siteId: a.siteId, message: String(error) }));
    return 0;
  }
}

/** Each hosted page Google showed with no click, with its counted Google visits; a page whose count was unread is left out. */
async function searchVisits(siteId: string, pages: readonly OwnLivePage[], at: Date): Promise<Map<OwnLivePage, { searchVisits: number }>> {
  const { readPageVisits } = await import("@/lib/publish/reads/store");
  const read = new Map<OwnLivePage, { searchVisits: number }>();
  for (const page of pages) {
    if (!shownUnclicked(page)) continue;
    const visits = await readPageVisits({ siteId, publicationId: page.publicationId!, since: page.publishedAt, now: at });
    if (visits.kind === "counted" || visits.kind === "none") read.set(page, { searchVisits: visits.kind === "counted" ? visits.n : 0 });
  }
  return read;
}

/** Writes rows planned between Mondays and assesses them at once, so their own week can see them; a failed read leaves them `not_assessed` for Monday. */
export async function persistAssessed(siteId: string, candidates: readonly Candidate[], at: Date): Promise<number> {
  const { created } = await persist({ candidates });
  if (created.length > 0) await assessReadiness(siteId, { at, now: at, only: new Set(created.map((row) => row.id)) }).catch((error: unknown) => console.error(JSON.stringify({ event: "refresh_assess_failed", siteId, message: String(error) })));
  return created.length;
}

function isCloseRefresh(candidate: Candidate): boolean {
  return candidate.evidence.family === "improve" && candidate.evidence.shortfall.kind === "due" && candidate.evidence.shortfall.cause === "close";
}

/** The open `answerable_page` rows a `close` refresh among `candidates` takes the place of, at its address. Pure. */
export function absorbedBy(candidates: readonly Candidate[], open: readonly Pick<Opportunity, "id" | "type" | "targetRef">[]): string[] {
  const close = new Set(candidates.filter(isCloseRefresh).map((candidate) => canonicalUrl(candidate.targetRef)));
  return open.filter((row) => row.type === "answerable_page" && close.has(canonicalUrl(row.targetRef))).map((row) => row.id);
}

/** The addresses whose refresh the customer stopped: a stopped draft dismisses its row. */
export async function stoppedRefreshes(siteId: string): Promise<Set<string>> {
  const { data, error } = await untyped()
    .from<{ target_ref: string | null }>("opportunities")
    .select("target_ref")
    .eq("site_id", siteId)
    .eq("type", "refresh_page")
    .eq("status", "dismissed");
  if (error) throw new Error(`refresh: reading stopped refreshes for ${siteId}: ${error.message}`);
  return new Set((data ?? []).flatMap((row) => (row.target_ref === null ? [] : [addressKey(row.target_ref)])));
}

/** The addresses a `link` refresh planned within `UNSEEN_LINK_EVERY_DAYS` links to, whatever became of it. */
async function linkedLately(siteId: string, at: Date): Promise<Set<string>> {
  const { data, error } = await untyped()
    .from<{ evidence: unknown }>("opportunities")
    .select("evidence")
    .eq("site_id", siteId)
    .eq("type", "refresh_page")
    .gte("created_at", new Date(at.getTime() - UNSEEN_LINK_EVERY_DAYS * DAY_MS).toISOString());
  if (error) throw new Error(`refresh: reading recent link refreshes for ${siteId}: ${error.message}`);
  return new Set(
    (data ?? []).flatMap((row) => {
      const due = (row.evidence as { shortfall?: { kind?: unknown; cause?: unknown; link?: { url?: unknown } } } | null)?.shortfall;
      return due?.kind === "due" && due.cause === "link" && typeof due.link?.url === "string" ? [addressKey(due.link.url)] : [];
    })
  );
}

/** When the page at `url` goes live, the nearest older live pages are each planned a refresh linking it; returns the
 *  rows added. It never throws: a page that went live is live whether or not its neighbours could be read. */
export async function planLinkBacks(a: { siteId: string; url: string; at: Date }): Promise<number> {
  try {
    const store = opportunityStore();
    const pages = await store.refreshPages(a.siteId);
    if (pages.length < 2) return 0;
    const stopped = await stoppedRefreshes(a.siteId);
    const candidates = linkBackCandidates(pages.map((page) => ({ ...page, stopped: stopped.has(addressKey(page.url)) })), a.url, a.at);
    return await persistAssessed(a.siteId, candidates, a.at);
  } catch (error) {
    console.error(JSON.stringify({ event: "link_back_plan_failed", siteId: a.siteId, message: String(error) }));
    return 0;
  }
}

/** The link a page holds to any of `from`, as its body spells it. */
function linkInto(markdown: string, from: readonly string[]): string | null {
  const wanted = new Set(from.map(addressKey));
  for (const match of markdown.matchAll(/\]\(([^)\s]+)\)/g)) {
    const href = match[1];
    if (href !== undefined && wanted.has(addressKey(href))) return href;
  }
  return null;
}

/** A page that moved: each live page linking its old address is planned a `link` refresh linking `to`, named `title`,
 *  unless the customer edited or stopped it or it is younger than the floor. Pure. */
export function movedLinkCandidates(
  pages: readonly OwnLivePage[],
  moved: { from: readonly string[]; to: string; title: string },
  at: Date
): Candidate[] {
  return pages.flatMap((page): Candidate[] => {
    if (addressKey(page.url) === addressKey(moved.to) || page.row.targetQuery === null) return [];
    if (page.edited === true || page.stopped === true || page.takenDown === true) return [];
    if (at.getTime() - page.publishedAt.getTime() < REFRESH_MIN_AGE_DAYS * DAY_MS) return [];
    const replaces = linkInto(page.markdown ?? "", moved.from);
    return replaces === null ? [] : [refreshOfPage(page, "link", at, { url: moved.to, title: moved.title, replaces })];
  });
}

/** Plans `movedLinkCandidates` for one site; returns the rows added, and never throws. */
export async function planMovedLinks(a: { siteId: string; from: readonly string[]; to: string; title: string; at: Date }): Promise<number> {
  try {
    const store = opportunityStore();
    const pages = await store.refreshPages(a.siteId);
    const stopped = await stoppedRefreshes(a.siteId);
    const candidates = movedLinkCandidates(
      pages.map((page) => ({ ...page, stopped: stopped.has(addressKey(page.url)) })),
      a,
      a.at
    );
    return await persistAssessed(a.siteId, candidates, a.at);
  } catch (error) {
    console.error(JSON.stringify({ event: "moved_link_plan_failed", siteId: a.siteId, message: String(error) }));
    return 0;
  }
}

/** The live pages of ours that break a consistency rule, each planned a `structure` refresh, unless the customer
 *  edited or stopped it or it is younger than the floor. Pure. */
export function structureCandidates(pages: readonly OwnLivePage[], at: Date): Candidate[] {
  return pages.flatMap((page): Candidate[] => {
    if (page.row.targetQuery === null || page.edited === true || page.stopped === true || page.takenDown === true) return [];
    if ((page.structure ?? []).length === 0) return [];
    if (at.getTime() - page.publishedAt.getTime() < REFRESH_MIN_AGE_DAYS * DAY_MS) return [];
    return [refreshOfPage(page, "structure", at)];
  });
}

/** The live listicles and comparisons of ours whose oldest rival price is older than D59's 30 days, each planned a
 *  `stale_prices` refresh, unless the customer stopped it or it is younger than the floor. Pure. */
export function stalePriceCandidates(pages: readonly OwnLivePage[], at: Date): Candidate[] {
  return pages.flatMap((page): Candidate[] => {
    if (page.row.targetQuery === null || page.stopped === true || page.takenDown === true || !pricesStale(page, at)) return [];
    if (at.getTime() - page.publishedAt.getTime() < REFRESH_MIN_AGE_DAYS * DAY_MS) return [];
    return [refreshOfPage(page, "stale_prices", at)];
  });
}

/** Plans `stalePriceCandidates`, then `structureCandidates`, for one site, so a page due both is refreshed for its
 *  prices from repaired text; returns the rows added, and never throws. */
export async function planStructureRefreshes(a: { siteId: string; at: Date }): Promise<number> {
  try {
    const store = opportunityStore();
    const pages = await store.refreshPages(a.siteId);
    if (pages.length === 0) return 0;
    const stopped = await stoppedRefreshes(a.siteId);
    const held = pages.map((page) => ({ ...page, stopped: stopped.has(addressKey(page.url)) }));
    const candidates = [...stalePriceCandidates(held, a.at), ...structureCandidates(held, a.at)];
    return await persistAssessed(a.siteId, candidates, a.at);
  } catch (error) {
    console.error(JSON.stringify({ event: "structure_plan_failed", siteId: a.siteId, message: String(error) }));
    return 0;
  }
}

/** `planStructureRefreshes` for every site with a live page, the hourly re-check's second half; never throws. */
export async function planStructureRefreshesEverywhere(a: { at: Date }): Promise<number> {
  try {
    const live = await untyped()
      .from<{ site_id: string }>("publications")
      .select("site_id")
      .not("published_at", "is", null)
      .is("unpublished_at", null);
    if (live.error) throw new Error(live.error.message);
    let planned = 0;
    for (const siteId of new Set((live.data ?? []).map((row) => row.site_id))) planned += await planStructureRefreshes({ siteId, at: a.at });
    return planned;
  } catch (error) {
    console.error(JSON.stringify({ event: "structure_plan_failed", message: String(error) }));
    return 0;
  }
}
