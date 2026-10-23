// SPEC §6 — "Cluster by parent topic. One cluster-day, at most one Write per
// cluster. Improve of an owned URL outranks a new page."
//
// Owner, 2026-09-15: the parent topic is a mechanical `clusterKey()` of the
// query's content words — lower-cased, stop words, brand tokens and a
// trailing `s` removed, sorted and joined — and Improve uses the same key.
// Nothing is bought to cluster: the key is a function of the words.
//
// Owner, 2026-09-29 (#1131): one URL per question. The word key is not the
// only way two searches are one topic — "best seo software" and "what is
// the best seo software" share no key and one top ten. Two members are one
// topic where their stored top tens share `SAME_TOPIC_SHARED_ADDRESSES`
// addresses, or where the pass's one small-tier judgement said they ask the
// same question (`derive/same-question.ts`). Both are handed in; this file
// still buys and asks nothing.
//
// Pure. No model, no fetch, no clock. Every family keys the same way, so a
// family added later (an Earn row's readiness, say) clusters with no branch
// here.
import { PRICE_WORDS } from "@/lib/locale/language";
import { SAME_TOPIC_SHARED_ADDRESSES, TOPIC_FIT } from "@/lib/config/constants";
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

/** The same top tens with each result's domain, address and title (issue
 *  1506), and whether it showed a local pack: what tells the kind of
 *  business a search is answered by. */
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

/** The top ten a report bought for each of its questions, as canonical
 *  addresses, keyed by `queryKey`. A question whose SERP is unmeasured has
 *  none. */
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

/** SPEC §6 (2026-09-29): whether two top tens make their searches one
 *  topic. */
export function shareATopTen(a: readonly string[], b: readonly string[]): boolean {
  const other = new Set(b);
  return new Set(a.filter((url) => other.has(url))).size >= SAME_TOPIC_SHARED_ADDRESSES;
}

/** What `sameTopic` reads of a row. */
type TopicOf = Pick<Opportunity, "targetQuery" | "clusterKey" | "absorbedQueries">;

/**
 * SPEC §6 (2026-10-02, #1181): whether two rows are one topic on what is
 * already stored — one cluster key, one search, a search the other absorbed
 * (the pass's same-question judgement, #1131), or top tens that share
 * `SAME_TOPIC_SHARED_ADDRESSES` addresses. Nothing is bought or asked.
 */
export function sameTopic(a: TopicOf, b: TopicOf, topTens: ReadonlyMap<string, readonly string[]>): boolean {
  if (a.clusterKey !== null && a.clusterKey === b.clusterKey) return true;
  if (a.targetQuery === null || b.targetQuery === null) return false;
  const [qa, qb] = [queryKey(a.targetQuery), queryKey(b.targetQuery)];
  if (qa === qb) return true;
  if (a.absorbedQueries.some((q) => queryKey(q) === qb) || b.absorbedQueries.some((q) => queryKey(q) === qa)) return true;
  const [ta, tb] = [topTens.get(qa), topTens.get(qb)];
  return ta !== undefined && tb !== undefined && shareATopTen(ta, tb);
}

/**
 * SPEC §6 (2026-10-02, #1181): the open new-page rows a page just drafted
 * makes repeats of. Each folds into that page — dismissed, its search
 * absorbed — the same join #1131 makes in the pass, made the evening the
 * page is written, so the next evening never drafts the same question
 * again in other words.
 */
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

/** The brand tokens a cluster key drops: the customer's own (the profile's
 *  `brandTokens` that name it, `ownBrandTokens`) and each measured rival's name — its registrable domain's
 *  first label, the tokenisation the Write deriver already uses. */
export function brandTokensOf(report: StoredReport): readonly string[] {
  const own = report.market.kind === "unmeasured" ? [] : ownBrandTokens(report.market.value.profile);
  const rivals =
    report.rivals.kind === "unmeasured"
      ? []
      : report.rivals.value.map((rival) => (registrableDomain(rival.domain) ?? rival.domain).split(".")[0] ?? "");
  return [...own, ...rivals].filter((token) => token.trim() !== "");
}

/**
 * Every parent topic this pass measured — the twelve it asked and the market
 * set it read, keyed the same way a row's own query is (issue 903).
 *
 * This is what "the new pass covered this topic" means, and it is a fact
 * about the report rather than about what the derivation chose to keep: a
 * pass that read a search and proposed nothing for it has covered it and
 * decided against it, which is exactly the case a superseded row must not
 * outlive. A topic outside this set is one the pass never looked at, and a
 * row on it is left alone.
 *
 * An unmeasured market and unmeasured questions each contribute nothing, so
 * a pass that could not read its market supersedes no row at all.
 */
