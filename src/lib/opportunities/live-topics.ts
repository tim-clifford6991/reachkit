// SPEC §7 (issue 1506, from the SEO review of 2026-10-17, item 7, as the SEO
// master review of 2026-10-18 amended it) — the live pages, read again
// against the topic rules.
//
// A topic is chosen today only where people search it or ask AI about it,
// in the business's own market (`readiness.ts`): a "vs" between products
// needs measured demand, and a search whose stored top ten is another kind
// of business is `low_fit`. reachkit.app's pages of 3 and 5 October were
// chosen before either rule.
//
// Each hour, beside the rival recheck (issue 1485), every live page the
// customer has not edited is read again from its own row — the search it
// was written for, its volume, the stored top ten of the scan that found it
// — against the site's market, tracked prompts and the questions buyers
// were seen asking, as they stand. Nothing is fetched and no model is
// asked: 0¢. A page that would not be chosen today:
//
//   - waits where a retarget of it is already planned: D53's rewrite of
//     page A runs through the move of issue 1487 (new slug, 301);
//   - is retargeted where the site holds a ready topic in the page's own
//     cluster that no other live page already targets: that row becomes a
//     retarget of the page, written through the refresh path;
//   - is otherwise withdrawn only where nothing says it is worth keeping.
//     A page younger than 90 days whose verdicts are all `too_early` waits.
//     A page with a `working` verdict, a top-30 position in the stored
//     ranked keywords, or an answer-engine read or referral is kept and
//     planned as a refresh; so is every page on a host the weekly
//     measurement cannot see (issue 316), since a page there could rank
//     unseen — never retire blind;
//   - is merged into another live page of the site — its address answering
//     301 there (`merged_into`, through the move of issue 1487, whose link
//     refresh repoints the pages that linked it) — where another live page
//     of its cluster now passes the topic rules (owner, 2026-10-18: B "stays
//     until a D50 comparison replaces it, then 301s to it"), where another
//     live page already targets the topic it would be retargeted to (one
//     page a search), or where it would be withdrawn and another live page
//     is in its cluster. A page on the customer's own host (WordPress) has
//     no 301 of ours: it stays live and is named in the run's report;
//   - and otherwise is withdrawn through `unpublish()` by the system actor
//     `content/recheck`, every live version at its address, and a hosted
//     address then answers 410 (issue 1458). A live page of the site that
//     links it shows the link's words without the link from then on
//     (`withoutLinksTo`, at render).
//
// A page is never corrected by a direct row edit (ADR-080), and a page the
// customer edited, or took down and put back (issue 1532), is theirs and
// never read here. Nothing records a visitor
// from anywhere but an answer engine (`publication_reads` holds those
// only), so a non-search referrer is never on file.
import { REFRESH_MIN_AGE_DAYS } from "@/lib/config/constants";
import { registrableDomain } from "@/lib/market/rivals/domains";
import { canonicalUrl, queryKey } from "./cluster";
import { comparisonBrands, composedSearch, type AskedBeside, type ComparisonBrands, type MeasuredAnswer } from "./derive/topics";
import { freshTopTen, OTHER_KIND_TOP_TEN, otherKindTopTen, type KindOfBusiness, type OtherKind, type TopTenRow } from "./derive/top-ten-kind";
import type { IntentPrompt } from "./intent";
import { comparisonWithoutAsking } from "./readiness";
import { isRetarget, type Opportunity } from "./types";
import { takenDownByCustomer } from "@/lib/publish/take-down/standing";

/** How old an address must be before topic rules alone may retire it, where
 *  no verdict has yet judged it. Drafted (the SEO master review of
 *  2026-10-18); the owner may correct it. */
export const RETIRE_MIN_AGE_DAYS = 90;

/** The top-30 position in the stored ranked keywords that keeps a page. */
export const RETIRE_RANKED_WITHIN = 30;

const DAY_MS = 86_400_000;

/** What says a live page is worth keeping, read from stored rows since its
 *  address went live. */
