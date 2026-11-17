// SPEC §6 *One URL per question*: two searches are one topic where they share a mechanical word key (`clusterKey`),
// their stored top tens share `SAME_TOPIC_SHARED_ADDRESSES` addresses, or the pass's one same-question judgement
// pairs them. Pure: both are handed in, and nothing is bought or asked here.
import { PRICE_WORDS } from "@/lib/locale/language";
import { SAME_TOPIC_SHARED_ADDRESSES, TOPIC_FIT } from "@/lib/config/constants";
import { marketTokens, type MarketWords } from "@/lib/market/infer/terms";
import { GENERIC_TOKENS, ownBrandTokens, stemKey } from "@/lib/market/questions/select";
import { registrableDomain } from "@/lib/market/rivals/domains";
import { canonicalUrl } from "@/lib/measure/page-reading";
import type { StoredReport } from "@/lib/scan/report";
import type { Candidate } from "./derive/candidate";
import { isOwnRefresh, qualifiesForADay, type Family, type Opportunity, type OpportunityType, type Winnability } from "./types";

/** How a search is looked up in a top-ten map or a judgement. */
export function queryKey(query: string): string {
  return query.trim().toLowerCase();
}

/** The same top tens with each result's domain, address and title (issue 1506), and whether it showed a local pack:
 *  what tells the kind of business a search is answered by. */
export function topTenRowsOf(
  report: Pick<StoredReport, "questions" | "serps">
): Map<string, { rows: { domain: string; url: string; title: string }[]; localPack: boolean }> {
  const topTens = new Map<string, { rows: { domain: string; url: string; title: string }[]; localPack: boolean }>();
  if (report.questions?.kind !== "measured") return topTens;
  report.questions.value.forEach((question, index) => {
    const serp = report.serps?.[index];
    if (serp === undefined || serp.kind !== "measured") return;
    const rows = serp.value.organic.slice(0, 10).map(({ domain, url, title }) => ({ domain, url, title }));
    if (rows.length > 0) topTens.set(queryKey(question.search.keyword), { rows, localPack: (serp.value.localPack ?? []).length > 0 });
  });
  return topTens;
}

/** The top ten a report bought for each of its questions, as canonical addresses, keyed by `queryKey`. A question
 *  whose SERP is unmeasured has none. */
export function topTensOf(report: Pick<StoredReport, "questions" | "serps">): Map<string, readonly string[]> {
  const topTens = new Map<string, readonly string[]>();
  if (report.questions?.kind !== "measured") return topTens;
  report.questions.value.forEach((question, index) => {
    const serp = report.serps?.[index];
    if (serp === undefined || serp.kind !== "measured") return;
    const urls = serp.value.organic.slice(0, 10).map((row) => canonicalUrl(row.url));
    if (urls.length > 0) topTens.set(queryKey(question.search.keyword), urls);
  });
  return topTens;
}

/** Whether two top tens make their searches one topic. */
export function shareATopTen(a: readonly string[], b: readonly string[]): boolean {
  const other = new Set(b);
  return new Set(a.filter((url) => other.has(url))).size >= SAME_TOPIC_SHARED_ADDRESSES;
}

/** What `sameTopic` reads of a row. */
type TopicOf = Pick<Opportunity, "targetQuery" | "clusterKey" | "absorbedQueries">;

/** Whether two rows are one topic on what is stored: one cluster key, one search, a search the other absorbed, or
 *  top tens that share enough addresses. */
export function sameTopic(a: TopicOf, b: TopicOf, topTens: ReadonlyMap<string, readonly string[]>): boolean {
  if (a.clusterKey !== null && a.clusterKey === b.clusterKey) return true;
  if (a.targetQuery === null || b.targetQuery === null) return false;
  const [qa, qb] = [queryKey(a.targetQuery), queryKey(b.targetQuery)];
  if (qa === qb) return true;
  if (a.absorbedQueries.some((q) => queryKey(q) === qb) || b.absorbedQueries.some((q) => queryKey(q) === qa)) return true;
  const [ta, tb] = [topTens.get(qa), topTens.get(qb)];
  return ta !== undefined && tb !== undefined && shareATopTen(ta, tb);
}

