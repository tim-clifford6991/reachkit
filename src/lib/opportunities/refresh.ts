// SPEC §7 (2026-09-29, *Pace: new pages and refreshes*; issue 1139) — which
// of ReachKit's own live pages are due a refresh.
//
// "The other days carry updates of pages already live — ReachKit's own
// first, where a page is 90 days old, has lost its position, or a newer fact
// exists." Three causes, each read from what is already stored:
//
//   aged           the page's current version went live `PACE.REFRESH_AGE_DAYS`
//                  ago or more.
//   lost_position  the newest Monday verdict on that version recorded a
//                  decline (`page_verdicts.movement.declined`).
//   newer_fact     a pool holds a fact newer than the version. Business: the
//                  site's page a recorded fact was read from has been read
//                  again since, and no longer says it. Market: a later draft
//                  of the site recorded a claim from a page this one cites,
//                  read after this version went live, that this one does not
//                  carry.
//
// §6's floor stands (`REFRESH_MIN_AGE_DAYS`): a version younger than it is
// not refreshed for any cause.
//
// A page is ReachKit's own where ReachKit wrote it — a publication whose
// row planned a new page. The refresh is a `refresh_page` at the page's own
// address, for the search the page was written for, carrying that row's
// volume, band, fit and acceptance test: the search has not changed. It is
// a new version at the same address (issue 781), which is what sets the
// page's updated date (issue 1137).
//
// **Links in both directions** (SPEC §7, 2026-10-10, issue 1391). A fourth
// cause, planned when a page goes live and not on Monday: `link` — a newer
// page of the site is live that this one is near and does not link. The
// one or two nearest older pages are each planned this same refresh, whose
// writer adds one sentence linking the new page. A page the customer edited,
// or whose refresh they stopped, is theirs and is never among them. The
// floor stands for this cause as for the others.
//
// A page that moved (issue 1487) is the same cause seen from the other
// side: each live page that links its old address is planned a `link`
// refresh whose new version links the new one. The floor stands for it too,
// so a younger page is planned on the first hour it is old enough.
//
// **The site's own measurements** (SPEC §7, owner 2026-10-17, issue 1490):
// a cause of its own, `own_figures` — a live page that is not a research page
// states a measurement read off the site's own report ("0 of 12",
// "18/100"). Its refresh is written from a pack that no longer holds those
// sentences, and the numeral rule drops any the live page still carries.
// The floor stands for this cause as for the others.
//
// **Consistency** (SPEC §7, issue 1507): a cause of its own, `structure` — a
// live page the customer did not edit breaks one of the six rules a new page
// is held to: a description figure the body lacks, a numbered list with a
// gap, a repeated link, a link inside a word, broken link markup, an H1 in
// the body. Planned each hour by the live re-check, not only on Monday. Its
// refresh is written from the live text with what code can repair already
// repaired (`repairStructure`), so the new version is the page as it stands,
// mended; the row is never edited in place (ADR-080). The floor stands.
//
// **A page its customer took down** (SPEC §7, issue 1532) is theirs from
// then on, put back or not: no cause plans a refresh of it, and it gains no
// link refresh. While it is down it is not live and is read by none of this.
//
// **A page not found yet** (issue 1538). A hosted page whose stored search
// reading holds no Found step (`reached.found`) `UNSEEN_AFTER_DAYS` after it
// went live gets a different fix from a page that is found and not ranking:
// one link in from the live page of its cluster with the best reading,
// planned as that page's `link` refresh, at most one in each
// `UNSEEN_LINK_EVERY_DAYS`, and D13's check against pages written for other
// sites run again on its live text. Where that check finds it close, the
// page itself is due an `unseen` refresh, whose writing runs D13 once more
// and holds it if it is still close. A page with no reading, or on
// WordPress, where nothing measures Found, is neither. A page no stored SERP
// or ranked row has held (`verdicts/seen.ts`, `not_verified`) is not
// retargeted for `unmet`: it was never seen to fail its search.
//
// **Close to page one** (SPEC §7, owner 2026-10-18, issue 1521): a cause of
// its own, `close` — the page's own address ranks 4–20 for its search in the
// site's stored ranked rows. It goes ahead of a newer fact and of age, and
// its refresh may add up to three sections the top results cover and the
// page does not (`../generate/pipeline/pack.ts`, `headingGaps`). It takes the
// place of the page's own `answerable_page`: one open row a page.
//
// **Prices** (issue 1521): a cause of its own, `stale_prices` — a live
// listicle or comparison states a rival price read more than D59's 30 days
// ago. Read off the version's own row, so the hourly re-check plans it as it
// plans `structure`. The refresh's research reads the rivals' pages again.
//
// **A page's own results** (owner, 2026-10-19, B3 · M6, issue 1611): `close`
// covers 4–30 and waits until `GAP_REFRESH.stalledReadings` weekly readings
// hold no gain. A climbing page (`climbing`, M-a) is left alone by every
// cause its results drive. A page not moving is refreshed for it once: still
// not moving 8 weeks after that, its question is retired and its results
// plan no refresh again.
//
// Nothing is bought and no model is asked. The partial unique index keeps
// one open or queued refresh a page.
import {
  CLOSE_PAGE_POSITION_BAND,
  CROSS_LINKS,
  EFFORT_BY_TYPE,
  GAP_REFRESH,
  INTENT_UNMET_WEEKS,
  PACE,
  REFRESH_MIN_AGE_DAYS,
  RIVAL_PRICE_MAX_AGE_D,
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
import { canonicalUrl, readingOf, type PageReading } from "@/lib/measure/page-reading";
import type { Candidate } from "./derive/candidate";
import { persist } from "./derive/persist";
import { closestPrompt, measuredVolume } from "./intent";
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
  /** SPEC §6 (D60, issue 1288): this version has had `INTENT_UNMET_WEEKS`
   *  weekly verdicts and none found it working — neither in the top 20 for
   *  its search nor cited for its prompt. Absent reads as not so. */
  unmet?: boolean;
  facts: readonly RecordedPassage[];
  marketFacts: readonly RecordedPassage[];
  /** Issue 1391, what a link back is chosen from: the page's title, its
   *  body as it is live, whether the customer edited this version, and
   *  whether they stopped a refresh of this page. Absent reads as an
   *  untitled, empty, untouched page. */
  title?: string;
  markdown?: string;
  edited?: boolean;
  stopped?: boolean;
  /** Issue 1490: this version is not a research page and states one of the
   *  site's own measurements its pack held. Absent reads as not so. */
  ownFigures?: boolean;
  /** Issue 1507: what this version breaks of the consistency rules, where
   *  the customer did not edit it. Absent reads as nothing. */
  structure?: readonly StructureDefect[];
  /** Issue 1532: the customer took this page down and put it back. Absent
   *  reads as not so. */
  takenDown?: boolean;
  /** Issue 1538: whether any stored SERP or ranked row held this page.
   *  `false` is `not_verified`; absent is not known, and plans nothing. */
  seen?: boolean;
  /** Issue 1538: whether its stored search reading reached Found. `false`
   *  only where Found is measured — a hosted page with a reading; absent is
   *  not measured, and plans nothing. */
  found?: boolean;
  /** Issue 1538: a `link` refresh into this page was planned within
   *  `UNSEEN_LINK_EVERY_DAYS`. Absent reads as not so. */
  linkedLately?: boolean;
  /** Issue 1538: D13's check, run again on the live text, found a page
   *  written for another site as close as the near-duplicate bar. Read only
   *  for a page `unseenDue`; absent reads as not so. */
  closeElsewhere?: boolean;
  /** The place the page's stored search reading holds for it, where one
   *  was read. */
  readPlace?: number;
  /** Issue 1521: on a listicle or comparison, when the oldest rival price
   *  this version was written from was read. Absent reads as none. */
  oldestPrice?: Date;
  /** The places this version's weekly verdicts measured, oldest first.
   *  Absent reads as none. */
  readings?: readonly number[];
  /** The first and best place its stored search reading holds. */
  reading?: Pick<PageReading, "first" | "best">;
  /** A version of this page was already refreshed for not moving. */
  flatRefreshed?: boolean;
}