export interface LiveSignals {
  /** When the address's first live version went live. */
  firstLive: Date;
  /** When the version it serves went live. */
  publishedAt: Date;
  /** Every Monday verdict on the address's live versions. */
  verdicts: readonly string[];
  /** A stored ranked keyword shows the address within the top 30. */
  ranked: boolean;
  /** Answer-engine reads and referrals `publication_reads` counted. */
  reads: number;
}

/** One live page, with the row it was written for. */
export interface LiveTopicPage {
  draftId: string;
  /** The publication the address serves. */
  publicationId: string;
  /** On ReachKit's hosted blog, whose addresses answer 301 and 410. */
  hosted: boolean;
  liveUrl: string;
  opportunity: Opportunity;
  signals: LiveSignals;
  /** The older versions still live at the same address. A withdrawal takes
   *  them too, or the address would serve the version before. */
  olderVersions?: readonly string[];
}

/** What a site's live pages are read against. */
export interface LiveTopicSite {
  /** The site's domain: the host the weekly measurement reads. */
  domain: string;
  brands: ComparisonBrands;
  prompts: readonly IntentPrompt[];
  asked: readonly AskedBeside[];
  /** The newest measured answers to the tracked prompts (issue 1520).
   *  Absent reads none. */
  answers?: readonly MeasuredAnswer[];
  /** Whether a search is one ReachKit composed from the market in force
   *  (issue 1520). Absent reads only the row's own mark. */
  composed?: (query: string) => boolean;
  business: KindOfBusiness | null;
  /** The stored top ten for a search, at most 30 days old, or `null`. */
  topTen: (query: string) => readonly TopTenRow[] | null;
  /** The site's open rows, ready or not. */
  open: readonly Opportunity[];
  pages: readonly LiveTopicPage[];
}

export type LiveTopicFailure = { rule: "no_demand" } | { rule: "other_kind"; kind: OtherKind };

/** A reason a failing page is kept. */
export type KeepSignal = "working" | "ranked" | "reads" | "host_unmeasured";

export type LiveTopicVerdict =
  | { kind: "keeps" }
  /** A retarget of this page is already planned: it moves when it is written. */
  | { kind: "moving"; failure: LiveTopicFailure }
  | { kind: "retarget"; failure: LiveTopicFailure; to: Opportunity }
  /** Too young to judge on topic alone. */
  | { kind: "waits"; failure: LiveTopicFailure }
  /** Kept for what it already earns, and planned as a refresh. */
  | { kind: "refresh"; failure: LiveTopicFailure; signals: readonly KeepSignal[] }
  /** Merged into another live page, its address answering 301 there. */
  | { kind: "redirect"; failure: LiveTopicFailure; into: string; why: "replaced" | "same_search" | "closest" }
  | { kind: "withdraw"; failure: LiveTopicFailure };

/** Why the page's topic would not be chosen today, or `null` where it would.
 *  Pure. */
export function liveTopicFailure(page: LiveTopicPage, site: LiveTopicSite): LiveTopicFailure | null {
  const row = page.opportunity;
  const query = row.targetQuery ?? "";
  if (query.trim() === "") return null;
  const evidence = { brands: site.brands, prompts: site.prompts, asked: site.asked, answers: site.answers, composed: site.composed };
  if (comparisonWithoutAsking(row, evidence)) return { rule: "no_demand" };
  const topTen = site.topTen(query);
  const other = topTen === null ? null : otherKindTopTen(topTen, site.business, row);
  return other === null ? null : { rule: "other_kind", kind: other };
}

/** Whether the weekly measurement reads the page's host: the site's own
 *  domain, with or without `www.`. A content host beside it is not read
 *  until issue 316 shows it is. */
export function measuredHost(liveUrl: string, domain: string): boolean {
  let host: string;
  try {
    host = new URL(liveUrl).hostname.toLowerCase();
  } catch {
    return false;
  }
  const own = registrableDomain(domain) ?? domain.toLowerCase();
  return host === own || host === `www.${own}`;
}