/** B1's one-question join: `sameTopic`, or one cluster key once the market's own names are one word and its buyer no
 *  qualifier. Given no market, only `sameTopic`. */
export function oneQuestion(a: {
  topTens: ReadonlyMap<string, readonly string[]>;
  market: (MarketWords & { rivals?: readonly { domain: string }[] }) | null;
  brandTokens: readonly string[];
}): (x: TopicOf, y: TopicOf) => boolean {
  const rivals = (a.market?.rivals ?? []).map((rival) => (registrableDomain(rival.domain) ?? rival.domain).split(".")[0] ?? "");
  const keys = new Map<TopicOf, string | null>();
  const keyOf = (o: TopicOf) => keys.get(o) ?? keys.set(o, a.market === null ? null : clusterKey(o.targetQuery, [...a.brandTokens, ...rivals], a.market)).get(o)!;
  return (x, y) => sameTopic(x, y, a.topTens) || (keyOf(x) !== null && keyOf(x) === keyOf(y));
}

/** The open new-page rows a page just drafted makes repeats of, folded into it so the next evening never drafts the
 *  same question in other words. */
export function nearRepeatsOf(
  page: Opportunity,
  open: readonly Opportunity[],
  topTens: ReadonlyMap<string, readonly string[]>
): Opportunity[] {
  return open.filter(
    (row) =>
      row.id !== page.id &&
      row.status === "open" &&
      (row.family === "write" || row.family === "earn") &&
      sameTopic(page, row, topTens)
  );
}

/** The brand tokens a cluster key drops: the customer's own and each measured rival's registrable domain's first label. */
export function brandTokensOf(report: StoredReport): readonly string[] {
  const own = report.market.kind === "unmeasured" ? [] : ownBrandTokens(report.market.value.profile);
  const rivals =
    report.rivals.kind === "unmeasured"
      ? []
      : report.rivals.value.map((rival) => (registrableDomain(rival.domain) ?? rival.domain).split(".")[0] ?? "");
  return [...own, ...rivals].filter((token) => token.trim() !== "");
}

/** Every parent topic this pass measured, keyed as a row's own query is: a pass that read a search and proposed nothing
 *  for it decided against it, so a superseded row on it must not outlive it. Unmeasured parts cover nothing. */
export function coveredTopics(report: StoredReport, brandTokens: readonly string[], market?: MarketWords | null): ReadonlySet<string> {
  const searches: string[] = [];
  if (report.market.kind !== "unmeasured") {
    for (const row of report.market.value.suggestions) searches.push(row.keyword);
    // A thin market's searches come from the widened pool.
    for (const row of report.market.value.pool ?? []) searches.push(row.keyword);
  }
  if (report.questions.kind !== "unmeasured") {
    for (const question of report.questions.value) searches.push(question.search.keyword);
  }
  const topics = new Set<string>();
  for (const search of searches) {
    const key = clusterKey(search, brandTokens, market);
    if (key !== null) topics.add(key);
  }
  return topics;
}


/** The parent topic of a query, or `null` where it has none: no query, or nothing left once stop words and brands are
 *  gone. Given the site's market, its own names are one word and its buyer is no qualifier. */
export function clusterKey(query: string | null, brandTokens: readonly string[], market?: MarketWords | null): string | null {
  if (query === null) return null;
  const brands = new Set(brandTokens.flatMap((token) => stemKey(token).split(" ")).filter((t) => t !== ""));
  const tokens = market == null ? stemKey(query).split(" ") : marketTokens(query, market).tokens;
  // A price is one word however it is asked: "x pricing" and "x cost" are one topic.
  const all = [...new Set(tokens.map((token) => (PRICE_WORDS.has(token) ? "pricing" : token)))]
    .filter((token) => token !== "")
    .sort();
  const words = all.filter((token) => !brands.has(token));
  if (words.length === 0) return null;
  // Where only a shape is left ("alternatives", "vs") the brand is the topic: one rival's alternatives are not another's.
  const topic = words.every((token) => GENERIC_TOKENS.has(token)) ? all : words;
  return topic.sort().join(" ");
}