export interface RefreshPools {
  /** The site's own pages as they were last read, newest reading last. */
  siteText: readonly { url: string; text: string; measuredAt: Date }[];
  /** Every market claim the site's drafts recorded. */
  market: readonly (RecordedPassage & { readAt: Date })[];
  /** The searches the current report measured, with their monthly volume:
   *  what an unmet page with no measured search is retargeted among (D60).
   *  Absent reads as none. */
  searches?: readonly { keyword: string; volume: number }[];
  /** Issue 1521: the site's own ranked rows the current report holds — each
   *  search, the address that ranks for it and its place. Absent reads as
   *  none. */
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

/** Issue 1521: the best place the page's own address holds for its search
 *  in the stored ranked rows, or `null` where it holds none. */
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

/** The last `GAP_REFRESH.stalledReadings` readings hold no place better than
 *  the first of them. */
export function stalled(readings: readonly number[]): boolean {
  const last = readings.slice(-GAP_REFRESH.stalledReadings);
  return last.length === GAP_REFRESH.stalledReadings && Math.min(...last.slice(1)) >= last[0]!;
}

/** Its results plan no refresh: it is climbing, or it is still not moving
 *  after its one refresh for that. */
function leftAlone(page: OwnLivePage, at: Date): boolean {
  return (page.reading !== undefined && climbing(page.reading, at)) || (page.flatRefreshed === true && page.unmet === true);
}

/** A refresh planned because the page was not moving. */
function isFlatRefresh(o: Pick<Opportunity, "evidence">): boolean {
  return o.evidence?.family === "improve" && o.evidence.shortfall?.kind === "due" && o.evidence.shortfall.cause === "unmet";
}

/** Issue 1521: a rival price the page was written from is older than D59
 *  lets a pack hold one. */
function pricesStale(page: Pick<OwnLivePage, "oldestPrice">, at: Date): boolean {
  return page.oldestPrice !== undefined && at.getTime() - page.oldestPrice.getTime() > RIVAL_PRICE_MAX_AGE_D * DAY_MS;
}

/** Why this page is due at `at`, or `null` where it is not. */
export function refreshCauseOf(page: OwnLivePage, pools: RefreshPools, at: Date): RefreshCause | null {
  const age = at.getTime() - page.publishedAt.getTime();
  if (age < REFRESH_MIN_AGE_DAYS * DAY_MS) return null;
  if (page.ownFigures === true) return "own_figures";
  if (unseenDue(page, at) && page.closeElsewhere === true) return "unseen";
  const held = leftAlone(page, at);
  if (!held && page.unmet === true && page.seen !== false) return "unmet";
  if (!held && page.declined) return "lost_position";
  if (!held && isClose(page, pools)) return "close";
  if (hasNewerFact(page, pools)) return "newer_fact";
  if (pricesStale(page, at)) return "stale_prices";
  if (age >= PACE.REFRESH_AGE_DAYS * DAY_MS) return "aged";
  // Issue 1507: any refresh starts from the repaired text, so this cause is
  // named only where no other is due.
  return (page.structure ?? []).length > 0 && page.edited !== true ? "structure" : null;
}

/** Issue 1538: a live page of ours whose reading holds no Found step,
 *  `UNSEEN_AFTER_DAYS` after its version went live. */
export function unseenDue(page: OwnLivePage, at: Date): boolean {
  return (
    page.found === false &&
    page.takenDown !== true &&
    page.row.targetQuery !== null &&
    at.getTime() - page.publishedAt.getTime() >= UNSEEN_AFTER_DAYS * DAY_MS
  );
}

/**
 * Issue 1538: for each page `unseenDue`, one link in from the strongest live
 * page of its cluster — the sibling not itself unfound whose stored reading
 * holds the best place, the oldest first among equals — planned as that
 * page's `link` refresh (issue 1391). A sibling the customer edited, stopped
 * or took down, or younger than the floor, is passed over. Nothing is
 * planned where a sibling already links the page, where a link into it was
 * planned lately, or where the page has no cluster or no such sibling. One
 * row a sibling. Pure.
 */
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
    planned.set(addressKey(strongest.url), refreshOf(strongest, "link", at, { url: page.url, title }));
  }
  return [...planned.values()];
}