/** What keeps a failing page live, on what is stored. Pure. */
export function keepSignals(page: LiveTopicPage, site: Pick<LiveTopicSite, "domain">): KeepSignal[] {
  const out: KeepSignal[] = [];
  if (page.signals.verdicts.includes("working")) out.push("working");
  if (page.signals.ranked) out.push("ranked");
  if (page.signals.reads > 0) out.push("reads");
  if (!measuredHost(page.liveUrl, site.domain)) out.push("host_unmeasured");
  return out;
}

/** What happens to one live page at `now`. Pure. */
export function liveTopicVerdict(page: LiveTopicPage, site: LiveTopicSite, now: Date): LiveTopicVerdict {
  const failure = liveTopicFailure(page, site);
  if (failure === null) return { kind: "keeps" };
  if (site.open.some((row) => isRetarget(row) && row.targetRef === page.liveUrl)) return { kind: "moving", failure };
  const others = site.pages.filter((other) => other.liveUrl !== page.liveUrl);
  const cluster = page.opportunity.clusterKey;
  const to = site.open.find(
    (row) =>
      row.ready === true &&
      row.id !== page.opportunity.id &&
      (row.family === "write" || row.family === "earn") &&
      cluster !== null &&
      row.clusterKey === cluster &&
      (row.targetQuery ?? "").trim() !== ""
  );
  if (to !== undefined) {
    // One page a search: where another live page already targets it, this
    // one is merged into that page rather than made a second.
    const holder = others.find((other) => queryKey(other.opportunity.targetQuery ?? "") === queryKey(to.targetQuery ?? ""));
    return holder === undefined ? { kind: "retarget", failure, to } : { kind: "redirect", failure, into: holder.liveUrl, why: "same_search" };
  }
  // A page of its cluster that passes the topic rules has replaced it.
  const sameCluster = cluster === null ? [] : others.filter((other) => other.opportunity.clusterKey === cluster);
  const replacement = sameCluster.find((other) => liveTopicFailure(other, site) === null);
  if (replacement !== undefined) return { kind: "redirect", failure, into: replacement.liveUrl, why: "replaced" };
  const judged = page.signals.verdicts.some((verdict) => verdict !== "too_early");
  if (!judged && now.getTime() - page.signals.firstLive.getTime() < RETIRE_MIN_AGE_DAYS * DAY_MS) return { kind: "waits", failure };
  const signals = keepSignals(page, site);
  if (signals.length > 0) return { kind: "refresh", failure, signals };
  const close = sameCluster[0];
  return close === undefined ? { kind: "withdraw", failure } : { kind: "redirect", failure, into: close.liveUrl, why: "closest" };
}

export interface LiveTopicOutcome {
  checked: number;
  /** Every page that failed, with what was done or would be done, for the
   *  run's report. */
  failed: {
    liveUrl: string;
    verdict: LiveTopicVerdict["kind"];
    rule: LiveTopicFailure["rule"];
    signals?: readonly KeepSignal[];
    into?: string;
    why?: "replaced" | "same_search" | "closest";
  }[];
  withdrawn: { draftId: string; liveUrl: string; rule: LiveTopicFailure["rule"] }[];
  retargeted: { liveUrl: string; to: string }[];
  merged: { liveUrl: string; into: string }[];
  refreshed: string[];
  /** A page whose withdrawal, retarget or refresh did not complete: read
   *  again on the next tick. */
  stillLive: string[];
}

export interface LiveTopicDeps {
  sites: () => Promise<readonly LiveTopicSite[]>;
  /** Makes the ready row a retarget of the live page. */
  retarget: (page: LiveTopicPage, to: Opportunity, at: Date) => Promise<boolean>;
  /** Plans a refresh of the live page. */
  refresh: (page: LiveTopicPage, at: Date) => Promise<boolean>;
  /** Merges the hosted page into another, its address answering 301. */
  merge: (page: LiveTopicPage, into: LiveTopicPage, at: Date) => Promise<boolean>;
  withdraw: (draftId: string, at: Date) => Promise<boolean>;
  /** Dismisses the topics the withdrawn drafts were written for (issue
   *  1549). */
  dismiss?: (draftIds: readonly string[]) => Promise<void>;
}