export function coveredTopics(report: StoredReport, brandTokens: readonly string[]): ReadonlySet<string> {
  const searches: string[] = [];
  if (report.market.kind !== "unmeasured") {
    for (const row of report.market.value.suggestions) searches.push(row.keyword);
    // The widened pool (SPEC §6 thin markets): ranked rows the pass already
    // bought and selected over. A thin market's searches come from here.
    for (const row of report.market.value.pool ?? []) searches.push(row.keyword);
  }
  if (report.questions.kind !== "unmeasured") {
    for (const question of report.questions.value) searches.push(question.search.keyword);
  }
  const topics = new Set<string>();
  for (const search of searches) {
    const key = clusterKey(search, brandTokens);
    if (key !== null) topics.add(key);
  }
  return topics;
}


/**
 * The parent topic of a query, or `null` where it has none: no query (a Fix
 * targets no search), or nothing left once stop words and brands are gone —
 * a search for a brand alone has no topic to share.
 */
export function clusterKey(query: string | null, brandTokens: readonly string[]): string | null {
  if (query === null) return null;
  const brands = new Set(brandTokens.flatMap((token) => stemKey(token).split(" ")).filter((t) => t !== ""));
  // A price is one word however it is asked (issue 1208): "x pricing" and
  // "x cost" are one topic by their words, with no judgement needed.
  const all = [...new Set(stemKey(query).split(" ").map((token) => (PRICE_WORDS.has(token) ? "pricing" : token)))]
    .filter((token) => token !== "")
    .sort();
  const words = all.filter((token) => !brands.has(token));
  if (words.length === 0) return null;
  // Where only a shape is left — "alternatives", "vs", "pricing" — the brand
  // is the topic: one rival's alternatives are not another's (SPEC §6,
  // 2026-10-03, issue 1134), so the brands stay in the key.
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

/** A candidate as it is written: its cluster and the sibling searches it
 *  absorbed. */
export type ClusteredCandidate = Candidate & { clusterKey: string | null; absorbedQueries: readonly string[] };

export interface CollapsePlan {
  /** Existing open rows that lost their cluster to a better row, and the
   *  superseded ones this pass covered and proposed nothing for (issue
   *  903). Applied first, so the one-open-row-per-cluster index never sees
   *  two. */
  dismiss: readonly string[];
  /** Existing rows that keep their place and take a cluster key or more
   *  absorbed searches. */
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

/** A queued row always survives; then a right-sized member over an
 *  outsized one (issue 881); then precedence; then a row already held over
 *  a new candidate (a re-derivation moves nothing); then volume. */
/** The band a member carries, row or candidate. */
function bandOf(m: Member): Winnability | null {
  return m.kind === "row" ? m.row.fitBand : m.candidate.fitBand;
}

/** A row with a page behind it — being written (`queued`) or published
 *  (`done`, #1181). It is never dismissed and always survives its topic. */
function hasAPage(m: Member): boolean {
  return m.kind === "row" && (m.row.status === "queued" || m.row.status === "done");
}

/** Whether a member's stored fit passes SPEC §6's gate; one no pass has
 *  judged does. */
function fitsTheBusiness(m: Member): boolean {
  const fit = (m.kind === "row" ? m.row.businessFit : m.candidate.businessFit) ?? null;
  return fit === null || fit >= TOPIC_FIT.gate;
}

function compareMembers(a: Member, b: Member, band: (m: Member) => Winnability | null): number {
  const queued = Number(hasAPage(b)) - Number(hasAPage(a));
  if (queued !== 0) return queued;
  // Issue 881: the stale-evidence half. A re-measure **adds** to a site's
  // rows and recalculates none of them, so the targets derived before
  // right-sizing shipped are still on file with the band they were given
  // then. Held-row-wins meant one of those outsized rows survived its
  // cluster and the pass's own right-sized candidate for the same topic was
  // never written — the old competing with the new, and winning. A member
  // that may fill a day outranks one that may not, whichever is the row.
  //
  // `band` is how a row's own column is brought up to today's law before it
  // competes (issue 903): 884's `rebandFor` runs in `assessReadiness`, which
  // is a step *after* the derivation, so the column this read before it was
  // a band from the pass that wrote it — and for exactly the rows 881 was
  // written about, that column still claimed to qualify.
  const sized = Number(qualifiesForADay(band(b))) - Number(qualifiesForADay(band(a)));
  if (sized !== 0) return sized;
  // Issue 1549: a member the business is not the answer to never takes a
  // topic from one it is — "meltwater cost" absorbed "answer engine
  // optimization pricing" and left that search with no page.
  const fits = Number(fitsTheBusiness(b)) - Number(fitsTheBusiness(a));
  if (fits !== 0) return fits;
  const precedence = comparePrecedence(shapeOf(a), shapeOf(b));
  if (precedence !== 0) return precedence;
  const held = Number(b.kind === "row") - Number(a.kind === "row");
  if (held !== 0) return held;
  return volumeOf(b) - volumeOf(a);
}

/**
 * One survivor per cluster, over the site's existing open, queued and done
 * non-Fix rows and this pass's candidates together — a published topic
 * folds a new candidate on it like a page being written does (#1181).
 *
 * The survivor absorbs every other member's search. A losing open row is
 * dismissed; a losing candidate is not written; a queued row is never
 * dismissed — where a cluster already holds a queued row it survives, and a
 * second queued row in the same cluster keeps its place unclustered. Fix
 * candidates and rows with no topic pass through untouched.
 *
 * **And the superseded rows** (issue 903). A cluster the pass covered but
 * put no candidate in is a topic this pass read and decided against, and its
 * surviving row was derived from a report that is no longer current: it is
 * dismissed rather than left open competing for a day and counting in the
 * founder's view of what is planned. Three conditions, each of which alone
 * leaves the row where it is — the cluster holds a candidate of this pass
 * (so the row is this pass's own plan for the topic), the row was derived by
 * this pass, or the pass never covered the topic. A `queued` row has a draft
 * being written from it and is never dismissed here either.
 */
export function collapse(a: {
  existing: readonly Opportunity[];
  candidates: readonly Candidate[];
  brandTokens: readonly string[];
  /** The pass whose report these candidates came from, where the caller has
   *  one. Absent collapses clusters and supersedes nothing — the shape a
   *  suite that hands `collapse` bare candidates keeps. */
  pass?: { scanId: string; covered: ReadonlySet<string> };
  /** A stored row's band as today's right-sizing law reads it (884's
   *  `rebandFor`), where the caller can compute one. Absent, the row's own
   *  column stands. */
  today?: (row: Opportunity) => Winnability | null;
  /** The stored top ten of a search, by `queryKey` (#1131). Absent, or a
   *  search with none, joins nothing by overlap. */
  topTens?: ReadonlyMap<string, readonly string[]>;
  /** The pass's same-question judgement (#1131): a search, by `queryKey`,
   *  to the search it asks the same question as. */
  sameQuestion?: ReadonlyMap<string, string>;
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
    // A refresh of a page of ours (issue 1139) is the update of that page,
    // not a second page on its topic: it does not compete with the page's
    // own row, which would always survive it.
    if (isOwnRefresh(row)) continue;
    add(row.clusterKey ?? clusterKey(row.targetQuery, a.brandTokens), { kind: "row", row });
  }
  for (const candidate of a.candidates) {
    const key = candidate.family === "fix" ? null : clusterKey(candidate.targetQuery, a.brandTokens);
    if (!add(key, { kind: "candidate", candidate })) insert.push({ ...candidate, clusterKey: null, absorbedQueries: [] });
  }

  const groups = joinTopics(byKey, a.topTens ?? new Map(), a.sameQuestion ?? new Map());

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
    // The topic takes the survivor's own key, so a held survivor keeps the
    // key it has and the index never sees it move.
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
      // A live page keeps the searches it was published from.
      continue;
    } else if (superseded(survivor.row, key, hadCandidate)) {
      // The whole cluster goes: its losers are already dismissed above, and
      // the searches they were absorbing have nothing left to hang on.
      dismiss.push(survivor.row.id);
    } else if (survivor.row.clusterKey !== key || absorbedQueries.join("\n") !== [...survivor.row.absorbedQueries].sort().join("\n")) {
      update.push({ id: survivor.row.id, clusterKey: key, absorbedQueries });
    }
  }
  return { dismiss, update, insert };
}