/** The address as two addresses are compared: host without `www.`, no
 *  trailing slash, case folded. */
function addressKey(url: string): string {
  return url.trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/[#?].*$/, "").replace(/\/+$/, "");
}

/**
 * Links in both directions (issue 1391): the older live pages that gain a
 * link to the page at `freshUrl`, nearest first, at most
 * `CROSS_LINKS.BACK_PAGES_MAX`. Pure.
 *
 * Nearest is read off the site's own pages: the words two pages' titles and
 * searches share, each weighed by how few of the site's pages carry it — so
 * "best" and "how", which half the titles hold, count for little, and the
 * subject the two have in common counts for most. A page of the same
 * cluster comes first. A page that shares no word of four letters or more
 * is not near at all.
 */
export function linkBackCandidates(pages: readonly OwnLivePage[], freshUrl: string, at: Date): Candidate[] {
  return linkBacksAmong(pages, freshUrl, at).filter((candidate) => !takenDownAt(pages, candidate.targetRef));
}

/** Whether the page at `url` is one its customer took down (issue 1532). */
function takenDownAt(pages: readonly OwnLivePage[], url: string | null): boolean {
  return url !== null && pages.some((page) => page.takenDown === true && addressKey(page.url) === addressKey(url));
}

function linkBacksAmong(pages: readonly OwnLivePage[], freshUrl: string, at: Date): Candidate[] {
  const fresh = pages.find((page) => addressKey(page.url) === addressKey(freshUrl));
  // A page going live for the first time: a refresh of an old page is not news
  // its neighbours owe a link to.
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
    .map(({ page }) => refreshOf(page, "link", at, { url: fresh.url, title: freshTitle }));
}

/** The refresh of one page, for one cause. A live page the topic recheck
 *  keeps for what it already earns is refreshed this way too (issue 1506). */
export function refreshOfPage(
  page: Pick<OwnLivePage, "url" | "publishedAt" | "row">,
  cause: RefreshCause,
  at: Date,
  link?: { url: string; title: string; replaces?: string }
): Candidate {
  return refreshOf(page, cause, at, link);
}

function refreshOf(
  page: Pick<OwnLivePage, "url" | "publishedAt" | "row"> & Partial<Pick<OwnLivePage, "structure">>,
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
    // SPEC §6 (D60, issue 1288): an unmet page whose own search has no
    // measured volume is rewritten for the closest measured search, where
    // one is close; otherwise it is refreshed for the search it has.
    if (cause === "unmet" && measuredVolume(row.volume) === null) {
      const taken = new Set(pages.map((other) => squashed(other.row.targetQuery ?? "")));
      const open = (pools.searches ?? [])
        .filter((search) => search.volume > 0 && !taken.has(squashed(search.keyword)))
        .map((search) => ({ id: search.keyword, text: search.keyword, volume: search.volume }));
      const target = closestPrompt(row.targetQuery, open);
      if (target !== null) return [retargetCandidate(page, { target: target.text, volume: target.volume, at })];
    }
    return [refreshOf(page, cause, at, undefined, page.readPlace ?? ownPlace(page, pools))];
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

/**
 * Whether a version that is not a research page states one of the site's
 * own measurements (issue 1490): a measurement of a report sentence its
 * pack held, found in its body. A research page, and a version written
 * before the pack, state none.
 */
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
  // Issue 1538: every address a stored SERP or ranked row held. Rows that
  // could not be read state no page's index state, and plan nothing.
  const { verdictStore } = await import("./verdicts/store");
  const { indexStateOf } = await import("./verdicts/seen");
  const store = verdictStore();
  const seenUrls = store.seenUrls === undefined ? null : await store.seenUrls(siteId).catch(() => null);
  const pages = new Map<string, OwnLivePage>();
  const ours = new Set<string>();
  // Issue 1521: what the page at an address was first written as — a
  // refresh's own version records `update`.
  const writtenAs = new Map<string, string>();
  const flat = new Set<string>();
  for (const publication of live.data ?? []) {
    const opportunity = publication.drafts?.opportunities ?? null;
    if (publication.live_url === null || publication.published_at === null || opportunity === null) continue;
    if (typeof opportunity.family !== "string" || typeof opportunity.id !== "string") continue;
    const url = now(publication.live_url);
    // A retarget of one of ours moved it to an address of its own (issue
    // 1487): the page there is still ours.
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
    if (isFlatRefresh(readOpportunity(opportunity))) flat.add(url);
    // Issue 1507: a mended version is dated as the one it mended, so a
    // repair in code does not make a page look newer than its words.
    const dated = typeof meta.datedAs === "string" ? new Date(meta.datedAs) : null;
    pages.set(url, {
      url,
      publishedAt: dated !== null && !Number.isNaN(dated.getTime()) ? dated : new Date(publication.published_at),
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
      ...(seenUrls === null ? {} : { seen: indexStateOf([url, publication.live_url], seenUrls) === "seen" }),
      ...(found === undefined ? {} : { found }),
      ...(readPlace === undefined ? {} : { readPlace }),
      readings: readings.get(publication.id) ?? [],
      ...(reading === null ? {} : { reading }),
      flatRefreshed: flat.has(url),
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

/** Issue 1538: whether a stored search reading reached Found; `undefined`
 *  where nothing measures it — no reading, or a WordPress page, which has
 *  no server logs and no Search Console property of ours. */
export function foundIn(searchReading: unknown, destination: string | undefined): boolean | undefined {
  const reading = readingOf(searchReading);
  return reading === null || destination === "wordpress" ? undefined : reading.reached.found !== undefined;
}

/** Issue 1521: when the oldest rival price among a version's recorded
 *  market facts was read, or `undefined` where it records none. */
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

/** What `planRefreshes` reads, as the Postgres store answers it. */
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
  // Issue 1521: the ranked rows the pass already bought, which `close` reads.
  const ranked = (report?.ownRankedRows ?? []).map((row) => ({ keyword: row.keyword, url: row.url, position: row.position }));
  return { siteText: await readMeasuredText({ siteId }), market, searches, ranked };
}

/**
 * Writes the refresh of every live page of ours that is due, after the
 * Monday verdicts and before readiness is recorded. Returns how many rows it
 * added. It never throws: a week whose pages could not be read plans no
 * refresh, and the week's new pages are untouched.
 */
export async function planRefreshes(a: { siteId: string; at: Date }): Promise<number> {
  try {
    const store = opportunityStore();
    // A store that holds no pages plans none.
    if (store.refreshInputs === undefined) return 0;
    const { pages, pools } = await store.refreshInputs(a.siteId);
    if (pages.length === 0) return 0;
    // A refresh whose version is live is finished. Nothing else moves a
    // written row out of `queued`, and a queued refresh would hold the
    // page's one place in the index against every later one.
    for (const { row } of pages) {
      if (row.status === "queued" && isOwnRefresh(row)) await store.markDone(row.id);
    }
    // Issue 1538: D13's check, run again on the live text of each page no
    // stored search result has held. A database read; nothing is bought.
    const unseen = pages.filter((page) => unseenDue(page, a.at));
    const close = new Set<OwnLivePage>();
    if (unseen.length > 0) {
      const { closeElsewhere } = await import("@/lib/generate/pipeline/elsewhere");
      for (const page of unseen) {
        if ((await closeElsewhere({ siteId: a.siteId, markdown: page.markdown ?? "", now: a.at })) !== null) close.add(page);
      }
    }
    const checked = pages.map((page) => (close.has(page) ? { ...page, closeElsewhere: true } : page));
    const stopped = unseen.length === 0 ? new Set<string>() : await stoppedRefreshes(a.siteId);
    const linked = unseen.length === 0 ? new Set<string>() : await linkedLately(a.siteId, a.at);
    const candidates = [
      ...refreshCandidates(checked, pools, a.at),
      ...unseenLinkCandidates(
        checked.map((page) => ({ ...page, stopped: stopped.has(addressKey(page.url)), linkedLately: linked.has(addressKey(page.url)) })),
        a.at
      ),
    ];
    const { created } = await persist({ candidates });
    // Issue 1521: a close page's refresh is its one open row.
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

function isCloseRefresh(candidate: Candidate): boolean {
  return candidate.evidence.family === "improve" && candidate.evidence.shortfall.kind === "due" && candidate.evidence.shortfall.cause === "close";
}

/** Issue 1521: the open `answerable_page` rows a `close` refresh among
 *  `candidates` takes the place of — the update of the same address. Pure. */
export function absorbedBy(candidates: readonly Candidate[], open: readonly Pick<Opportunity, "id" | "type" | "targetRef">[]): string[] {
  const close = new Set(candidates.filter(isCloseRefresh).map((candidate) => canonicalUrl(candidate.targetRef)));
  return open.filter((row) => row.type === "answerable_page" && close.has(canonicalUrl(row.targetRef))).map((row) => row.id);
}

/** The addresses whose refresh the customer stopped: a stopped draft
 *  dismisses its row (SPEC §7, 2026-09-15). */
async function stoppedRefreshes(siteId: string): Promise<Set<string>> {
  const { data, error } = await untyped()
    .from<{ target_ref: string | null }>("opportunities")
    .select("target_ref")
    .eq("site_id", siteId)
    .eq("type", "refresh_page")
    .eq("status", "dismissed");
  if (error) throw new Error(`refresh: reading stopped refreshes for ${siteId}: ${error.message}`);
  return new Set((data ?? []).flatMap((row) => (row.target_ref === null ? [] : [addressKey(row.target_ref)])));
}

/** The addresses a `link` refresh planned within `UNSEEN_LINK_EVERY_DAYS`
 *  links to, whatever became of it. */
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

/**
 * Links in both directions (SPEC §7, 2026-10-10, issue 1391): when the page
 * at `url` goes live, the one or two nearest older live pages are each
 * planned a refresh that links to it. Returns how many rows it added. It
 * never throws: a page that went live is live whether or not its neighbours
 * could be read.
 */
export async function planLinkBacks(a: { siteId: string; url: string; at: Date }): Promise<number> {
  try {
    const store = opportunityStore();
    if (store.refreshPages === undefined) return 0;
    const pages = await store.refreshPages(a.siteId);
    if (pages.length < 2) return 0;
    const stopped = await stoppedRefreshes(a.siteId);
    const candidates = linkBackCandidates(
      pages.map((page) => ({ ...page, stopped: stopped.has(addressKey(page.url)) })),
      a.url,
      a.at
    );
    if (candidates.length === 0) return 0;
    const { created } = await persist({ candidates });
    return created.length;
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

/**
 * A page that moved (SPEC §7, issue 1487): the live pages that link its old
 * address, each planned a `link` refresh whose new version links `to`,
 * named `title`. A page the customer edited, whose refresh they stopped, or
 * younger than the floor is not planned. Pure.
 */
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
    return replaces === null ? [] : [refreshOf(page, "link", at, { url: moved.to, title: moved.title, replaces })];
  });
}

/** Plans `movedLinkCandidates` for one site. Returns how many rows it
 *  added; a row already open for a page adds nothing. It never throws. */
export async function planMovedLinks(a: { siteId: string; from: readonly string[]; to: string; title: string; at: Date }): Promise<number> {
  try {
    const store = opportunityStore();
    if (store.refreshPages === undefined) return 0;
    const pages = await store.refreshPages(a.siteId);
    const stopped = await stoppedRefreshes(a.siteId);
    const candidates = movedLinkCandidates(
      pages.map((page) => ({ ...page, stopped: stopped.has(addressKey(page.url)) })),
      a,
      a.at
    );
    if (candidates.length === 0) return 0;
    const { created } = await persist({ candidates });
    return created.length;
  } catch (error) {
    console.error(JSON.stringify({ event: "moved_link_plan_failed", siteId: a.siteId, message: String(error) }));
    return 0;
  }
}

/**
 * Consistency (SPEC §7, issue 1507): the live pages of ours that break a
 * rule of issue 1507, each planned a `structure` refresh. A page the
 * customer edited, whose refresh they stopped, or younger than the floor is
 * not planned. Pure.
 */
export function structureCandidates(pages: readonly OwnLivePage[], at: Date): Candidate[] {
  return pages.flatMap((page): Candidate[] => {
    if (page.row.targetQuery === null || page.edited === true || page.stopped === true || page.takenDown === true) return [];
    if ((page.structure ?? []).length === 0) return [];
    if (at.getTime() - page.publishedAt.getTime() < REFRESH_MIN_AGE_DAYS * DAY_MS) return [];
    return [refreshOf(page, "structure", at)];
  });
}

/**
 * Prices (issue 1521): the live listicles and comparisons of ours whose
 * oldest rival price is older than D59's 30 days, each planned a
 * `stale_prices` refresh. A page whose refresh the customer stopped, or
 * younger than the floor, is not planned. Pure.
 */
export function stalePriceCandidates(pages: readonly OwnLivePage[], at: Date): Candidate[] {
  return pages.flatMap((page): Candidate[] => {
    if (page.row.targetQuery === null || page.stopped === true || page.takenDown === true || !pricesStale(page, at)) return [];
    if (at.getTime() - page.publishedAt.getTime() < REFRESH_MIN_AGE_DAYS * DAY_MS) return [];
    return [refreshOf(page, "stale_prices", at)];
  });
}

/** Plans `stalePriceCandidates`, then `structureCandidates`, for one site:
 *  a page due both is refreshed for its prices, from text already repaired.
 *  Returns how many rows it added; a row already open for a page adds
 *  nothing. It never throws. */
export async function planStructureRefreshes(a: { siteId: string; at: Date }): Promise<number> {
  try {
    const store = opportunityStore();
    if (store.refreshPages === undefined) return 0;
    const pages = await store.refreshPages(a.siteId);
    if (pages.length === 0) return 0;
    const stopped = await stoppedRefreshes(a.siteId);
    const held = pages.map((page) => ({ ...page, stopped: stopped.has(addressKey(page.url)) }));
    const candidates = [...stalePriceCandidates(held, a.at), ...structureCandidates(held, a.at)];
    if (candidates.length === 0) return 0;
    const { created } = await persist({ candidates });
    return created.length;
  } catch (error) {
    console.error(JSON.stringify({ event: "structure_plan_failed", siteId: a.siteId, message: String(error) }));
    return 0;
  }
}

/** `planStructureRefreshes` for every site with a live page: the hourly
 *  live re-check's second half (issue 1507). Returns how many rows it added
 *  in all. It never throws. */
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