/** Every live page read again, and each that fails handled as its verdict
 *  says. A failed read changes nothing; a failed action is read again next
 *  time. `dry` acts on nothing and returns the same report. */
export async function retireOffTopicPages(a: { now: Date; deps?: LiveTopicDeps; dry?: boolean }): Promise<LiveTopicOutcome> {
  const deps = a.deps ?? (await defaultDeps());
  const sites = await deps.sites();
  const outcome: LiveTopicOutcome = { checked: 0, failed: [], withdrawn: [], retargeted: [], merged: [], refreshed: [], stillLive: [] };
  for (const site of sites) {
    for (const page of site.pages) {
      outcome.checked += 1;
      const verdict = liveTopicVerdict(page, site, a.now);
      if (verdict.kind === "keeps") continue;
      outcome.failed.push({
        liveUrl: page.liveUrl,
        verdict: verdict.kind,
        rule: verdict.failure.rule,
        ...(verdict.kind === "refresh" ? { signals: verdict.signals } : {}),
        ...(verdict.kind === "redirect" ? { into: verdict.into, why: verdict.why } : {}),
      });
      if (a.dry === true) continue;
      if (verdict.kind === "retarget") {
        if (await deps.retarget(page, verdict.to, a.now)) outcome.retargeted.push({ liveUrl: page.liveUrl, to: verdict.to.targetQuery ?? "" });
        else outcome.stillLive.push(page.liveUrl);
      } else if (verdict.kind === "refresh") {
        // §6's 30 days stand, and one planned update of a page is enough.
        const due = a.now.getTime() - page.signals.publishedAt.getTime() >= REFRESH_MIN_AGE_DAYS * DAY_MS;
        const planned = site.open.some((row) => row.family === "improve" && row.targetRef === page.liveUrl);
        if (!due || planned) continue;
        if (await deps.refresh(page, a.now)) outcome.refreshed.push(page.liveUrl);
        else outcome.stillLive.push(page.liveUrl);
      } else if (verdict.kind === "redirect") {
        const into = site.pages.find((other) => other.liveUrl === verdict.into);
        // A 301 of ours is a hosted address's; the customer's own host keeps its page.
        if (into === undefined || !page.hosted || !into.hosted) continue;
        if (await deps.merge(page, into, a.now)) outcome.merged.push({ liveUrl: page.liveUrl, into: into.liveUrl });
        else outcome.stillLive.push(page.liveUrl);
      } else if (verdict.kind === "withdraw") {
        let down = await deps.withdraw(page.draftId, a.now);
        for (const older of page.olderVersions ?? []) down = (await deps.withdraw(older, a.now)) && down;
        if (down) outcome.withdrawn.push({ draftId: page.draftId, liveUrl: page.liveUrl, rule: verdict.failure.rule });
        else outcome.stillLive.push(page.liveUrl);
        // Issue 1549: an off-topic page's topic is not left `queued` behind
        // an address that is gone; it is dismissed. The page is down whether
        // or not the rows could be written.
        if (down && deps.dismiss !== undefined) await deps.dismiss([page.draftId, ...(page.olderVersions ?? [])]).catch((error: unknown) => {
          console.log(JSON.stringify({ event: "withdrawn_topic_dismiss_failed", draftId: page.draftId, because: String(error) }));
        });
      }
    }
  }
  console.log(
    JSON.stringify({
      event: "live_topic_recheck",
      dry: a.dry === true,
      checked: outcome.checked,
      failed: outcome.failed,
      withdrawn: outcome.withdrawn.map((page) => ({ url: page.liveUrl, rule: page.rule })),
      retargeted: outcome.retargeted,
      merged: outcome.merged,
      refreshed: outcome.refreshed,
      stillLive: outcome.stillLive,
    })
  );
  return outcome;
}

/** A live publication as the run reads it, with its draft and the row the
 *  draft was written for. */
export interface LiveRow {
  id: string;
  draft_id: string;
  destination: string;
  live_url: string | null;
  published_at: string;
  site_id: string;
  drafts: { meta: unknown; transitions?: unknown; opportunities: unknown } | null;
}

