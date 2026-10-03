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
// Nothing is bought and no model is asked. The partial unique index keeps
// one open or queued refresh a page.
import { EFFORT_BY_TYPE, PACE, REFRESH_MIN_AGE_DAYS } from "@/lib/config/constants";
import { measured } from "@/lib/measure/measured";
import { addressesOwnPage, type HostedOwnPages } from "@/lib/publish/destinations/hosted/own-page";
import type { Candidate } from "./derive/candidate";
import { persist } from "./derive/persist";
import { COLUMNS, opportunityStore, readOpportunity, untyped, type OpportunityRow } from "./store";
import { FAMILY_OF, isOwnRefresh, type Evidence, type Opportunity, type RefreshCause } from "./types";

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
  facts: readonly RecordedPassage[];
  marketFacts: readonly RecordedPassage[];
}

export interface RefreshPools {
  /** The site's own pages as they were last read, newest reading last. */
  siteText: readonly { url: string; text: string; measuredAt: Date }[];
  /** Every market claim the site's drafts recorded. */
  market: readonly (RecordedPassage & { readAt: Date })[];
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

/** Why this page is due at `at`, or `null` where it is not. */
export function refreshCauseOf(page: OwnLivePage, pools: RefreshPools, at: Date): RefreshCause | null {
  const age = at.getTime() - page.publishedAt.getTime();
  if (age < REFRESH_MIN_AGE_DAYS * DAY_MS) return null;
  if (page.declined) return "lost_position";
  if (hasNewerFact(page, pools)) return "newer_fact";
  return age >= PACE.REFRESH_AGE_DAYS * DAY_MS ? "aged" : null;
}

/** The refresh of each page that is due. Pure. */
export function refreshCandidates(pages: readonly OwnLivePage[], pools: RefreshPools, at: Date): Candidate[] {
  return pages.flatMap((page): Candidate[] => {
    const { row } = page;
    const cause = refreshCauseOf(page, pools, at);
    if (cause === null || row.targetQuery === null) return [];
    const evidence: Evidence = {
      family: "improve",
      query: row.targetQuery,
      volume: row.volume ?? measured(0, at),
      pageUrl: page.url,
      shortfall: { kind: "due", cause, since: measured(page.publishedAt, at) },
      ...("target" in row.evidence && row.evidence.target !== undefined ? { target: row.evidence.target } : {}),
    };
    return [
      {
        siteId: row.siteId,
        scanId: row.scanId,
        type: "refresh_page",
        family: FAMILY_OF.refresh_page,
        targetQuery: row.targetQuery,
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
      },
    ];
  });
}

// ── Reading what is stored ──────────────────────────────────────────────

interface PublicationRow {
  id: string;
  live_url: string | null;
  published_at: string | null;
  drafts: { meta: Record<string, unknown> | null; opportunities: OpportunityRow | null } | null;
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

/** The address the page answers at now: a hosted page follows its site's
 *  host (SPEC §7, 2026-09-18), any other keeps the one it was published at. */
function addressOf(liveUrl: string, own: HostedOwnPages | null): string {
  if (own === null || own.host === "") return liveUrl;
  const slug = liveUrl.split(/[?#]/)[0]!.split("/").filter((segment) => segment !== "").pop() ?? "";
  const moved = `https://${own.host}/${slug}`;
  return addressesOwnPage(moved, own) ? moved : liveUrl;
}

/** The site's live pages that ReachKit wrote, each at its current version. */
async function ownLivePages(siteId: string): Promise<OwnLivePage[]> {
  const client = untyped();
  const live = await client
    .from<PublicationRow>("publications")
    .select(`id, live_url, published_at, drafts(meta, opportunities(${COLUMNS}))`)
    .eq("site_id", siteId)
    .not("published_at", "is", null)
    .not("live_url", "is", null)
    .is("unpublished_at", null)
    .order("published_at", { ascending: true });
  if (live.error) throw new Error(`refresh: reading publications for ${siteId}: ${live.error.message}`);

  const verdicts = await client
    .from<{ publication_id: string; movement: { declined?: unknown } | null }>("page_verdicts")
    .select("publication_id, movement")
    .eq("site_id", siteId)
    .order("week_start", { ascending: true });
  if (verdicts.error) throw new Error(`refresh: reading verdicts for ${siteId}: ${verdicts.error.message}`);
  // Oldest first, so the newest row of a publication is the one kept.
  const declined = new Map<string, boolean>();
  for (const row of verdicts.data ?? []) declined.set(row.publication_id, row.movement?.declined === true);

  const own = await opportunityStore().hostedOwnPages(siteId);
  const pages = new Map<string, OwnLivePage>();
  const ours = new Set<string>();
  for (const publication of live.data ?? []) {
    const opportunity = publication.drafts?.opportunities ?? null;
    if (publication.live_url === null || publication.published_at === null || opportunity === null) continue;
    if (typeof opportunity.family !== "string" || typeof opportunity.id !== "string") continue;
    const url = addressOf(publication.live_url, own);
    if (opportunity.family === "write" || opportunity.family === "earn") ours.add(url);
    // A fix of a page's metadata is not a version of its content.
    if (opportunity.family === "fix") continue;
    const meta = publication.drafts?.meta ?? {};
    pages.set(url, {
      url,
      publishedAt: new Date(publication.published_at),
      row: readOpportunity(opportunity),
      declined: declined.get(publication.id) ?? false,
      facts: passagesOf(meta.facts),
      marketFacts: passagesOf(meta.marketFacts),
    });
  }
  return [...pages.values()].filter((page) => ours.has(page.url));
}

/** What `planRefreshes` reads, as the Postgres store answers it. */
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
  return { siteText: await readMeasuredText({ siteId }), market };
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
    const candidates = refreshCandidates(pages, pools, a.at);
    const { created } = await persist({ candidates });
    return created.length;
  } catch (error) {
    console.error(JSON.stringify({ event: "refresh_plan_failed", siteId: a.siteId, message: String(error) }));
    return 0;
  }
}