/** SPEC §6: Improve of an owned URL, then an Earn asset, then new writing. */
const FAMILY_ORDER: Readonly<Record<Family, number>> = Object.freeze({ improve: 0, earn: 1, write: 2, fix: 3 });

/** Owner, 2026-09-15: `answer_page` > `comparison_page` > `format_page` >
 *  `keyword_page`. Types outside the Write family share one place. */
const WRITE_TYPE_ORDER: Readonly<Partial<Record<OpportunityType, number>>> = Object.freeze({
  answer_page: 0,
  comparison_page: 1,
  format_page: 2,
  keyword_page: 3,
});

/** Negative where `a` goes first. Family, then Write type; nothing else —
 *  the score and age are the ranking's to add after this. */
export function comparePrecedence(
  a: { family: Family; type: OpportunityType },
  b: { family: Family; type: OpportunityType }
): number {
  const family = FAMILY_ORDER[a.family] - FAMILY_ORDER[b.family];
  if (family !== 0) return family;
  return (WRITE_TYPE_ORDER[a.type] ?? 0) - (WRITE_TYPE_ORDER[b.type] ?? 0);
}

/** A candidate as it is written: its cluster and the sibling searches it absorbed. */
export type ClusteredCandidate = Candidate & { clusterKey: string | null; absorbedQueries: readonly string[] };

export interface CollapsePlan {
  /** Open rows that lost their cluster, and superseded ones; applied first, so the one-open-row index never sees two. */
  dismiss: readonly string[];
  /** Rows that keep their place and take a cluster key or more absorbed searches. */
  update: readonly { id: string; clusterKey: string; absorbedQueries: readonly string[] }[];
  insert: readonly ClusteredCandidate[];
}

type Member =
  | { kind: "row"; row: Opportunity }
  | { kind: "candidate"; candidate: Candidate };

function volumeOf(m: Member): number {
  const volume = m.kind === "row" ? m.row.volume : m.candidate.volume;
  return volume === null || volume.kind === "unmeasured" ? 0 : volume.value;
}

function shapeOf(m: Member): { family: Family; type: OpportunityType } {
  return m.kind === "row" ? m.row : m.candidate;
}

function plansANewPage(m: Member): boolean {
  const { family } = shapeOf(m);
  return family === "write" || family === "earn";
}

function queryOf(m: Member): string | null {
  return m.kind === "row" ? m.row.targetQuery : m.candidate.targetQuery;
}

/** The search whose stored results page a member was read from: a question
 *  buyers were seen asking shares its parent search's. */
function serpOf(m: Member): string | null {
  const evidence = m.kind === "row" ? m.row.evidence : m.candidate.evidence;
  return (evidence.family === "write" ? evidence.askedBeside?.term : undefined) ?? queryOf(m);
}

/** The band a member carries, row or candidate. */
function bandOf(m: Member): Winnability | null {
  return m.kind === "row" ? m.row.fitBand : m.candidate.fitBand;
}

/** A row with a page behind it, being written or published: never dismissed, and it always survives its topic. */
function hasAPage(m: Member): boolean {
  return m.kind === "row" && (m.row.status === "queued" || m.row.status === "done");
}

/** Whether a member's stored fit passes SPEC §6's gate; one no pass has judged does. */
function fitsTheBusiness(m: Member): boolean {
  const fit = (m.kind === "row" ? m.row.businessFit : m.candidate.businessFit) ?? null;
  return fit === null || fit >= TOPIC_FIT.gate;
}

function compareMembers(a: Member, b: Member, band: (m: Member) => Winnability | null): number {
  const queued = Number(hasAPage(b)) - Number(hasAPage(a));
  if (queued !== 0) return queued;
  // A member that may fill a day outranks one that may not, by today's band, so a stale outsized row never wins.
  const sized = Number(qualifiesForADay(band(b))) - Number(qualifiesForADay(band(a)));
  if (sized !== 0) return sized;
  // A member the business is not the answer to never takes a topic from one it is.
  const fits = Number(fitsTheBusiness(b)) - Number(fitsTheBusiness(a));
  if (fits !== 0) return fits;
  const precedence = comparePrecedence(shapeOf(a), shapeOf(b));
  if (precedence !== 0) return precedence;
  const held = Number(b.kind === "row") - Number(a.kind === "row");
  if (held !== 0) return held;
  return volumeOf(b) - volumeOf(a);
}