/**
 * The word-key groups, joined where two are one topic (#1131): a member of
 * one shares a top ten with a member of the other, or the judgement says one
 * asks the same question as the other. Joining is transitive — a topic is
 * everything connected to it.
 *
 * Only a member that plans a new page (Write, Earn) joins this way: the rule
 * is "never a second page", and an Improve is already the update of a page
 * that exists — folding it into a queued row would drop that page's refresh.
 */
function joinTopics(
  byKey: ReadonlyMap<string, Member[]>,
  topTens: ReadonlyMap<string, readonly string[]>,
  sameQuestion: ReadonlyMap<string, string>
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
  const tops: { key: string; urls: readonly string[] }[] = [];
  for (const [key, members] of byKey) {
    for (const member of members) {
      const query = queryOf(member);
      if (query === null || !plansANewPage(member)) continue;
      keyOfQuery.set(queryKey(query), key);
      // One results page is one topic: its own search and the questions it showed.
      const serp = queryKey(serpOf(member) ?? query);
      const sharing = keyOfSerp.get(serp);
      if (sharing === undefined) keyOfSerp.set(serp, key);
      else join(sharing, key);
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
  // Issue 1549: a search a held row already absorbed is that row's topic.
  // Re-derived by a later pass, it joins the row instead of standing beside
  // it as a second topic counted twice.
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