/** One address's live versions, newest first, with the row its newest was
 *  written for. */
export interface LiveAddress {
  siteId: string;
  liveUrl: string;
  versions: readonly LiveRow[];
  opportunity: Opportunity;
}

/**
 * The addresses the run reads: each with its live versions, newest first.
 * A page the customer edited is theirs (`edit.ts` stamps
 * `meta.first_edited_at` on the first save) and is left out, as is a page
 * they took down and put back (issue 1532) and a page with no row. Pure.
 */
export function liveAddressesOf(rows: readonly LiveRow[], read: (row: unknown) => Opportunity): LiveAddress[] {
  const byUrl = new Map<string, LiveRow[]>();
  for (const row of rows) {
    if (row.live_url === null) continue;
    byUrl.set(row.live_url, [...(byUrl.get(row.live_url) ?? []), row]);
  }
  const out: LiveAddress[] = [];
  for (const [liveUrl, held] of byUrl) {
    const versions = [...held].sort((x, y) => y.published_at.localeCompare(x.published_at));
    const newest = versions[0]!;
    const meta = (newest.drafts?.meta ?? {}) as Record<string, unknown>;
    const stored = newest.drafts?.opportunities;
    if (typeof meta.first_edited_at === "string" || stored == null || Array.isArray(stored)) continue;
    if (takenDownByCustomer(newest.drafts?.transitions)) continue;
    out.push({ siteId: newest.site_id, liveUrl, versions, opportunity: read(stored) });
  }
  return out;
}

/** Whether a stored ranked keyword shows `liveUrl` within the top 30. */
export function rankedWithin(rows: readonly { url: string; position: number }[], liveUrl: string): boolean {
  const own = canonicalUrl(liveUrl);
  return rows.some((row) => row.position <= RETIRE_RANKED_WITHIN && canonicalUrl(row.url) === own);
}

/** The system actor of the live rechecks. */
const RECHECK = { kind: "system", job: "content/recheck" } as const;