/** One survivor per cluster over the site's open, queued and done non-Fix rows and this pass's candidates. The
 *  survivor absorbs every other member's search, unless it is a live page; a losing open row is dismissed and a
 *  losing candidate is not written, while a row with a page is never dismissed. An open survivor of a topic this pass
 *  covered, put no candidate in and did not derive is superseded and dismissed too. */
export function collapse(a: {
  existing: readonly Opportunity[];
  candidates: readonly Candidate[];
  brandTokens: readonly string[];
  /** The pass these candidates came from; absent collapses clusters and supersedes nothing. */
  pass?: { scanId: string; covered: ReadonlySet<string> };
  /** A stored row's band as today's right-sizing reads it; absent, the row's own column stands. */
  today?: (row: Opportunity) => Winnability | null;
  /** The stored top ten of a search, by `queryKey`; a search with none joins nothing by overlap. */
  topTens?: ReadonlyMap<string, readonly string[]>;
  /** The pass's same-question judgement: a search, by `queryKey`, to the search it asks the same question as. */
  sameQuestion?: ReadonlyMap<string, string>;
  /** The site's concluded market, whose own words join two searches. Absent joins by the words alone. */
  market?: MarketWords | null;
}): CollapsePlan {
  const byKey = new Map<string, Member[]>();
  const insert: ClusteredCandidate[] = [];
  const keyOf = new Map<Member, string>();

  const add = (key: string | null, member: Member): boolean => {
    if (key === null) return false;
    const group = byKey.get(key) ?? [];
    group.push(member);
    byKey.set(key, group);
    keyOf.set(member, key);
    return true;
  };

  for (const row of a.existing) {
    if (row.family === "fix" || row.status === "dismissed") continue;
    // A refresh of a page of ours is the update of that page, not a second page on its topic, so it never competes with the page's own row.
    if (isOwnRefresh(row)) continue;
    add(row.clusterKey ?? clusterKey(row.targetQuery, a.brandTokens), { kind: "row", row });
  }
  for (const candidate of a.candidates) {
    const key = candidate.family === "fix" ? null : clusterKey(candidate.targetQuery, a.brandTokens, a.market);
    if (!add(key, { kind: "candidate", candidate })) insert.push({ ...candidate, clusterKey: null, absorbedQueries: [] });
  }

  const groups = joinTopics(byKey, a.topTens ?? new Map(), a.sameQuestion ?? new Map(), (query) => (a.market == null ? null : clusterKey(query, a.brandTokens, a.market)));

  const band = (m: Member): Winnability | null =>
    m.kind === "row" && a.today !== undefined ? a.today(m.row) ?? m.row.fitBand : bandOf(m);

  /** Whether this pass has superseded the row that survived `key`: it read
   *  the topic, wrote no candidate on it, and did not derive the row. */
  const superseded = (row: Opportunity, key: string, hadCandidate: boolean): boolean =>
    a.pass !== undefined &&
    !hadCandidate &&
    row.status === "open" &&
    row.scanId !== a.pass.scanId &&
    a.pass.covered.has(key);

  const dismiss: string[] = [];
  const update: { id: string; clusterKey: string; absorbedQueries: string[] }[] = [];
  for (const members of groups) {
    const [survivor, ...rest] = [...members].sort((x, y) => compareMembers(x, y, band));
    if (survivor === undefined) continue;
    // The topic takes the survivor's own key, so a held survivor keeps its key and the index never sees it move.
    const key = keyOf.get(survivor) as string;
    const hadCandidate = members.some((member) => member.kind === "candidate");

    const own = queryOf(survivor)?.trim().toLowerCase() ?? null;
    const absorbed = new Set<string>(survivor.kind === "row" ? survivor.row.absorbedQueries : []);
    for (const member of rest) {
      if (hasAPage(member)) continue;
      if (member.kind === "row") dismiss.push(member.row.id);
      for (const query of [queryOf(member), ...(member.kind === "row" ? member.row.absorbedQueries : [])]) {
        if (query !== null && query.trim().toLowerCase() !== own) absorbed.add(query);
      }
    }
    const absorbedQueries = [...absorbed].sort();

    if (survivor.kind === "candidate") {
      insert.push({ ...survivor.candidate, clusterKey: key, absorbedQueries });
    } else if (survivor.row.status === "done") {
      // A live page keeps the searches it was published from: joining never touches it.
      continue;
    } else if (superseded(survivor.row, key, hadCandidate)) {
      // The whole cluster goes: its losers are already dismissed above, and the searches they absorbed have nothing to hang on.
      dismiss.push(survivor.row.id);
    } else if (survivor.row.clusterKey !== key || absorbedQueries.join("\n") !== [...survivor.row.absorbedQueries].sort().join("\n")) {
      update.push({ id: survivor.row.id, clusterKey: key, absorbedQueries });
    }
  }
  return { dismiss, update, insert };
}