async function defaultDeps(): Promise<LiveTopicDeps> {
  const { publishDb } = await import("@/lib/publish/db");
  const { unpublish } = await import("@/lib/publish/attempt/unpublish");
  const { dismissTopicsOfDrafts } = await import("@/lib/publish/attempt/take-down");
  const { opportunityStore, readOpportunity, COLUMNS } = await import("./store");
  const { insertFor } = await import("./derive/persist");
  const { retargetCandidate } = await import("./retarget");
  const { refreshOfPage } = await import("./refresh");
  const { readSiteMarket } = await import("@/lib/market/infer/stored");
  return {
    async sites() {
      const db = publishDb();
      const live = await db
        .from<LiveRow>("publications")
        .select(`id, draft_id, destination, live_url, published_at, site_id, drafts(meta, transitions, opportunities(${COLUMNS}))`)
        .not("published_at", "is", null)
        .is("unpublished_at", null);
      if (live.error !== null || live.data === null) throw new Error(`live-topics: reading publications: ${live.error?.message ?? "no rows"}`);
      const addresses = liveAddressesOf(live.data, (row) => readOpportunity(row as Parameters<typeof readOpportunity>[0]));
      const ids = addresses.flatMap((address) => address.versions.map((version) => version.id));
      const [verdicts, reads] =
        ids.length === 0
          ? [[], []]
          : await Promise.all([
              db.from<{ publication_id: string; verdict: string }>("page_verdicts").select("publication_id, verdict").in("publication_id", ids),
              db
                .from<{ publication_id: string; kind: string; hits: number }>("publication_reads")
                .select("publication_id, kind, hits")
                .in("publication_id", ids)
                .in("kind", ["answer_fetch", "referral"]),
            ]).then(([v, r]) => {
              if (v.error !== null || r.error !== null) throw new Error(`live-topics: reading signals: ${(v.error ?? r.error)?.message}`);
              return [v.data ?? [], r.data ?? []] as const;
            });
      const store = opportunityStore();
      const out: LiveTopicSite[] = [];
      for (const siteId of new Set(addresses.map((address) => address.siteId))) {
        const held = addresses.filter((address) => address.siteId === siteId);
        const firstLive = new Date(Math.min(...held.flatMap((address) => address.versions.map((version) => Date.parse(version.published_at)))));
        const [report, site, prompts, open, asked, scans] = await Promise.all([
          store.currentReport(siteId),
          readSiteMarket(siteId),
          store.trackedPrompts === undefined ? [] : store.trackedPrompts(siteId),
          store.openRankable(siteId),
          store.askedBeside === undefined ? [] : store.askedBeside(siteId, OTHER_KIND_TOP_TEN.maxAgeDays),
          db
            .from<{ ranked: unknown; created_at: string }>("scans")
            .select("ranked:report->ownRankedRows, created_at")
            .eq("site_id", siteId)
            .gte("created_at", firstLive.toISOString()),
        ]);
        if (scans.error !== null) throw new Error(`live-topics: reading ranked keywords: ${scans.error.message}`);
        const market = site?.stored.current ?? null;
        const topTens = await store.topTenRows!([...new Set(held.map((address) => address.opportunity.scanId))]);
        const pages: LiveTopicPage[] = held.map((address) => {
          const own = new Set(address.versions.map((version) => version.id));
          const since = Math.min(...address.versions.map((version) => Date.parse(version.published_at)));
          const ranked = (scans.data ?? [])
            .filter((scan) => Date.parse(scan.created_at) >= since)
            .flatMap((scan) => (Array.isArray(scan.ranked) ? (scan.ranked as { url: string; position: number }[]) : []));
          const [newest, ...older] = address.versions;
          return {
            draftId: newest!.draft_id,
            publicationId: newest!.id,
            hosted: newest!.destination === "hosted",
            liveUrl: address.liveUrl,
            opportunity: address.opportunity,
            signals: {
              firstLive: new Date(since),
              publishedAt: new Date(newest!.published_at),
              verdicts: verdicts.filter((row) => own.has(row.publication_id)).map((row) => row.verdict),
              ranked: rankedWithin(ranked, address.liveUrl),
              reads: reads.filter((row) => own.has(row.publication_id)).reduce((sum, row) => sum + row.hits, 0),
            },
            ...(older.length === 0 ? {} : { olderVersions: older.map((version) => version.draft_id) }),
          };
        });
        out.push({
          domain: site?.domain ?? "",
          brands: comparisonBrands({ report, market }),
          prompts,
          asked,
          answers: report?.prompts?.answers ?? [],
          composed: (query) => composedSearch(query, market),
          business: market === null ? null : { kind: market.kind ?? null, serves: market.serves ?? null },
          topTen: (query) => freshTopTen(topTens.get(queryKey(query)), new Date()),
          open: open.map(readOpportunity),
          pages,
        });
      }
      return out;
    },
    async retarget(page, to, at) {
      const volume = to.volume;
      const candidate = retargetCandidate(
        { url: page.liveUrl, row: page.opportunity },
        { target: to.targetQuery ?? "", volume: volume === null || volume.kind === "unmeasured" ? null : volume.value, at }
      );
      const { type, family, target_ref, proposed_slug, title, effort, evidence } = insertFor(candidate);
      await opportunityStore().becomeUpdate(to.id, { type, family, target_ref, proposed_slug, title, effort, evidence });
      return true;
    },
    async refresh(page, at) {
      const outcome = await opportunityStore().insert(
        insertFor(refreshOfPage({ url: page.liveUrl, publishedAt: page.signals.publishedAt, row: page.opportunity }, "unmet", at))
      );
      return outcome.outcome === "created";
    },
    async merge(page, into, at) {
      const { moveAddress } = await import("@/lib/publish/attempt/move");
      await moveAddress({ from: page.liveUrl, to: { publicationId: into.publicationId, url: into.liveUrl }, at, by: RECHECK, merge: true });
      return true;
    },
    async withdraw(draftId, at) {
      const result = await unpublish({ draftId, by: RECHECK, at });
      return result.ok;
    },
    dismiss: dismissTopicsOfDrafts,
  };
}