/** The word-key groups, joined transitively where two are one topic. Only a member that plans a new page joins this
 *  way: an Improve is already the update of a page, and folding it in would drop that page's refresh. */
function joinTopics(
  byKey: ReadonlyMap<string, Member[]>,
  topTens: ReadonlyMap<string, readonly string[]>,
  sameQuestion: ReadonlyMap<string, string>,
  marketKey: (query: string) => string | null
): Member[][] {
  const keys = [...byKey.keys()];
  const parent = new Map(keys.map((key) => [key, key]));
  const root = (key: string): string => {
    let at = key;
    while (parent.get(at) !== at) at = parent.get(at) as string;
    return at;
  };
  const join = (x: string, y: string) => {
    const [rx, ry] = [root(x), root(y)];
    if (rx !== ry) parent.set(ry, rx);
  };

  const keyOfQuery = new Map<string, string>();
  const keyOfSerp = new Map<string, string>();
  const keyOfMarket = new Map<string, string>();
  const tops: { key: string; urls: readonly string[] }[] = [];
  for (const [key, members] of byKey) {
    for (const member of members) {
      const query = queryOf(member);
      if (query === null || !plansANewPage(member)) continue;
      keyOfQuery.set(queryKey(query), key);
      // One results page is one topic: its own search and the questions it showed.
      const serp = queryKey(serpOf(member) ?? query);
      // So is one search in the market's own words: a held row keyed before them joins its twin.
      for (const [byShared, shared] of [[keyOfSerp, serp], [keyOfMarket, marketKey(query)]] as const) {
        if (shared === null) continue;
        const sharing = byShared.get(shared);
        if (sharing === undefined) byShared.set(shared, key);
        else join(sharing, key);
      }
      const urls = topTens.get(serp);
      if (urls !== undefined) tops.push({ key, urls });
    }
  }
  for (let i = 0; i < tops.length; i++) {
    for (let j = i + 1; j < tops.length; j++) {
      if (tops[i]!.key !== tops[j]!.key && shareATopTen(tops[i]!.urls, tops[j]!.urls)) join(tops[i]!.key, tops[j]!.key);
    }
  }
  for (const [search, sameAs] of sameQuestion) {
    const [x, y] = [keyOfQuery.get(queryKey(search)), keyOfQuery.get(queryKey(sameAs))];
    if (x !== undefined && y !== undefined) join(x, y);
  }
  // A search a held row already absorbed is that row's topic when a later pass derives it again.
  for (const [key, members] of byKey) {
    for (const member of members) {
      if (member.kind !== "row" || !plansANewPage(member)) continue;
      for (const query of member.row.absorbedQueries) {
        const other = keyOfQuery.get(queryKey(query));
        if (other !== undefined) join(key, other);
      }
    }
  }

  const topics = new Map<string, Member[]>();
  for (const [key, members] of byKey) topics.set(root(key), [...(topics.get(root(key)) ?? []), ...members]);
  return [...topics.values()];
}
